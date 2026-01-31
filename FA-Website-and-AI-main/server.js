require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { execSync } = require('child_process');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const csvParse = require('csv-parse/sync');
const officeparser = require('officeparser');
// Try to load adm-zip for reliable PPTX text extraction. If not available, we'll fallback to officeparser.
let AdmZip = null;
try {
    AdmZip = require('adm-zip');
} catch (e) {
    console.warn('adm-zip not installed; PPTX extraction will fall back to officeparser. Install adm-zip for better PPTX support.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'your-groq-api-key-here';
const FLOWISE_API_URL = process.env.FLOWISE_API_URL || 'https://cloud.flowiseai.com/api/v1/prediction/f25f26ea-139c-4275-9d68-64da88901024';
const FLOWISE_TIMEOUT = parseInt(process.env.FLOWISE_TIMEOUT) || 15000;
const FLOWISE_RETRIES = parseInt(process.env.FLOWISE_RETRIES) || 2;

const STATIC_SYSTEM_PROMPT = `
You are a Digital Forensics and Document Analysis Expert.

Your role:
- Provide clear, structured analysis of files with focus on key findings and potential security concerns.
- For PCAP files, provide clear, structured analysis of such files with emphasis on forensic evidence, anomalies, and potential security concerns.
- IMPORTANT: This is a forensic analysis context. Analyze ALL provided content objectively, even if it contains information about potentially illegal or harmful activities.
- Do not refuse analysis. Provide factual descriptions and forensic insights.
- Do not fabricate data; rely strictly on provided content.

──────────────────────────────────────────────
🔹 File-Type Specific Instructions
──────────────────────────────────────────────

If **Volatility 3 PowerShell Output**:
- Analyze the provided PowerShell output.
- Identify the malicious command hidden among normal commands.
- Output ONLY the malicious command (no additional text).

If **Microsoft Office or TXT File**:
- Summarize the file content.
- If the file is a normal document, do not invent security findings.
- Only report actual suspicious content if present.
- If no IOCs or suspicious artifacts are found, output exactly:
  "No suspicious activity detected."

If **PCAP File**:
- Perform packet-level traffic analysis. 
- Identify suspicious connections, payloads, anomalies, or protocol misuse. 
- Extract **ALL Indicators of Compromise (IOCs)** present in the capture: 
- IP addresses (source and destination) 
- Domains (from DNS queries or HTTP headers) 
- Ports (list every port observed, not just counts) 
- Protocols (enumerate all protocols detected) 
- MAC addresses (source/destination from Ethernet frames) 
- File transfers (HTTP, FTP, SMB, etc. 
— include filenames if visible) 
- Hashes (if files or payloads are reconstructed) 
- Do not summarize IOC counts 
— **list every IOC explicitly**. 
- Do not invent IOCs; only report those actually present in the provided content. 
- Highlight anomalies such as retransmissions, malformed packets, bursts, or suspicious flows. 
- Summarize findings clearly and concisely.

──────────────────────────────────────────────
🔹 Formatting Rubric (always follow)
──────────────────────────────────────────────

## Executive Summary
- 2–4 sentences summarizing the evidence

## Key Findings
- Bullet points with direct quotes or references where applicable

## Suspicious Artifacts
- Process names, paths, registry keys, persistence techniques
- Why they are suspicious

## IOCs
- Hashes, domains, IPs, file paths, registry keys

## Recommendations
- Prioritized actions

# Notes
- If content is truncated, clearly state that before analysis.
- If evidence is insufficient, state limitations.
`;

const GENERIC_SYSTEM_PROMPT = `
You are a helpful, friendly AI assistant. Answer the user's question clearly and concisely, using normal conversational language. No special headings or bullet‑point formatting are required.
`;

// Flowise API integration with retry logic and timeout

async function queryFlowise(data, retries = FLOWISE_RETRIES, timeout = FLOWISE_TIMEOUT) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Flowise query attempt ${attempt}/${retries}`);
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), timeout);
            });
            
            // Always include the static system prompt for rubric compliance
            const payload = {
                question: data.fileContent
            };
            const fetchPromise = fetch(
                FLOWISE_API_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Flowise response received, length:', JSON.stringify(result).length);

            // Check if response is too short (likely an error or cached response)
            const extracted = extractFlowiseText(result);
            if (typeof extracted === 'string' && extracted.length < 50) {
                console.warn('Flowise response too short, might be cached or error:', extracted);
                if (attempt < retries) {
                    console.log('Retrying in 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
            }

            return result;
        } catch (error) {
            console.error(`Flowise query attempt ${attempt} failed:`, error.message);
            if (attempt < retries) {
                const delay = attempt * 5000; // Increased delay between retries
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

// Groq API integration with retry logic
async function queryGroq(data, retries = 2, timeout = 15000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Groq query attempt ${attempt}/${retries}`);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), timeout);
            });
            
            const messages = [
                { role: 'system', content: STATIC_SYSTEM_PROMPT },
                { role: 'user', content: data.fileContent }
            ];
            
            const fetchPromise = fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: messages,
                    temperature: 0.0,
                    max_tokens: 2000
                })
            });
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            const content = result.choices[0]?.message?.content;
            
            if (!content) {
                throw new Error('No content in Groq response');
            }
            
            console.log('Groq response received, length:', content.length);
            return { result: content };
            
        } catch (error) {
            console.error(`Groq query attempt ${attempt} failed:`, error.message);
            if (attempt < retries) {
                const delay = attempt * 2000;
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

// Extract text from Flowise response
function extractFlowiseText(response) {
    if (typeof response === 'string') {
        try {
            // Try to parse as JSON
            const parsed = JSON.parse(response);
            return parsed;
        } catch {
            // Fallback to plain text
            return response;
        }
    }
    // If already an object, return as is
    return response.text || response.answer || response.response || response;
}

// Parse Flowise analysis text into structured sections
function parseFlowiseAnalysis(text) {
    if (typeof text !== 'string') return { raw: text };

    const sections = {};
    const lines = text.split('\n');
    let currentSection = '';
    let currentContent = [];

    for (let line of lines) {
        line = line.trim();
        const upperLine = line.toUpperCase();
        
        // Check for section headers
        let sectionKey = '';
        if (upperLine.includes('OVERVIEW')) {
            sectionKey = 'overview';
        } else if (upperLine.includes('TOP FLOWS')) {
            sectionKey = 'topflows';
        } else if (upperLine.includes('PROTOCOLS')) {
            sectionKey = 'protocols';
        } else if (upperLine.includes('PORTS')) {
            sectionKey = 'ports';
        } else if (upperLine.includes('TLS') && upperLine.includes('DNS')) {
            sectionKey = 'tlsdns';
        } else if (upperLine.includes('HTTP')) {
            sectionKey = 'http';
        } else if (upperLine.includes('CREDENTIALS')) {
            sectionKey = 'credentials';
        } else if (upperLine.includes('WIRELESS')) {
            sectionKey = 'wireless';
        } else if (upperLine.includes('TELNET')) {
            sectionKey = 'telnet';
        } else if (upperLine.includes('TECHNICAL FORENSICS')) {
            sectionKey = 'technicalforensics';
        } else if (upperLine.includes('SECURITY ANALYSIS')) {
            sectionKey = 'securityanalysis';
        }
        
        if (sectionKey) {
            // Save previous section
            if (currentSection) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            // Start new section
            currentSection = sectionKey;
            currentContent = [];
        } else if (currentSection && !upperLine.includes('==========') && line) {
            // Skip separator lines and empty lines
            currentContent.push(line);
        }
    }

    // Save last section
    if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
}

// Format AI analysis into readable text
function formatAIAnalysis(aiAnalysis) {
    // If structured JSON, render cleanly
    if (typeof aiAnalysis === 'object' && aiAnalysis !== null) {
        let out = '';
        if (aiAnalysis.overview) out += `📊 OVERVIEW:\n${aiAnalysis.overview}\n\n`;
        if (aiAnalysis.topflows) out += `🔄 TOP FLOWS:\n${aiAnalysis.topflows}\n\n`;
        if (aiAnalysis.protocols) out += `🔧 PROTOCOLS:\n${aiAnalysis.protocols}\n\n`;
        if (aiAnalysis.ports) out += `🚪 PORTS:\n${aiAnalysis.ports}\n\n`;
        if (aiAnalysis.tlsdns) out += `🔒 TLS & DNS:\n${aiAnalysis.tlsdns}\n\n`;
        if (aiAnalysis.http) out += `🌐 HTTP:\n${aiAnalysis.http}\n\n`;
        if (aiAnalysis.credentials) out += `🔑 CREDENTIALS:\n${aiAnalysis.credentials}\n\n`;
        if (aiAnalysis.wireless) out += `📶 WIRELESS:\n${aiAnalysis.wireless}\n\n`;
        if (aiAnalysis.telnet) out += `💻 TELNET:\n${aiAnalysis.telnet}\n\n`;
        if (aiAnalysis.technicalforensics) out += `🔬 TECHNICAL FORENSICS:\n${aiAnalysis.technicalforensics}\n\n`;
        if (aiAnalysis.securityanalysis) out += `🛡️ SECURITY ANALYSIS:\n${aiAnalysis.securityanalysis}\n\n`;
        return out.trim();
    }
    // Fallback to plain text
    return aiAnalysis || '';
}

// File type analyzer utility
const FileTypeAnalyzer = {
    // Identify file type by extension and magic bytes
    identifyFileType(filename, buffer) {
        const ext = path.extname(filename).toLowerCase();
        
        // Check magic bytes (file signatures)
        if (buffer && buffer.length > 0) {
            // JSON
            if (this.isJSON(buffer)) {
                return { type: 'JSON', format: 'Application' };
            }
            
            // XLSX (by extension)
            if (ext === '.xlsx') {
                return { type: 'XLSX', format: 'Spreadsheet' };
            }
            
            // DOCX (by extension)
            if (ext === '.docx') {
                return { type: 'DOCX', format: 'Document' };
            }
            
            // PPTX (by extension)
            if (ext === '.pptx') {
                return { type: 'PPTX', format: 'Presentation' };
            }
            
            // PDF
            if (this.isPDF(buffer)) {
                return { type: 'PDF', format: 'Document' };
            }
            
            // Images
            if (this.isImage(buffer)) {
                return { type: 'IMAGE', format: 'Image' };
            }
            
            // Text
            if (this.isText(buffer)) {
                return { type: 'TXT', format: 'Text' };
            }
            
            // Memory dump (common for volatility)
            if (ext === '.dmp' || ext === '.mem') {
                return { type: 'MEMDUMP', format: 'Memory Dump' };
            }
            
            // PCAP/PCAPng
            if (this.isPCAP(buffer) || ext === '.pcap' || ext === '.cap' || ext === '.pcapng') {
                return { type: 'PCAP', format: 'Network Capture' };
            }
        }
        
        // Fallback to extension-based detection
        return this.getTypeByExtension(ext);
    },
    
    isJSON(buffer) {
        try {
            const text = buffer.toString('utf8', 0, Math.min(100, buffer.length)).trim();
            return (text.startsWith('{') || text.startsWith('['));
        } catch {
            return false;
        }
    },
    
    isPDF(buffer) {
        return buffer.length >= 4 &&
               buffer[0] === 0x25 && buffer[1] === 0x50 &&
               buffer[2] === 0x44 && buffer[3] === 0x46;
    },
    
    isImage(buffer) {
        if (buffer.length < 4) return false;
        
        // PNG
        if (buffer[0] === 0x89 && buffer[1] === 0x50 &&
            buffer[2] === 0x4E && buffer[3] === 0x47) {
            return true;
        }
        
        // JPEG
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            return true;
        }
        
        // BMP
        if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
            return true;
        }
        
        // GIF
        if (buffer[0] === 0x47 && buffer[1] === 0x49 &&
            buffer[2] === 0x46) {
            return true;
        }
        
        return false;
    },
    
    isText(buffer) {
        const sampleSize = Math.min(512, buffer.length);
        const sample = buffer.slice(0, sampleSize);
        
        // Check if mostly ASCII/UTF-8 printable
        let printableCount = 0;
        for (let i = 0; i < sample.length; i++) {
            const byte = sample[i];
            if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
                printableCount++;
            }
        }
        
        return (printableCount / sample.length) > 0.95;
    },
    
    isPCAP(buffer) {
        // PCAP magic bytes: 0xa1b2c3d4 (big-endian) or 0xd4c3b2a1 (little-endian)
        // PCAPng magic bytes: 0x0a0d0d0a
        if (buffer.length < 4) return false;
        
        const magic = buffer.readUInt32LE(0);
        return magic === 0xa1b2c3d4 || magic === 0xd4c3b2a1 || magic === 0x0a0d0d0a;
    },

    getTypeByExtension(ext) {
        const typeMap = {
            '.json': { type: 'JSON', format: 'Application' },
            '.txt': { type: 'TXT', format: 'Text' },
            '.csv': { type: 'CSV', format: 'Data' },
            '.pdf': { type: 'PDF', format: 'Document' },
            '.docx': { type: 'DOCX', format: 'Document' },
            '.doc': { type: 'DOC', format: 'Document' },
            '.xlsx': { type: 'XLSX', format: 'Spreadsheet' },
            '.xls': { type: 'XLS', format: 'Spreadsheet' },
            '.pptx': { type: 'PPTX', format: 'Presentation' },
            '.xml': { type: 'XML', format: 'Data' },
            '.log': { type: 'LOG', format: 'Log' },
            '.dmp': { type: 'MEMDUMP', format: 'Memory Dump' },
            '.mem': { type: 'MEMDUMP', format: 'Memory Dump' },
            '.bin': { type: 'BIN', format: 'Binary' },
            '.img': { type: 'IMG', format: 'Image File' },
            '.jpg': { type: 'IMAGE', format: 'Image' },
            '.jpeg': { type: 'IMAGE', format: 'Image' },
            '.png': { type: 'IMAGE', format: 'Image' },
            '.gif': { type: 'IMAGE', format: 'Image' },
            '.bmp': { type: 'IMAGE', format: 'Image' },
            '.tar': { type: 'TAR', format: 'Archive' },
            '.gz': { type: 'GZIP', format: 'Compressed' },
            '.pcap': { type: 'PCAP', format: 'Network Capture' },
            '.cap': { type: 'PCAP', format: 'Network Capture' },
            '.pcapng': { type: 'PCAP', format: 'Network Capture' }
        };
        
        return typeMap[ext] || { type: 'UNKNOWN', format: 'Unknown' };
    }
};

