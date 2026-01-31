require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { execSync } = require('child_process');
const FormData = require('form-data');
const { scanFileWithVirusTotal } = require('./vtScan');

const app = express();
const PORT = process.env.PORT || 3001;

// Flowise API integration
async function queryFlowise(question) {
  try {
    const flowiseUrl = process.env.FLOWISE_API_URL;
    if (!flowiseUrl) throw new Error("FLOWISE_API_URL is not set in environment variables.");

    const response = await fetch(flowiseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Flowise error ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error querying Flowise:", error);
    throw error;
  }
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
            
            // PDF
            if (this.isPDF(buffer)) {
                return { type: 'PDF', format: 'Document' };
            }
            
            // Text
            if (this.isText(buffer)) {
                return { type: 'TXT', format: 'Text' };
            }
            
            // Memory dump (common for volatility)
            if (ext === '.dmp' || ext === '.mem') {
                return { type: 'MEMDUMP', format: 'Memory Dump' };
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
            '.xml': { type: 'XML', format: 'Data' },
            '.log': { type: 'LOG', format: 'Log' },
            '.dmp': { type: 'MEMDUMP', format: 'Memory Dump' },
            '.mem': { type: 'MEMDUMP', format: 'Memory Dump' },
            '.bin': { type: 'BIN', format: 'Binary' },
            '.img': { type: 'IMG', format: 'Image File' },
            '.tar': { type: 'TAR', format: 'Archive' },
            '.gz': { type: 'GZIP', format: 'Compressed' }
        };
        
        return typeMap[ext] || { type: 'UNKNOWN', format: 'Unknown' };
    }
};