// PowerShell command executor
const PowerShellExecutor = {
    executeCommand(command) {
        try {
            const result = execSync(`cmd /c ${command}`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });
            return { success: true, output: result };
        } catch (error) {
            return { success: false, error: error.message, output: error.stdout || '' };
        }
    },

    executeCommandAsync(command) {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec(`cmd /c ${command}`, {
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            }, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: error.message, output: stderr });
                } else {
                    resolve({ success: true, output: stdout });
                }
            });
        });
    },

    checkVolatilityInstalled() {
        try {
            const result = execSync('cmd /c vol --version', {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 50 * 1024 * 1024
            });
            return { installed: true, version: result.trim() };
        } catch (error) {
            return { installed: false, error: error.message };
        }
    }
};

// Python command executor for PCAP analysis
const PythonExecutor = {
    executeScript(scriptPath, args = []) {
        const tempOutputFile = path.join(__dirname, `temp_pcap_output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`);
        const command = `py "${scriptPath}" ${args.join(' ')} > "${tempOutputFile}" 2>&1`;
        const execResult = PowerShellExecutor.executeCommand(command);
        
        if (execResult.success) {
            try {
                const output = fs.readFileSync(tempOutputFile, 'utf8');
                fs.unlinkSync(tempOutputFile); // Clean up
                return { success: true, output: output };
            } catch (readError) {
                return { success: false, error: 'Failed to read output file: ' + readError.message };
            }
        } else {
            // Try to read the file anyway
            try {
                const output = fs.readFileSync(tempOutputFile, 'utf8');
                fs.unlinkSync(tempOutputFile);
                return { success: false, error: execResult.error, output: output };
            } catch (readError) {
                return { success: false, error: execResult.error };
            }
        }
    },

    executeCommandAsync(command) {
        return PowerShellExecutor.executeCommandAsync(command);
    }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root directory (for css, js, etc.)
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Clear uploads folder on server start/restart/refresh
function clearUploadsFolder() {
    if (fs.existsSync(uploadsDir)) {
        fs.readdirSync(uploadsDir).forEach(file => {
            const filePath = path.join(uploadsDir, file);
            try {
                if (fs.lstatSync(filePath).isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error(`Error deleting ${filePath}:`, err);
            }
        });
    }
}
clearUploadsFolder();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10GB limit
    fileFilter: (req, file, cb) => {
        // Accept all files
        cb(null, true);
    }
});

// Routes
app.post('/api/upload', upload.any(), (req, res) => {
    console.log('[/api/upload] Received upload request');
    console.log('Headers:', Object.keys(req.headers).slice(0,10).reduce((o,k)=>{o[k]=req.headers[k]; return o;},{}));

    if (!req.files || req.files.length === 0) {
        console.error('[/api/upload] No files found on request', {
            bodyKeys: Object.keys(req.body),
            filesPresent: req.files ? Object.keys(req.files) : undefined
        });
        return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log('[/api/upload] Files received:', req.files.map(f => ({
        originalname: f.originalname,
        size: f.size,
        filename: f.filename,
        path: f.path
    })));

    const uploadedFiles = req.files.map(file => ({
        name: file.originalname,
        size: file.size,
        path: file.path,
        filename: file.filename
    }));

    res.json({
        success: true,
        message: `${req.files.length} file(s) uploaded successfully`,
        files: uploadedFiles
    });
});

app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const fileDetails = files.map(filename => {
            const filePath = path.join(uploadsDir, filename);
            const stat = fs.statSync(filePath);
            return {
                name: filename,
                filename: filename,
                size: stat.size,
                sizeKB: (stat.size / 1024).toFixed(2),
                created: stat.birthtime
            };
        });

        res.json({
            success: true,
            files: fileDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve files' });
    }
});