// PowerShell command executor
const PowerShellExecutor = {
    executeCommand(command, timeoutMs = 30000) {
        try {
            const result = execSync(`powershell -Command "${command}"`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                timeout: timeoutMs
            });
            console.log(`[PowerShell] Command output: ${result.substring(0, 500)}`);
            return { success: true, output: result };
        } catch (error) {
            const output = error.stdout || error.stderr || '';
            console.log(`[PowerShell] Error output: ${output.substring(0, 500)}`);
            return { success: false, error: error.message, output: output };
        }
    },

    executeCommandAsync(command) {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            // Execute directly through cmd.exe
            const ps = spawn('cmd.exe', ['/c', command], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
                detached: false
            });
            
            let stdout = '';
            let stderr = '';
            
            ps.stdout.on('data', (data) => {
                stdout += data.toString('utf8');
            });
            
            ps.stderr.on('data', (data) => {
                stderr += data.toString('utf8');
            });
            
            ps.on('close', (code) => {
                const output = stdout || stderr || '';
                if (code !== 0 && !output) {
                    resolve({ success: false, error: `Process exited with code ${code}`, output: '' });
                } else {
                    resolve({ success: true, output: output });
                }
            });
            
            ps.on('error', (error) => {
                resolve({ success: false, error: error.message, output: '' });
            });
        });
    },

    checkVolatilityInstalled() {
        try {
            const result = execSync('powershell -Command "vol --version"', {
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure hashes directory exists (at root level)
const hashesDir = path.join(__dirname, 'hashes');
if (!fs.existsSync(hashesDir)) {
    fs.mkdirSync(hashesDir, { recursive: true });
}

// Ensure password protected files directory exists
const protectedFilesDir = path.join(__dirname, 'password protected files');
if (!fs.existsSync(protectedFilesDir)) {
    fs.mkdirSync(protectedFilesDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

// Configure multer for protected file uploads
const protectedStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, protectedFilesDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 3 * 1024 * 1024 * 1024 } // 3GB limit
});

const uploadProtected = multer({
    storage: protectedStorage,
    limits: { fileSize: 3 * 1024 * 1024 * 1024 } // 3GB limit
});

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
            name: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
            filename: req.file.filename
        }
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

app.post('/api/upload-multiple', upload.array('files', 10), (req, res) => {
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

app.post('/api/upload-protected', uploadProtected.array('files', 10), (req, res) => {
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
        message: `${req.files.length} protected file(s) uploaded successfully`,
        files: uploadedFiles
    });
});

// Serve static files AFTER API routes
app.use(express.static(__dirname));

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
                other: []
            }
        };

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
                    created: stat.birthtime
                };
                
                // Identify file type
                const typeInfo = FileTypeAnalyzer.identifyFileType(filename, buffer);
                fileInfo.type = typeInfo.type;
                fileInfo.format = typeInfo.format;
                
                // ✅ VIRUSTOTAL SCANNING: Files < 30MB are automatically scanned
                const MAX_VT_SIZE = 30 * 1024 * 1024; // 30 MB limit
                if (stat.size < MAX_VT_SIZE) {
                    // Security check: ensure file is within uploads directory
                    if (path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
                        console.log(`[VirusTotal] Scanning: ${filename} (${fileInfo.sizeKB} KB)`);
                        const vtResult = await scanFileWithVirusTotal(filePath, filename);
                        
                        if (vtResult.success) {
                            fileInfo.virusTotal = {
                                scanned: true,
                                fromCache: vtResult.fromCache,
                                analysisId: vtResult.analysisId,
                                ...vtResult.data
                            };
                        } else {
                            fileInfo.virusTotal = {
                                scanned: false,
                                reason: vtResult.error || 'Scan failed'
                            };
                        }
                    } else {
                        fileInfo.virusTotal = {
                            scanned: false,
                            reason: 'File not in uploads directory (security check failed)'
                        };
                    }
                } else {
                    fileInfo.virusTotal = {
                        scanned: false,
                        reason: `File too large (${fileInfo.sizeKB} KB > 30 MB limit)`
                    };
                }
                
                // Determine processing route
                fileInfo.processingRoute = determineProcessingRoute(fileInfo.type);
                
                // Add to appropriate processing route
                if (fileInfo.processingRoute === 'flowise') {
                    analysis.processingRoutes.flowise.push(fileInfo);
                } else if (fileInfo.processingRoute === 'volatility') {
                    analysis.processingRoutes.volatility.push(fileInfo);
                } else {
                    analysis.processingRoutes.other.push(fileInfo);
                }
                
                analysis.files.push(fileInfo);
            } catch (err) {
                console.error(`Error analyzing file ${filename}:`, err);
            }
        }

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
    
    if (flowise.includes(fileType)) {
        return 'flowise';
    } else if (volatility.includes(fileType)) {
        return 'volatility';
    } else {
        return 'other';
    }
}

// Check volatility installation
app.get('/api/volatility/status', (req, res) => {
    const status = PowerShellExecutor.checkVolatilityInstalled();
    res.json(status);
});

// Execute volatility command on a file
app.post('/api/volatility/analyze', async (req, res) => {
    const { filename, plugin } = req.body;

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

    // Default plugin if not specified
    const volatilityPlugin = plugin || 'windows.pstree';

    // Volatility3 directory with vol.py
    const volPyPath = 'C:\\FYP_Virtual_lab\\volatility3-develop\\volatility3-develop\\vol.py';

    // Build command with full path to vol.py
    const command = `py ${volPyPath} -f ${filePath} ${volatilityPlugin}`;

    try {
        // Run command asynchronously in background
        const result = await PowerShellExecutor.executeCommandAsync(command);
        
        console.log('Volatility result:', { success: result.success, outputLength: result.output ? result.output.length : 0, error: result.error });
        
        // Extract volatility output
        const volatilityOutput = result.output || '';
        const hasOutput = volatilityOutput.trim().length > 0;

        // Always send to Flowise if we have output, regardless of success status
        if (hasOutput) {
            let flowiseAnalysis = null;
            try {
                const floWiseInput = `Analyze this volatility memory dump output:\n\n${volatilityOutput}`;
                console.log('Sending to Flowise, input length:', floWiseInput.length, 'input:', floWiseInput.substring(0, 100));
                flowiseAnalysis = await queryFlowise(floWiseInput);
                console.log('Flowise response received:', flowiseAnalysis);
            } catch (flowiseError) {
                console.error('Flowise query failed:', flowiseError.message);
            }

            res.json({
                success: true,
                file: filename,
                plugin: volatilityPlugin,
                output: volatilityOutput,
                flowiseAnalysis: flowiseAnalysis || null
            });
        } else {
            const errorMessage = result.error || 'No output generated from volatility command';
            console.error('Volatility command failed:', errorMessage);
            
            res.json({
                success: false,
                error: errorMessage,
                output: volatilityOutput
            });
        }
    } catch (error) {
        console.error('Exception in volatility analysis:', error);
        res.status(500).json({ 
            error: 'Failed to execute volatility command', 
            details: error.message 
        });
    }
});

// Get list of generated hash files
app.get('/api/hashes', (req, res) => {
    try {
        const hashes = fs.readdirSync(hashesDir);
        const hashDetails = hashes.map(filename => {
            const filePath = path.join(hashesDir, filename);
            const stat = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            return {
                name: filename,
                size: stat.size,
                sizeKB: (stat.size / 1024).toFixed(2),
                created: stat.birthtime,
                content: content
            };
        });

        res.json({
            success: true,
            hashes: hashDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve hash files' });
    }
});

// Get list of password protected files
app.get('/api/protected-files', (req, res) => {
    try {
        const files = fs.readdirSync(protectedFilesDir);
        const fileDetails = files.map(filename => {
            const filePath = path.join(protectedFilesDir, filename);
            const stat = fs.statSync(filePath);
            return {
                name: filename,
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
        res.status(500).json({ error: 'Failed to retrieve protected files' });
    }
});

// Delete password protected file
app.delete('/api/protected-files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(protectedFilesDir, filename);

        // Security check: ensure path is within protected files directory
        if (!path.resolve(filePath).startsWith(path.resolve(protectedFilesDir))) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Protected file deleted successfully' });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete protected file' });
    }
});

// Auto-process protected files: generate hashes and crack passwords
app.post('/api/auto-process-protected-files', async (req, res) => {
    const johnDir = 'C:\\FYP_Virtual_lab\\john-1.9.0-jumbo-1-win64\\run';
    const rockyouPath = 'C:\\FYP_Virtual_lab\\rockyou.txt';
    const results = [];

    try {
        // Get all files in protected files directory
        const files = fs.readdirSync(protectedFilesDir);

        for (const filename of files) {
            const filePath = path.join(protectedFilesDir, filename);
            
            // Skip directories
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) continue;

            const ext = path.extname(filename).toLowerCase();
            let hashCommand;
            let hashTool;

            // Create hash filename and path FIRST
            const hashFilename = `${path.basename(filename, path.extname(filename))}.hash`;
            const hashFilePath = path.join(hashesDir, hashFilename);

            // Check if file type is supported
            if (ext === '.xlsx' || ext === '.xls' || ext === '.docx' || ext === '.doc') {
                hashCommand = `cd '${johnDir}' ; py office2john.py '${filePath}' 2>&1`;
                hashTool = 'office2john.py';
            } else if (ext === '.pdf') {
                hashCommand = `cd '${johnDir}' ; perl pdf2john.pl '${filePath}' 2>&1`;
                hashTool = 'pdf2john.pl';
            } else {
                results.push({
                    filename,
                    success: false,
                    error: `Unsupported file type: ${ext}`
                });
                continue;
            }

            // Generate hash
            const hashResult = PowerShellExecutor.executeCommand(hashCommand, 60000); // 60 second timeout for office2john

            // If no output, try alternative approach with explicit python path
            let output = hashResult.output;
            if ((!output.trim()) && hashTool === 'office2john.py') {
                console.log(`Retrying with explicit python path for ${filename}`);
                const altCommand = `py '${johnDir}\\office2john.py' '${filePath}' 2>&1`;
                const altResult = PowerShellExecutor.executeCommand(altCommand);
                output = altResult.output;
            }

            // Check if hash was generated (look for hash pattern: filename:$office$...)
            const hashPattern = /:\$office\$\*/;
            const hashGenerated = hashPattern.test(output);
            if (!hashGenerated) {
                console.error(`Hash generation failed for ${filename}:`);
                console.error(`Command: ${hashCommand}`);
                console.error(`Success: ${hashResult.success}`);
                console.error(`Output: ${output}`);
                console.error(`Error: ${hashResult.error}`);
                
                results.push({
                    filename,
                    success: false,
                    error: 'Failed to generate hash. File may not be password-protected.',
                    hashOutput: output,
                    commandError: hashResult.error
                });
                continue;
            }

            // Save hash to file with ASCII encoding
            try {
                fs.writeFileSync(hashFilePath, output, 'ascii');
            } catch (writeError) {
                results.push({
                    filename,
                    success: false,
                    error: 'Failed to write hash file',
                    details: writeError.message
                });
                continue;
            }

            // Verify hash file was created
            if (!fs.existsSync(hashFilePath)) {
                results.push({
                    filename,
                    success: false,
                    error: 'Hash file verification failed after write'
                });
                continue;
            }

            // Crack password
            const crackCommand = `cd "${johnDir}" ; .\\john.exe --wordlist="${rockyouPath}" "${hashFilePath}"`;
            console.log(`[John] Cracking password for ${filename}...`);
            const crackResult = PowerShellExecutor.executeCommand(crackCommand, 120000);
            console.log(`[John] Crack result: Success=${crackResult.success}, Output length=${crackResult.output.length}`);
            
            // Wait for John to write results to disk before querying
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show results (IMPORTANT: This contains the actual cracked password)
            const showCommand = `cd "${johnDir}" ; .\\john.exe --show "${path.resolve(hashFilePath)}"`;
            console.log(`[John] Retrieving cracked password for ${filename}...`);
            const showResult = PowerShellExecutor.executeCommand(showCommand, 30000);
            console.log(`[John] Show result: Success=${showResult.success}, Output length=${showResult.output.length}`);
            console.log(`[John] Password output:\n${showResult.output}`);

            // Extract password from output (format: filename:password:uid:...)
            const passwordMatch = showResult.output.match(/^.*?:([^:]+):/m);
            const crackedPassword = passwordMatch ? passwordMatch[1] : null;

            results.push({
                filename,
                hashFile: hashFilename,
                success: true,
                hashTool: hashTool,
                crackOutput: crackResult.output,
                showOutput: showResult.output,
                crackedPassword: crackedPassword,
                message: 'Hash generated and password cracking completed'
            });
        }

        res.json({
            success: true,
            results: results,
            message: `Processed ${results.length} file(s)`
        });

    } catch (error) {
        console.error('Auto-process error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to auto-process protected files', 
            details: error.message,
            stack: error.stack
        });
    }
});