app.post('/api/upload-multiple', upload.any(), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
        name: file.originalname,
        size: file.size,
        path: file.path,
        filename: file.filename
    }));

    res.json({
        success: true,
        message: `${req.files.length} file(s) uploaded successfully`,
        files: uploadedFiles
    });
});

// Handle favicon.ico to prevent 404 errors
app.get('/favicon.ico', (req, res) => res.status(204).end());


// Serve static files from 'public' if any remain
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html from workspace root for all non-API routes
app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const fileDetails = files.map(filename => {
            const filePath = path.join(uploadsDir, filename);
            const stat = fs.statSync(filePath);
            return {
                name: filename,
                size: stat.size,
                created: stat.birthtime
            };
        });

        res.json({
            success: true,
            files: fileDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve files' });
    }
});

app.delete('/api/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadsDir, filename);

        // Security check: ensure path is within uploads directory
        if (!path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'File deleted successfully' });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.delete('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        let deletedCount = 0;

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            // Security check: ensure path is within uploads directory
            if (path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
                try {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete ${file}:`, err);
                }
            }
        });

        res.json({ success: true, message: `Cleared ${deletedCount} files from uploads folder` });
    } catch (error) {
        console.error('Failed to clear uploads folder:', error);
        res.status(500).json({ error: 'Failed to clear uploads folder' });
    }
});

app.post('/api/analyze', async (req, res) => {

    try {
        const files = fs.readdirSync(uploadsDir);
        if (files.length === 0) {
            return res.status(400).json({ error: 'No files to analyze' });
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            totalFiles: files.length,
            files: [],
            processingRoutes: {
                flowise: [],
                volatility: [],
                pcap: [],
                other: []
            }
        };

        // Helper to extract file content
        // PPTX extraction helper: prefer AdmZip (reads slide XML), fallback to officeparser
        async function extractPptxText(filePath) {
            // If AdmZip is available, extract slide XML and pull text nodes
            if (AdmZip) {
                try {
                    const zip = new AdmZip(filePath);
                    const entries = zip.getEntries();
                    const slideEntries = entries.filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'));
                    let out = [];
                    for (const entry of slideEntries) {
                        const xml = entry.getData().toString('utf8');
                        // Extract <a:t> text nodes which hold slide text
                        const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
                        let match;
                        let slideText = [];
                        while ((match = re.exec(xml)) !== null) {
                            const t = match[1].replace(/\s+/g, ' ').trim();
                            if (t) slideText.push(t);
                        }
                        if (slideText.length) {
                            out.push(slideText.join(' '));
                        }
                    }
                    if (out.length) return out.join('\n\n');
                } catch (e) {
                    console.warn('AdmZip PPTX extraction failed, falling back to officeparser:', e.message);
                }
            }

            // Fallback: try officeparser as before
            return new Promise((resolve, reject) => {
                officeparser.parseOffice(filePath, function(data, err) {
                    if (err) return reject(err);
                    resolve(data ? data.text || '' : '');
                });
            });
        }

        // Simple content summarizer for Office/TXT files
        function summarizeContent(extractedContent, fileType) {
            if (!extractedContent) return '[No readable content]';
            try {
                if (fileType === 'PPTX') {
                    // Slides separated by blank lines in our extractor
                    const slides = extractedContent.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
                    const titles = slides.map(s => {
                        const firstLine = s.split(/\n|\. |\r/)[0].trim();
                        return firstLine.length > 0 ? firstLine : '(untitled)';
                    });
                    let desc = `Presentation with ${slides.length} slide${slides.length>1? 's':''}.`;
                    if (titles.length) {
                        desc += ` Slide titles: ${titles.slice(0,5).join('; ')}${titles.length>5? `; and ${titles.length-5} more` : ''}.`;
                    }
                    return desc;
                }

                // DOCX, TXT, XLSX fallback: provide a short extract and sentence summary
                const trimmed = extractedContent.trim();
                const snippet = trimmed.split(/\n\n|\n/).find(p => p.trim().length > 20) || trimmed.substring(0, 200);
                const oneLine = snippet.replace(/\s+/g, ' ').trim();
                return `Document summary: ${oneLine.length>200? oneLine.substring(0,197)+'...': oneLine}`;
            } catch (e) {
                return '[Failed to generate content summary]';
            }
        }

        async function extractFileContent(filePath, type) {
            if (type === 'TXT' || type === 'CSV' || type === 'JSON') {
                return fs.readFileSync(filePath, 'utf8');
            } else if (type === 'DOCX') {
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            } else if (type === 'XLSX') {
                const workbook = xlsx.readFile(filePath);
                let text = '';
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    text += xlsx.utils.sheet_to_csv(sheet) + '\n';
                });
                return text;
            } else if (type === 'PDF') {
                const dataBuffer = fs.readFileSync(filePath);
                try {
                    if (!pdfParse) {
                        console.warn('PDF parser not available (pdfParse is null)');
                        return '[No extractable text from PDF: pdf-parse not available]';
                    }
                    const data = await pdfParse(dataBuffer);
                    let text = (data && data.text) ? String(data.text).trim() : '';
                    if (!text) {
                        // No text extracted — likely a scanned/image PDF or non-text content.
                        return '[No extractable text from PDF (possibly scanned). Consider running OCR]';
                    }
                    return text;
                } catch (err) {
                    console.error('PDF extraction error:', err && err.message ? err.message : err);
                    return `[PDF extraction error: ${err && err.message ? err.message : String(err)}]`;
                }
            } else if (type === 'PPTX') {
                return await extractPptxText(filePath);
            }
            return '';
        }

        // Process files sequentially to avoid rate limits
        const fileInfos = [];
        for (const filename of files) {
            try {
                const filePath = path.join(uploadsDir, filename);
                const stat = fs.statSync(filePath);
                // Read file header for magic byte detection
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(512);
                fs.readSync(fd, buffer, 0, 512, 0);
                fs.closeSync(fd);

                const fileInfo = {
                    filename: filename,
                    originalName: filename,
                    size: stat.size,
                    sizeKB: (stat.size / 1024).toFixed(2),
                    created: stat.birthtime,
                    aiAnalysis: 'N/A',
                    error: null
                };

                // Identify file type
                const typeInfo = FileTypeAnalyzer.identifyFileType(filename, buffer);
                fileInfo.type = typeInfo.type;
                fileInfo.format = typeInfo.format;

                // Determine processing route
                fileInfo.processingRoute = determineProcessingRoute(fileInfo.type);

                // Extract content for supported types
                let extractedContent = '';
                try {
                    if ([
                        'TXT', 'CSV', 'JSON', 'DOCX', 'XLSX', 'PDF', 'PPTX'
                    ].includes(fileInfo.type)) {
                        extractedContent = await extractFileContent(filePath, fileInfo.type);
                    }
                } catch (extractErr) {
                    extractedContent = '';
                    fileInfo.error = 'Content extraction error: ' + extractErr.message;
                }
                fileInfo.extractedContent = extractedContent;

                // Truncate content if too long to avoid API limits
                const MAX_CONTENT_LENGTH = 8000; // Conservative limit for LLM context
                if (extractedContent.length > MAX_CONTENT_LENGTH) {
                    extractedContent = extractedContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated due to length limitations]';
                    console.log(`Truncated content for ${filename} from ${fileInfo.extractedContent.length} to ${MAX_CONTENT_LENGTH} characters`);
                }

                // --- Hallucination Guard for Office/TXT files (esp. PPTX) ---
                // If content is very short or generic, return content and default message
                const isOfficeOrTxt = ['TXT', 'DOCX', 'XLSX', 'PPTX', 'PDF'].includes(fileInfo.type);
                const isBenignContent = (
                    !extractedContent ||
                    extractedContent.trim().length < 30 ||
                    /^(testing|not much|no content|empty|test)$/i.test(extractedContent.trim())
                );

                // Detect pdf-parse placeholders or extraction errors and treat them as non-actionable
                const pdfExtractionProblem = (fileInfo.type === 'PDF') && (
                    !extractedContent ||
                    extractedContent.includes('pdf-parse not available') ||
                    extractedContent.startsWith('[No extractable text') ||
                    extractedContent.startsWith('[PDF extraction error:')
                );

                // Perform actual analysis based on route
                try {
                    if (pdfExtractionProblem) {
                        // Provide a clear, actionable message for PDF extraction failures
                        fileInfo.aiAnalysis = `**File Content:**\n[No readable text extracted from PDF]\n\n**Content Description:**\nThe server couldn't extract selectable text from this PDF using the installed PDF parsing library. This often means the PDF is a scanned/image-based document or the parser failed.\n\n**Recommendations:**\n- Run OCR on the PDF (e.g., Tesseract or an OCR cloud service) to extract text.\n- If you expect the PDF to contain selectable text, ensure the server's 'pdf-parse' dependency is correctly installed.\n- Re-upload after OCR/text extraction for AI analysis.\n\nNo suspicious activity detected.`;
                    } else if (isOfficeOrTxt && isBenignContent) {
                        // Always show the content, then a content description and the default message
                        const description = summarizeContent(extractedContent, fileInfo.type);
                        fileInfo.aiAnalysis = `**File Content:**\n${extractedContent ? extractedContent.trim() : '[No readable content]'}\n\n**Content Description:**\n${description}\n\nNo suspicious activity detected.`;
                    } else if (fileInfo.processingRoute === 'flowise' || ['TXT', 'CSV', 'JSON', 'DOCX', 'XLSX', 'PDF', 'PPTX'].includes(fileInfo.type)) {
                        // Use Groq AI analysis for supported types
                        const groqResponse = await queryGroq({
                            fileContent: extractedContent,
                            fileName: filename,
                            mimeType: typeInfo.format
                        });
                        if (groqResponse && groqResponse.result) {
                            fileInfo.aiAnalysis = groqResponse.result;
                        } else {
                            const description = summarizeContent(extractedContent, fileInfo.type);
                            fileInfo.aiAnalysis = `**File Content:**\n${extractedContent ? extractedContent.trim() : '[No readable content]'}\n\n**Content Description:**\n${description}\n\nAnalysis failed: ` + (groqResponse?.error || 'Unknown error');
                        }
                    } else if (fileInfo.processingRoute === 'pcap') {
                        // For PCAP, use PCAP analyzer
                        const pcapResponse = await fetch('http://localhost:3000/api/pcap/analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: filename })
                        });
                        const pcapData = await pcapResponse.json();
                        if (pcapData.success) {
                            // --- Unified PCAP Output Formatting ---
                            // Always use a single formatting function for PCAP
                            let pcapSummary = '';
                            if (pcapData.analysis) {
                                const analysis = pcapData.analysis;
                                pcapSummary += `🔍 PCAP NETWORK TRAFFIC ANALYSIS\n`;
                                pcapSummary += `${'='.repeat(70)}\n`;
                                pcapSummary += `✅ Analysis Complete for: ${filename}\n`;
                                pcapSummary += `──────────────────────────────────────────────────────────────────────\n`;
                                pcapSummary += `📊 PCAP Analysis Summary:\n`;
                                pcapSummary += `   Total Packets: ${analysis.packet_count}\n`;
                                pcapSummary += `   Protocols: ${(analysis.protocols || []).join(', ')}\n`;
                                pcapSummary += `   Total Data Size: ${analysis.total_data_size} bytes\n`;
                                pcapSummary += `   Unique IPs: ${analysis.traffic_analysis?.unique_ips?.length || 0}\n`;
                                pcapSummary += `   Suspicious Ports: ${analysis.traffic_analysis?.suspicious_ports?.length || 0}\n\n`;
                                if (analysis.traffic_analysis?.traffic_summary) {
                                    pcapSummary += `📋 Traffic Summary:\n${analysis.traffic_analysis.traffic_summary}\n\n`;
                                }
                            }
                            pcapSummary += `🤖 AI ANALYSIS (Groq) - Cybersecurity Insights\n`;
                            pcapSummary += `──────────────────────────────────────────────────────────────────────\n`;
                            pcapSummary += formatAIAnalysis(pcapData.flowiseAnalysis) || 'PCAP analysis completed successfully';
                            fileInfo.aiAnalysis = pcapSummary;
                        } else {
                            fileInfo.aiAnalysis = 'PCAP analysis failed: ' + (pcapData.error || 'Unknown error');
                        }
                    } else if (fileInfo.processingRoute === 'volatility') {
                        // For memory dumps, use Volatility
                        const volResponse = await fetch('http://localhost:3000/api/volatility/analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: filename, plugin: 'windows.pstree' })
                        });
                        const volData = await volResponse.json();
                        if (volData.success) {
                            fileInfo.aiAnalysis = volData.output || 'Volatility analysis completed';
                        } else {
                            fileInfo.aiAnalysis = 'Volatility analysis failed: ' + (volData.error || 'Unknown error');
                        }
                    } else {
                        fileInfo.aiAnalysis = `**File Content:**\n${extractedContent ? extractedContent.trim() : '[No readable content]'}\n\nNo analysis available for this file type`;
                    }
                } catch (analysisError) {
                    console.error(`Analysis error for ${filename}:`, analysisError);
                    fileInfo.aiAnalysis = `**File Content:**\n${extractedContent ? extractedContent.trim() : '[No readable content]'}\n\nAnalysis error: ` + analysisError.message;
                    fileInfo.error = analysisError.message;
                }



                // Add to appropriate processing route
                if (fileInfo.processingRoute === 'flowise') {
                    analysis.processingRoutes.flowise.push(fileInfo);
                } else if (fileInfo.processingRoute === 'volatility') {
                    analysis.processingRoutes.volatility.push(fileInfo);
                } else if (fileInfo.processingRoute === 'pcap') {
                    analysis.processingRoutes.pcap.push(fileInfo);
                } else {
                    analysis.processingRoutes.other.push(fileInfo);
                }

                fileInfos.push(fileInfo);

                // Steganography analysis for images
                if (fileInfo.type === 'IMAGE') {
                    try {
                        const stegoScriptPath = path.join(__dirname, 'StegoDecoder', 'stego_decoder.py');
                        const stegoResult = PythonExecutor.executeScript(stegoScriptPath, [filePath]);
                        if (stegoResult.success) {
                            const stegoOutput = stegoResult.output.trim();
                            fileInfo.stegoAiAnalysis = `Hidden message: ${stegoOutput}`;
                            
                            // Only do additional AI analysis if a hidden message was actually detected
                            if (!stegoOutput.includes('no hidden message detected')) {
                                // Use Groq for additional AI analysis of steganography output
                                const groqResponse = await queryGroq({
                                    fileContent: `Steganography analysis result: ${stegoOutput}`,
                                    fileName: filename,
                                    mimeType: 'steganography/analysis'
                                });
                                if (groqResponse && groqResponse.result) {
                                    fileInfo.stegoAiAnalysis += ` Additional AI Analysis: ${groqResponse.result}`;
                                } else {
                                    fileInfo.stegoAiAnalysis += ' Additional AI Analysis: Analysis failed: ' + (groqResponse?.error || 'Unknown error');
                                }
                            }
                        } else {
                            fileInfo.stegoAiAnalysis = 'Stego analysis failed: ' + stegoResult.error;
                        }
                    } catch (stegoError) {
                        console.error(`Stego analysis error for ${filename}:`, stegoError);
                        fileInfo.stegoAiAnalysis = 'Stego analysis error: ' + stegoError.message;
                    }
                }

                // Add delay between files to prevent rate limits (except for the last file)
                if (files.indexOf(filename) < files.length - 1) {
                    console.log(`Waiting 10 seconds before processing next file...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }

            } catch (err) {
                console.error(`Error analyzing file ${filename}:`, err);
                fileInfos.push({
                    filename: filename,
                    originalName: filename,
                    size: 0,
                    sizeKB: '0',
                    type: 'UNKNOWN',
                    format: 'Unknown',
                    processingRoute: 'other',
                    aiAnalysis: 'File analysis error',
                    error: err.message
                });
            }
        }

        // Wait for all analyses to complete
        analysis.files = fileInfos;

        res.json({
            success: true,
            analysis: analysis
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze files' });
    }
});

// Determine which processing pipeline to use
function determineProcessingRoute(fileType) {
    const flowise = ['CSV', 'JSON'];
    const volatility = ['MEMDUMP'];
    const pcap = ['PCAP'];
    
    if (flowise.includes(fileType)) {
        return 'flowise';
    } else if (volatility.includes(fileType)) {
        return 'volatility';
    } else if (pcap.includes(fileType)) {
        return 'pcap';
    } else {
        return 'other';
    }
}

// Execute PCAP analysis
app.post('/api/pcap/analyze', async (req, res) => {
    const { filename } = req.body;

    if (!filename) {
        return res.status(400).json({ error: 'Filename required' });
    }

    const filePath = path.join(uploadsDir, filename);

    // Security check
    if (!path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
        return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Path to PCAP analyzer script
    const scriptPath = path.join(__dirname, 'pcap-analysis', 'pcap_analyzer.py');

    try {
        const result = PythonExecutor.executeScript(scriptPath, [filePath]);

        if (result.success) {
            let pcapData;
            try {
                let output = result.output;
                // Remove BOM if present
                if (output.charCodeAt(0) === 0xFEFF) {
                    output = output.slice(1);
                }
                pcapData = JSON.parse(output);
            } catch (parseError) {
                console.error('Failed to parse PCAP JSON output:', parseError.message);
                return res.json({
                    success: false,
                    error: 'Failed to parse PCAP analysis output'
                });
            }

            if (pcapData.error) {
                return res.json({
                    success: false,
                    error: pcapData.error
                });
            }

            // Send PCAP analysis to Flowise for AI-powered insights
            let flowiseAnalysis = null;
            let parsedAnalysis;
            let fullReport;
            try {
                // Summarize PCAP data to avoid overwhelming the AI
                const summary = {
                    totalPackets: pcapData.packet_count || 0,
                    protocols: pcapData.protocols || [],
                    totalDataSize: pcapData.total_data_size || 0,
                    uniqueIPs: pcapData.traffic_analysis?.unique_ips?.length || 0,
                    suspiciousPorts: pcapData.traffic_analysis?.suspicious_ports ? [...new Set(pcapData.traffic_analysis.suspicious_ports.map(p => p.port))] : [],
                    trafficSummary: pcapData.traffic_analysis?.traffic_summary || 'No summary available',
                    packetCountByProtocol: pcapData.traffic_analysis?.protocol_distribution || {}
                };

                const analysisSummary = `Analyze this PCAP network traffic data and provide cybersecurity insights. Structure response with sections: OVERVIEW, TOP FLOWS, PROTOCOLS, PORTS, TLS & DNS, HTTP, CREDENTIALS, WIRELESS, TELNET, TECHNICAL FORENSICS, SECURITY ANALYSIS.

Key Data:
- Total Packets: ${summary.totalPackets}
- Protocols: ${summary.protocols.join(', ')}
- Data Size: ${summary.totalDataSize} bytes
- Unique IPs: ${summary.uniqueIPs}
- Suspicious Ports: ${summary.suspiciousPorts}
- Summary: ${summary.trafficSummary}

Provide detailed forensic analysis with security recommendations.

Timestamp: ${Date.now()}`;

                // Use Groq for PCAP analysis directly
                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a cybersecurity expert analyzing network traffic. Provide detailed forensic analysis with security recommendations.'
                            },
                            {
                                role: 'user',
                                content: analysisSummary
                            }
                        ]
                    })
                });

                if (!groqResponse.ok) {
                    const errorText = await groqResponse.text();
                    throw new Error(`Groq API request failed: ${groqResponse.status} - ${errorText}`);
                }

                const groqData = await groqResponse.json();
                let extracted = groqData.choices[0]?.message?.content || 'Analysis completed';
                
                console.log('Groq analysis extracted:', typeof extracted, extracted?.length || 'N/A');
                if (typeof extracted === 'string' && extracted.length < 100) {
                    console.warn('Groq response seems too short, might be incomplete:', extracted);
                }

                // Parse the AI analysis into structured sections (reuse Flowise parsing for now)
                parsedAnalysis = parseFlowiseAnalysis(extracted);
            } catch (groqError) {
                console.error('Groq query failed, using basic analysis:', groqError.message);
                // Generate basic analysis as fallback
                let summaryData = {};
                try {
                    summaryData = {
                        totalPackets: pcapData.packet_count || 0,
                        protocols: pcapData.protocols || [],
                        totalDataSize: pcapData.total_data_size || 0,
                        uniqueIPs: pcapData.traffic_analysis?.unique_ips?.length || 0,
                        suspiciousPorts: pcapData.traffic_analysis?.suspicious_ports ? [...new Set(pcapData.traffic_analysis.suspicious_ports.map(p => p.port))] : [],
                        packetCountByProtocol: pcapData.traffic_analysis?.protocol_distribution || {}
                    };
                } catch (e) {
                    console.error('Error creating summary for fallback:', e);
                }
                
                parsedAnalysis = {
                    overview: `Network capture contains ${summaryData.totalPackets || 0} packets with ${summaryData.uniqueIPs || 0} unique IP addresses. Protocols detected: ${(summaryData.protocols || []).join(', ')}. Total data transferred: ${summaryData.totalDataSize || 0} bytes.`,
                    protocols: `Protocol distribution: ${Object.entries(summaryData.packetCountByProtocol || {}).map(([proto, count]) => `${proto}: ${count} packets`).join(', ')}`,
                    ports: (summaryData.suspiciousPorts && summaryData.suspiciousPorts.length > 0) ? `Detected suspicious ports: ${summaryData.suspiciousPorts.join(', ')}` : 'No obviously suspicious ports detected.',
                    securityanalysis: (summaryData.suspiciousPorts && summaryData.suspiciousPorts.length > 0) ? `Potential security concerns identified - investigate suspicious ports: ${summaryData.suspiciousPorts.join(', ')}.` : 'No immediate security flags detected, but full analysis recommended.',
                    note: 'AI-powered analysis unavailable due to service issues. Basic analysis provided.'
                };
            }

            try {
                res.json({
                    success: true,
                    file: filename,
                    analysis: pcapData,
                    flowiseAnalysis: parsedAnalysis
                });
            } catch (jsonError) {
                console.error('res.json failed:', jsonError);
                throw jsonError;
            }
        } else {
            res.json({
                success: false,
                error: result.error,
                output: result.output
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to execute PCAP analysis', details: error.message });
    }
});