// Generate hash from password-protected file
app.post('/api/generate-hash', async (req, res) => {
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

    const ext = path.extname(filename).toLowerCase();
    const johnDir = 'C:\\Users\\23007717\\OneDrive - Republic Polytechnic\\Desktop\\Y3S2\\fyp my attempt\\john-1.9.0-jumbo-1-win64\\run';
    
    let command;
    let hashTool;
    let hashFilename;
    let hashFilePath;

    // Determine which tool to use based on file extension
    if (ext === '.xlsx' || ext === '.xls' || ext === '.docx' || ext === '.doc') {
        hashFilename = `${path.basename(filename, path.extname(filename))}.hash`;
        hashFilePath = path.join(hashesDir, hashFilename);
        command = `cd '${johnDir}' ; python office2john.py '${filePath}' 2>&1`;
        hashTool = 'office2john.py';
    } else if (ext === '.pdf') {
        hashFilename = `${path.basename(filename, path.extname(filename))}.hash`;
        hashFilePath = path.join(hashesDir, hashFilename);
        command = `cd '${johnDir}' ; perl pdf2john.pl '${filePath}' 2>&1`;
        hashTool = 'pdf2john.pl';
    } else {
        return res.status(400).json({ error: 'File type not supported for hash generation' });
    }

    try {
        const result = PowerShellExecutor.executeCommand(command);

        // Check if hash was generated (look for hash pattern: filename:$office$...)
        const hashPattern = /:\$office\$\*/;
        const hashGenerated = hashPattern.test(result.output);

        if (hashGenerated && result.output.trim()) {
            // Write the hash to file with ASCII encoding
            fs.writeFileSync(hashFilePath, result.output, 'ascii');

            // Read back and verify
            const hashContent = fs.readFileSync(hashFilePath, 'utf8');

            res.json({
                success: true,
                file: filename,
                hashFile: hashFilename,
                hashContent: hashContent,
                tool: hashTool,
                message: 'Hash generated successfully'
            });
        } else {
            res.json({
                success: false,
                error: 'Failed to generate hash. File may not be password-protected.',
                output: result.output
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate hash', details: error.message });
    }
});

// Delete hash file
app.delete('/api/hashes/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(hashesDir, filename);

        // Security check: ensure path is within hashes directory
        if (!path.resolve(filePath).startsWith(path.resolve(hashesDir))) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Hash file deleted successfully' });
        } else {
            res.status(404).json({ error: 'Hash file not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete hash file' });
    }
});

// Crack password hashes with John the Ripper
app.post('/api/john/crack', async (req, res) => {
    const { hashFilename } = req.body;

    if (!hashFilename) {
        return res.status(400).json({ error: 'Hash filename required' });
    }

    const hashFilePath = path.join(hashesDir, hashFilename);

    // Security check
    if (!path.resolve(hashFilePath).startsWith(path.resolve(hashesDir))) {
        return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(hashFilePath)) {
        return res.status(404).json({ error: 'Hash file not found' });
    }

    const johnDir = 'C:\\FYP_Virtual_lab\\john-1.9.0-jumbo-1-win64\\run';
    const rockyouPath = 'C:\\FYP_Virtual_lab\\rockyou.txt';

    // Build PowerShell command
    const command = `cd "${johnDir}" ; .\\john.exe --wordlist="${rockyouPath}" "${hashFilePath}"`;

    try {
        const crackResult = PowerShellExecutor.executeCommand(command, 120000);
        console.log(`[John] Crack completed. Waiting for session to save...`);
        
        // Wait for John to write results to disk before querying
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show the actual cracked password with full path
        const showCommand = `cd "${johnDir}" ; .\\john.exe --show "${path.resolve(hashFilePath)}"`;
        console.log(`[John] Executing show command: ${showCommand}`);
        const showResult = PowerShellExecutor.executeCommand(showCommand, 30000);
        
        // Extract password from output
        const passwordMatch = showResult.output.match(/^.*?:([^:]+):/m);
        const crackedPassword = passwordMatch ? passwordMatch[1] : null;

        if (crackResult.success || showResult.output.trim().length > 0) {
            res.json({
                success: true,
                hashFile: hashFilename,
                crackOutput: crackResult.output,
                showOutput: showResult.output,
                crackedPassword: crackedPassword,
                message: 'Password cracking completed'
            });
        } else {
            res.json({
                success: false,
                error: crackResult.error || 'No password found',
                output: crackResult.output
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to execute John the Ripper', details: error.message });
    }
});

// Process password-protected files (auto-generate hash and crack)
app.post('/api/process-protected-files', async (req, res) => {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Files array required' });
    }

    const johnDir = 'C:\\FYP_Virtual_lab\\john-1.9.0-jumbo-1-win64\\run';
    const rockyouPath = 'C:\\FYP_Virtual_lab\\rockyou.txt';
    const results = [];

    for (const file of files) {
        const filename = file.filename;
        const filePath = path.join(uploadsDir, filename);

        // Security check
        if (!path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
            results.push({ filename, success: false, error: 'Invalid file path' });
            continue;
        }

        if (!fs.existsSync(filePath)) {
            results.push({ filename, success: false, error: 'File not found' });
            continue;
        }

        const ext = path.extname(filename).toLowerCase();
        let hashCommand;
        let hashTool;

        // Determine which tool to use
        if (ext === '.xlsx' || ext === '.xls' || ext === '.docx' || ext === '.doc') {
            hashCommand = `cd '${johnDir}' ; python office2john.py '${filePath}'`;
            hashTool = 'office2john.py';
        } else if (ext === '.pdf') {
            hashCommand = `cd '${johnDir}' ; perl pdf2john.pl '${filePath}'`;
            hashTool = 'pdf2john.pl';
        } else {
            results.push({ filename, success: false, error: 'File type not supported for hash generation' });
            continue;
        }

        try {
            // Step 1: Generate hash
            const hashResult = PowerShellExecutor.executeCommand(hashCommand);

            if (!hashResult.success || !hashResult.output.trim()) {
                results.push({ 
                    filename, 
                    success: false, 
                    error: 'Failed to generate hash',
                    hashOutput: hashResult.output 
                });
                continue;
            }

            // Save hash to file
            const hashFilename = `${path.basename(filename, path.extname(filename))}.hash`;
            const hashFilePath = path.join(hashesDir, hashFilename);
            fs.writeFileSync(hashFilePath, hashResult.output, 'utf8');

            // Step 2: Crack the hash
            const crackCommand = `cd "${johnDir}" ; .\\john.exe --wordlist="${rockyouPath}" "${hashFilePath}"`;
            const crackResult = PowerShellExecutor.executeCommand(crackCommand, 120000);
            console.log(`[John] Crack attempt for ${filename}. Waiting for session to save...`);
            
            // Wait for John to write results to disk before querying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Step 3: Show results to get the actual password with full path
            const showCommand = `cd "${johnDir}" ; .\\john.exe --show "${path.resolve(hashFilePath)}"`;
            console.log(`[John] Executing show command for ${filename}`);
            const showResult = PowerShellExecutor.executeCommand(showCommand, 30000);
            
            // Extract password from output
            const passwordMatch = showResult.output.match(/^.*?:([^:]+):/m);
            const crackedPassword = passwordMatch ? passwordMatch[1] : null;

            results.push({
                filename,
                success: true,
                hashFile: hashFilename,
                hashTool,
                crackOutput: crackResult.output,
                showOutput: showResult.output,
                crackedPassword: crackedPassword,
                message: 'Hash generated and password cracking completed'
            });
        } catch (error) {
            results.push({ 
                filename, 
                success: false, 
                error: error.message 
            });
        }
    }

    res.json({
        success: true,
        results: results
    });
});

app.post('/api/generate-report', (req, res) => {
    try {
        const { content, timestamp } = req.body;
        const { Document, Packer, Paragraph, TextRun } = require('docx');

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Forensic Evidence Report',
                                bold: true,
                                size: 32
                            })
                        ]
                    }),
                    new Paragraph({
                        children: [new TextRun('')]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Generated: ${new Date().toLocaleString()}`,
                                italics: true
                            })
                        ]
                    }),
                    new Paragraph({
                        children: [new TextRun('')]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: content,
                                size: 20
                            })
                        ]
                    })
                ]
            }]
        });

        Packer.toBuffer(doc).then(buffer => {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Forensic_Evidence_Report_${timestamp}.docx`);
            res.send(buffer);
        });
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
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