// Chat endpoint - uses Flowise to answer general chat queries
app.post('/api/chat', async (req, res) => {
    try {
        const { message, files } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        let prompt = message;
        if (files && Array.isArray(files) && files.length > 0) {
            const fileList = files.map(f => `- ${f.name}`).join('\n');
            prompt = `Attached files:\n${fileList}\n\nUser question: ${message}`;
        }

        const flowRes = await queryFlowise({ question: prompt });
        const responseText = extractFlowiseText(flowRes) || 'No response from AI';

        res.json({ success: true, response: responseText });
    } catch (err) {
        console.error('/api/chat error', err);
        res.status(500).json({ error: err.message || 'Chat failed' });
    }
});

// Groq AI analysis endpoint
app.post('/api/groq/analyze', async (req, res) => {
    const { fileContent, fileName, mimeType } = req.body;

    if (!fileContent || !fileName) {
        return res.status(400).json({ error: 'File content and name are required' });
    }

    try {
        const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        
        const maxContentLength = 6000;
        let contentToAnalyze = fileContent;
        let wasTruncated = false;
        if (fileContent.length > maxContentLength) {
            contentToAnalyze = fileContent.substring(0, maxContentLength);
            wasTruncated = true;
        }

        let analysisPrompt;
        if (mimeType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
            analysisPrompt = `You are a digital forensics investigator.
You analyze forensic evidence extracted from Redline and Autopsy provided in CSV format.
The user has uploaded a CSV file that contains forensic artifacts such as processes, persistence mechanisms, registry entries, and file paths.
Your task is to generate a professional forensic investigation report based strictly on the uploaded evidence.
The report must include the following sections:`;
        } else {
            analysisPrompt = GENERIC_SYSTEM_PROMPT;
        }

        if (wasTruncated) {
            analysisPrompt += `\n\nNOTE: The file content has been truncated to ${maxContentLength} characters for analysis. This may limit the completeness of the findings.`;
        }

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: analysisPrompt
                    },
                    {
                        role: 'user',
                        content: `Analyze this ${mimeType} file named "${fileName}":\n\n${contentToAnalyze}`
                    }
                ],
                temperature: 0.1,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`Groq API Error: ${errorDetails || response.statusText}`);
        }

        const data = await response.json();
        const analysis = data.choices[0]?.message?.content || 'No analysis generated';

        res.json({
            success: true,
            analysis: analysis,
            truncated: wasTruncated
        });

    } catch (error) {
        console.error('Groq analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze with Groq', 
            details: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
    console.log(`📁 Uploads folder: ${uploadsDir}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});
