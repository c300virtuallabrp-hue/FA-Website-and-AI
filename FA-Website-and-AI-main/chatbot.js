// -------------------------------------------------------------
//  GLOBAL STORE FOR THE LAST GENERATED REPORT (plain text, this is a memory store after the word document report.)
// -------------------------------------------------------------
window._lastReportText = null;   // will hold the report as a string
window._reportGeneratedAt   = null; // timestamp (optional)

class FileAnalyzer {
    constructor() {
        this.reportGenerated = false;
        this.uploadedFiles = [];
        this.pendingFiles = this.pendingFiles || [];
        this.initializeElements();
        this.attachEventListeners();
        this.loadExistingFiles();
    }

    // Store the latest analysis results for report generation
    setAnalysisResults(analysis) {
        // Flatten and normalize analysis.files for report
        window.analysisResults_COMBINED = (analysis.files || []).map(file => ({
            fileName: file.originalName || file.filename || file.name,
            mimeType: file.format || file.type || '',
            fileSize: file.size || 0,
            flowiseType: file.type || '',
            extractedContent: '', // Not available in this version
            aiAnalysis: file.aiAnalysis || '', // Now populated from server
            stegoAiAnalysis: file.stegoAiAnalysis || null,
            binaryData: null,
            isPasswordProtected: false,
            encryptionSuspected: false,
            error: file.error || null
        }));
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.outputArea = document.getElementById('outputArea') || null;
        // this.analyzeBtn removed: no longer needed
        this.progressContainer = document.getElementById('progressContainer') || null;
        this.progressBar = document.getElementById('progressBar') || null;
        this.progressText = document.getElementById('progressText') || null;
        // Clear Uploads button
        this.clearUploadsBtn = document.getElementById('clearUploadsBtn');
    }

    attachEventListeners() {
        if (this.fileInput) this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        // this.analyzeBtn event listener removed

        if (this.clearUploadsBtn) {
            this.clearUploadsBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to clear all uploaded files? This cannot be undone.')) return;
                
                // Clear locally immediately and show message
                this.uploadedFiles = [];
                this.pendingFiles = [];
                this.loadExistingFiles();
                this.addMessage('Chatbot: 🗑️ All uploaded files have been cleared.', 'bot');
                
                // Attempt to clear from server
                try {
                    const res = await fetch('/api/files', { method: 'DELETE' });
                    const data = await res.json();
                    if (!data.success) {
                        console.warn('Server clear failed:', data.error);
                    }
                } catch (err) {
                    console.warn('Error clearing from server:', err.message);
                }
            });
        }
    }

    loadExistingFiles() {
        fetch('/api/files')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.files.length > 0) {
                    data.files.forEach(file => {
                        this.uploadedFiles.push({
                            name: file.name,
                            size: file.sizeKB,
                            filename: file.filename
                        });
                    });
                    this.updateFileList();
                }
            })
            .catch(error => {
                console.error('Error loading existing files:', error);
            });
    }

    // Get MIME type from file extension
    getMimeType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const mimeMap = {
            // Text / code
            'txt': 'text/plain',
            'csv': 'text/csv',
            'json': 'application/json',
            'xml': 'application/xml',
            'md': 'text/markdown',
            'html': 'text/html',
            'htm': 'text/html',
            'js': 'application/javascript',


            // Executables
            'exe': 'application/vnd.microsoft.portable-executable',
            'dll': 'application/vnd.microsoft.portable-executable',
            'sys': 'application/octet-stream'
        };
        return mimeMap[ext] || 'application/octet-stream';
    }

    async handleFileUpload(event) {
        const files = event.target.files;
        
        if (files.length === 0) return;

        for (let file of files) {
            const mimeType = this.getMimeType(file.name);
            this.pendingFiles.push({
                name: file.name,
                mimeType: mimeType,
                file: file
            });
        }
        this.updateFileList();
        this.fileInput.value = '';
    }

    showProgress() {
        this.progressContainer.style.display = 'block';
        this.progressBar.style.width = '0%';
        this.progressText.textContent = 'Uploading... 0%';
    }

    updateProgress(percent) {
        this.progressBar.style.width = percent + '%';
        this.progressText.textContent = `Uploading... ${Math.round(percent)}%`;
    }

    hideProgress() {
        this.progressContainer.style.display = 'none';
        this.progressBar.style.width = '0%';
    }

    updateFileList() {
        this.fileList.innerHTML = '';
        
        if (this.pendingFiles.length === 0) {
            this.fileList.innerHTML = '<p style="color: #999; font-size: 12px;">No files selected yet</p>';
            return;
        }

        this.pendingFiles.forEach((file, index) => {
            const sizeMB = (file.file.size / (1024 * 1024)).toFixed(2);
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>
                    <strong>${file.name}</strong><br>
                    <small>${sizeMB} MB</small>
                </span>
                <button type="button" onclick="event.preventDefault(); analyzer.removePendingFile(${index})">×</button>
            `;
            this.fileList.appendChild(fileItem);
        });
    }

    displayOutput(content) {
        if (this.outputArea) {
            this.outputArea.textContent = content;
            this.outputArea.scrollTop = 0;
        }
    }

    formatAIAnalysis(aiAnalysis) {
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
            if (aiAnalysis.note) out += `ℹ️ NOTE:\n${aiAnalysis.note}\n\n`;
            return out.trim();
        }
        // Fallback to old markdown parsing
        if (!aiAnalysis) return '';
        let text = aiAnalysis;
        let formatted = '';
        const sectionRegex = /\*\*([A-Z\s]+):\*\*/g;
        let lastIndex = 0;
        let match;
        const emojiMap = {
            'OVERVIEW': '📊',
            'TOP FLOWS': '🔄',
            'PROTOCOLS': '🔧',
            'PORTS': '🚪',
            'TLS & DNS': '🔒',
            'HTTP': '🌐',
            'CREDENTIALS': '🔑',
            'WIRELESS': '📶',
            'TELNET': '💻',
            'TECHNICAL FORENSICS': '🔬',
            'SECURITY ANALYSIS': '🛡️'
        };
        while ((match = sectionRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                let prev = text.substring(lastIndex, match.index).trim();
                if (prev) formatted += prev + '\n\n';
            }
            const section = match[1].trim().toUpperCase();
            const emoji = emojiMap[section] || '';
            formatted += `\n${emoji} ${section}:\n`;
            lastIndex = sectionRegex.lastIndex;
        }
        let lastContent = text.substring(lastIndex).trim();
        if (lastContent) formatted += lastContent + '\n';
        formatted = formatted.replace(/\n\s*-\s*\*\*/g, '\n  • ');
        formatted = formatted.replace(/\n\s*-\s*/g, '\n  • ');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
        formatted = formatted.replace(/([\u{1F4C8}\u{1F50D}\u{26A0}\u{1F6E1}]) ([A-Z\s]+):/gu, '\n$1 $2:\n');
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        return formatted.trim();
    }

    async analyzeFiles() {
        if (this.pendingFiles.length === 0 && this.protectedFiles.length === 0) {
            this.displayOutput('❌ No files selected yet. Please select files first.');
            return;
        }

        // Load required libraries if not already loaded
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) return resolve();
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        // Extraction helpers
        async function extractTextFromDocx(file) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const arrayBuffer = e.target.result;
                        const result = await window.mammoth.convertToPlainText({ arrayBuffer });
                        resolve(result.value);
                    } catch (err) { reject(err); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }
        async function extractTextFromXlsx(file) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.20.0/xlsx.full.min.js');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = window.XLSX.read(data, { type: 'array' });
                        let text = '';
                        workbook.SheetNames.forEach(sheetName => {
                            const ws = workbook.Sheets[sheetName];
                            const csv = window.XLSX.utils.sheet_to_csv(ws);
                            text += `\n--- Sheet: ${sheetName} ---\n` + csv;
                        });
                        resolve(text);
                    } catch (err) { reject(err); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }
        async function extractTextFromPptx(file) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const zip = await window.JSZip.loadAsync(e.target.result);
                        let slides = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
                        let text = '';
                        for (let slide of slides) {
                            const xml = await zip.files[slide].async('string');
                            const matches = Array.from(xml.matchAll(/<a:t>(.*?)<\/a:t>/g));
                            text += `\n--- Slide: ${slide} ---\n` + matches.map(m => m[1]).join(' ');
                        }
                        resolve(text);
                    } catch (err) { reject(err); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }
        async function extractTextFromTxt(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        // AI prompt helpers (mimic c300-project)
        function buildPrompt(fileType, fileName, content, wasTruncated) {
            if (fileType === 'pptx') {
                return `You are analyzing a PowerPoint (.pptx) presentation.\nProvide a structured report with the following sections:\n1. Executive Summary (what the deck is about)\n2. Key Messages / Themes\n3. Slide-by-Slide Highlights (titles + notable bullets)\n4. Action Items or Recommendations (if applicable)\n5. Potential Data Quality or Consistency Issues (duplicates, missing titles, conflicting points)\nIf notes exist, incorporate them. If content is truncated, state limitations.\nFile: ${fileName}\n${wasTruncated ? '(Content truncated)\n' : ''}\nContent:\n${content}`;
            } else if (fileType === 'docx') {
                return `You are analyzing a Word (.docx) document.\nProvide a structured forensic report with:\n1. Executive Summary\n2. Key Findings\n3. Suspicious Patterns (PII, emails, URLs, etc.)\n4. Recommendations\nFile: ${fileName}\n${wasTruncated ? '(Content truncated)\n' : ''}\nContent:\n${content}`;
            } else if (fileType === 'xlsx') {
                return `You are analyzing an Excel (.xlsx) spreadsheet.\nProvide a structured forensic report with:\n1. Executive Summary\n2. Key Findings (financial, attendance, config, etc.)\n3. Suspicious Patterns\n4. Recommendations\nFile: ${fileName}\n${wasTruncated ? '(Content truncated)\n' : ''}\nContent:\n${content}`;
            } else if (fileType === 'txt') {
                return `You are analyzing a plain text (.txt) file.\nProvide a structured forensic report with:\n1. Executive Summary\n2. Key Findings\n3. Suspicious Patterns\n4. Recommendations\nFile: ${fileName}\n${wasTruncated ? '(Content truncated)\n' : ''}\nContent:\n${content}`;
            }
            // fallback
            return `Analyze this file and provide:\n1. Brief summary of content\n2. Key information or findings\n3. Any suspicious patterns or important observations\n4. Recommendations\nFile: ${fileName}\n${wasTruncated ? '(Content truncated)\n' : ''}\nContent:\n${content}`;
        }

        // Main analysis logic
        if (this.pendingFiles.length > 0) {
            // Upload the pending files
            const formData = new FormData();
            this.pendingFiles.forEach(fileObj => {
                formData.append('files', fileObj.file);
            });

            try {
                // Show progress for each file
                for (let i = 0; i < this.pendingFiles.length; i++) {
                    this.addMessage(`Chatbot: Analyzing file ${i + 1}/${this.pendingFiles.length}: ${this.pendingFiles[i].name}... ⏳`, 'bot');
                }

                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadResponse.json();
                if (!uploadData.success) {
                    throw new Error(uploadData.error || 'Upload failed');
                }

                // Add uploaded files to uploadedFiles
                uploadData.files.forEach(file => {
                    this.uploadedFiles.push({
                        name: file.name,
                        size: (file.size / 1024).toFixed(2),
                        filename: file.filename
                    });
                });

                // Clear pending files
                this.pendingFiles = [];
                this.updateFileList();
                if (this.fileInput) this.fileInput.value = '';

                // Now analyze
                const analyzeResponse = await fetch('/api/analyze', {
                    method: 'POST'
                });
                const analyzeData = await analyzeResponse.json();
                if (analyzeData.success) {
                    this.displayAnalysisResults(analyzeData.analysis);
                    // Store analysis results for report generation
                    this.setAnalysisResults(analyzeData.analysis);
                    // Run detailed PCAP analysis if PCAP files are present
                    if (analyzeData.analysis.processingRoutes.pcap && analyzeData.analysis.processingRoutes.pcap.length > 0) {
                        this.runPcapAnalysis(analyzeData.analysis.processingRoutes.pcap);
                    }
                    // Show completion message
                    this.addMessage(`Chatbot: AI analysis complete for ${uploadData.files.length} file(s). ✓`, 'bot');
                    // Add follow-up message for report generation
                    this.addMessage('Chatbot: 📄 If you want to generate a report using the analyzed files, just say "generate a report".', 'bot');
                } else {
                    this.displayOutput(`❌ Analysis failed: ${analyzeData.error}`);
                }
                // Expose to global scope for chat handler
                window.generateWordReport = generateWordReport;
                window.ensureDocxLoaded = ensureDocxLoaded;
            } catch (error) {
                console.error('Analysis error:', error);
                this.displayOutput(`❌ Analysis error: ${error.message}`);
            } finally {
                // Also process protected files if any exist
                if (this.protectedFiles.length > 0) {
                    let currentOutput = this.outputArea ? this.outputArea.textContent : '';
                    this.displayOutput(currentOutput + '\n\n⏳ Processing protected files with John...');
                    this.autoProcessProtectedFiles();
                }
            }
        }

        // Also process protected files if any exist
        if (this.protectedFiles.length > 0) {
            let currentOutput = this.outputArea ? this.outputArea.textContent : '';
            this.displayOutput(currentOutput + '\n\n⏳ Processing protected files with John...');
            this.autoProcessProtectedFiles();
        }
    }

    runPcapAnalysis(pcapFiles) {
        let output = '\n\n' + '='.repeat(70) + '\n';
        output += '🔍 PCAP NETWORK TRAFFIC ANALYSIS\n';
        output += '='.repeat(70) + '\n\n';

        pcapFiles.forEach((file, index) => {
            output += `⏳ Analyzing: ${file.originalName}\n`;
        });

        let currentOutput = this.outputArea ? this.outputArea.textContent : '';
        this.addMessage(`<pre>${output}</pre>`, 'bot');

        // Process each PCAP file
        pcapFiles.forEach((file, index) => {
            fetch('/api/pcap/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.filename
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                let resultOutput = this.outputArea ? this.outputArea.textContent : '';

                // Remove loading indicator
                resultOutput = resultOutput.replace(
                    `⏳ Analyzing: ${file.originalName}\n`,
                    ''
                );

                if (data.success) {
                    resultOutput += `${'─'.repeat(70)}\n`;

                    // Display PCAP analysis results
                    const analysis = data.analysis;
                    resultOutput += `📊 PCAP Analysis Summary:\n`;
                    resultOutput += `   Total Packets: ${analysis.packet_count}\n`;
                    resultOutput += `   Protocols: ${analysis.protocols.join(', ')}\n`;
                    resultOutput += `   Total Data Size: ${analysis.total_data_size} bytes\n`;
                    resultOutput += `   Unique IPs: ${analysis.traffic_analysis?.unique_ips?.length || 0}\n`;
                    resultOutput += `   Suspicious Ports: ${analysis.traffic_analysis?.suspicious_ports ? [...new Set(analysis.traffic_analysis.suspicious_ports.map(p => p.port))].join(', ') : 'None'}\n\n`;

                    // Display traffic summary
                    if (analysis.traffic_analysis?.traffic_summary) {
                        resultOutput += `📋 Traffic Summary:\n${analysis.traffic_analysis.traffic_summary}\n`;
                    }

                    // Display Flowise AI Analysis if available
                    if (data.flowiseAnalysis) {
                        resultOutput += `\n🤖 AI ANALYSIS (Groq) - Cybersecurity Insights\n`;
                        resultOutput += `${'─'.repeat(70)}\n`;
                        const formattedAnalysis = this.formatAIAnalysis(data.flowiseAnalysis);
                        resultOutput += formattedAnalysis;
                        resultOutput += `\n${'─'.repeat(70)}\n`;

                        // Update analysis results for report generation
                        if (window.analysisResults_COMBINED) {
                            const fileEntry = window.analysisResults_COMBINED.find(f => f.fileName === file.originalName);
                            if (fileEntry) {
                                fileEntry.aiAnalysis = formattedAnalysis;
                            }
                        }
                    }
                } else {
                    resultOutput += `❌ Analysis Failed for: ${file.originalName}\n`;
                    resultOutput += `Error: ${data.error}\n`;
                    if (data.output) {
                        resultOutput += `Output: ${data.output}\n`;
                    }
                }

                this.addMessage(`<pre>${resultOutput}</pre>`, 'bot');
            })
            .catch(error => {
                console.error('PCAP analysis error:', error);
                let resultOutput = this.outputArea ? this.outputArea.textContent : '';

                // Remove loading indicator
                resultOutput = resultOutput.replace(
                    `⏳ Analyzing: ${file.originalName}\n`,
                    ''
                );

                resultOutput += `❌ PCAP analysis error for ${file.originalName}: ${error.message}\n`;
                this.addMessage(`<pre>${resultOutput}</pre>`, 'bot');
            });
        });
    }

    displayAnalysisResults(analysis) {
        let output = `📊 FILE ANALYSIS REPORT\n`;
        output += `${'='.repeat(70)}\n\n`;
        output += `Analysis Timestamp: ${analysis.timestamp}\n`;
        output += `Total Files Analyzed: ${analysis.totalFiles}\n`;
        output += `${'='.repeat(70)}\n\n`;

        // Group files by type
        const filesByType = {};
        analysis.files.forEach(file => {
            if (!filesByType[file.type]) {
                filesByType[file.type] = [];
            }
            filesByType[file.type].push(file);
        });

        // Display files grouped by type
        Object.keys(filesByType).sort().forEach(type => {
            const files = filesByType[type];
            output += `\n📁 ${type} Files (Format: ${files[0].format})\n`;
            output += `${'-'.repeat(70)}\n`;
            
            files.forEach((file, index) => {
                output += `\n  ${index + 1}. ${file.originalName}\n`;
                output += `     Filename: ${file.filename}\n`;
                output += `     Type: ${file.type}\n`;
                output += `     Size: ${file.sizeKB} KB (${file.size} bytes)\n`;
                output += `     Created: ${new Date(file.created).toLocaleString()}\n`;
                output += `     Processing Route: ${file.processingRoute.toUpperCase()}\n`;
            });
        });

        // Display processing routes summary
        output += `\n\n${'='.repeat(70)}\n`;
        output += `⚙️ PROCESSING ROUTES\n`;
        output += `${'='.repeat(70)}\n`;

        if (analysis.processingRoutes.flowise.length > 0) {
            output += `\n🔀 FLOWISE Processing:\n`;
            analysis.processingRoutes.flowise.forEach((file, index) => {
                output += `  ${index + 1}. ${file.originalName} (${file.type})\n`;
            });
        }

        if (analysis.processingRoutes.volatility.length > 0) {
            output += `\n💾 VOLATILITY 3 Processing:\n`;
            analysis.processingRoutes.volatility.forEach((file, index) => {
                output += `  ${index + 1}. ${file.originalName} (${file.type})\n`;
            });
        }

        if (analysis.processingRoutes.pcap && analysis.processingRoutes.pcap.length > 0) {
            output += `\n🔍 PCAP Analysis Processing:\n`;
            analysis.processingRoutes.pcap.forEach((file, index) => {
                output += `  ${index + 1}. ${file.originalName} (${file.type})\n`;
            });
        }

        if (analysis.processingRoutes.other.length > 0) {
            output += `\n📋 Other/No Processing:\n`;
            analysis.processingRoutes.other.forEach((file, index) => {
                output += `  ${index + 1}. ${file.originalName} (${file.type})\n`;
            });
        }

        output += `\n\n${'='.repeat(70)}\n`;
        output += `Analysis complete. Ready for further processing.\n`;

        this.displayOutput(output);
    }

    removeFile(index) {
        const file = this.uploadedFiles[index];
        
        fetch(`/api/files/${file.filename}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.uploadedFiles.splice(index, 1);
                this.updateFileList();
                this.displayOutput(`🗑️ File "${file.name}" removed successfully.`);
            } else {
                this.displayOutput(`❌ Failed to delete file: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            this.displayOutput(`❌ Delete error: ${error.message}`);
        });
    }

    removePendingFile(index) {
        this.pendingFiles.splice(index, 1);
        this.updateFileList();
    }

    // Add message to chat, allow bot messages for report success, clear, and file selection notices
    addMessage(content, type = 'bot') {
        // Allow certain messages regardless of the reportGenerated flag
        const allowedPatterns = [
            'Report generated and downloaded successfully!',
            'All uploaded files have been cleared.',
            '📎',
            'selected'
        ];
        if (this.reportGenerated) {
            const isSuccessMessage = content.includes('Report generated and downloaded successfully!');
            if (!isSuccessMessage) return;
        }
        const messages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${type === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">${content}</div>
        `;
        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
    }

}

// Ensure CSS from the css folder is loaded
function ensureStylesheetLoaded() {
    const cssHref = 'css/styles.css';
    if (!document.querySelector(`link[href*='${cssHref}']`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssHref;
        document.head.appendChild(link);
    }
}

let analyzer;
document.addEventListener('DOMContentLoaded', () => {
    ensureStylesheetLoaded();
    analyzer = new FileAnalyzer();

    // Handle chat form submit
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById("chat-input");

    if (sendBtn && input) {
        sendBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const message = input.value.trim();
            if (!message) return;

            // Compose user message without file list
            let userMsg = `<div><strong>You:</strong> ${message}</div>`;
            analyzer.addMessage(userMsg, 'user');
            input.value = '';

            // --- Report Generation Intent ---
            const reportIntent = /(generate|create|make|download|export|produce)(\s+me)?(\s+a)?\s+(word|docx)?\s*report/i.test(message);
            if (reportIntent) {
                if (window.analysisResults_COMBINED && window.analysisResults_COMBINED.length > 0) {
                    analyzer.addMessage('Chatbot: Generating Word document report... 📄', 'bot');
                    try {
                        await generateWordReport(window.analysisResults_COMBINED);
                        analyzer.addMessage('Chatbot: ✅ Report generated and downloaded successfully! Check your Downloads folder for "Forensic_Evidence_Report_[timestamp].docx"', 'bot');

                        // Ensure the plain‑text report is already cached before we enable the flag. 
                        awaitingReportQuestion = !!window._lastReportText; // only true if we actually have the text 
                        if (!awaitingReportQuestion) { // No special guard – let the next user message flow through the normal AI path.
                        }

                        // 1️⃣ Reset the flag so normal chat messages are no longer blocked                                                                                                 
                        analyzer.reportGenerated = false;

                        // 2️⃣ Re‑enable the chat input & send button (they may have been removed/disabled while cleaning up)                                                               
                        const inputEl  = document.getElementById('chat-input');
                        const sendBtnEl = document.getElementById('sendBtn');
                        if (inputEl)  inputEl.disabled = false;
                        if (sendBtnEl) sendBtnEl.disabled = false;

                        // Clean up old PCAP/AI‑insight messages (still needed)
                        const messages = document.getElementById('chat-messages');
                        if (messages) {
                            const allMessages = Array.from(messages.children);
                            for (let i = 0; i < allMessages.length; i++) {
                                const msg = allMessages[i];
                                if (msg.textContent && msg.textContent.includes('Chatbot: ✅ Report generated and downloaded successfully!')) {
                                    // Remove all messages after this one
                                    for (let j = allMessages.length - 1; j > i; j--) {
                                        const content = messages.children[j].textContent;
                                        if (
                                            content.includes('PCAP Analysis Summary:') ||
                                            content.includes('AI ANALYSIS (Groq)') ||
                                            content.includes('TOP FLOWS:') ||
                                            content.includes('PORTS:') ||
                                            content.includes('HTTP:') ||
                                            content.includes('TECHNICAL FORENSICS:')
                                        ) {
                                            messages.removeChild(messages.children[j]);
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        analyzer.addMessage(`Chatbot: ❌ Failed to generate report: ${err.message}`,'bot');
                    }
                } else {
                    analyzer.addMessage('Chatbot: ⚠️ No analysis data available. Please upload files and type "done" to analyze them first, then request a report.', 'bot');
                }
                  if (awaitingReportQuestion) {
      // Reset the flag so subsequent messages behave normally
      awaitingReportQuestion = false;

      // -------------------------------------------------
      // 1️⃣  Pull the stored plain‑text report (may be null)                                                                                                                     
      // -------------------------------------------------
      const reportText = window._lastReportText;
      if (!reportText) {
          analyzer.addMessage('Chatbot: Sorry, I could not retrieve the report text yet.', 'bot');
          return;                     // stop further processing
      }

      // -------------------------------------------------
      // 2️⃣  Build a prompt that includes:                                                                                                                                       
      //     – the user’s question
      //     – the full analysis context that was stored when the
      //       report was generated (saved on the server)
      // -------------------------------------------------
      const contextPrompt = window.analysisResults_COMBINED
          ? JSON.stringify(window.analysisResults_COMBINED, null, 2)
          : '';   // fallback if no context is available

      const prompt = `${contextPrompt}\n\n---\nUser question:\n${message}\n---\nAnswer:`;

      // -------------------------------------------------
      // 3️⃣  Send the prompt to the back‑end route that talks to                                                                                                                 
      //     Groq.  The server will inject the **dynamic** API key
      //     from process.env.GROQ_API_KEY.
      // -------------------------------------------------
      try {
          const groqResponse = await fetch('/api/groq/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  fileContent: prompt,
                  fileName:    'report_prompt',
                  mimeType:    'text/plain'
              })
          });

          if (!groqResponse.ok) {
              const errText = await groqResponse.text();
              throw new Error(`Groq request failed: ${groqResponse.status} – ${errText}`);
          }

          const { analysis } = await groqResponse.json();

          // -------------------------------------------------
          // 4️⃣  Show the answer (no forensic headings!)
          // -------------------------------------------------
          const reply = analysis?.trim() || 'No answer was generated.';
          analyzer.displayOutput(reply);
          analyzer.addMessage(`Chatbot: ${reply}`, 'bot');
      } catch (err) {
          console.error('Groq fallback error:', err);
          const fallback = 'Sorry, I could not get a response from the AI.';
          analyzer.displayOutput(fallback);
          analyzer.addMessage(fallback, 'bot');
      }
                return;
            }}

            // Bot response logic
            if (message.toLowerCase() === 'done' && analyzer.pendingFiles.length > 0) {
                analyzer.addMessage(`Starting analysis of ${analyzer.pendingFiles.length} file(s)...`, 'bot');
                await analyzer.analyzeFiles();
            } else if (analyzer.pendingFiles.length > 0) {
                analyzer.addMessage(`📎 ${analyzer.pendingFiles.length} file(s) selected. Continue to Add more files or 'done' to analyze them.`, 'bot');
            } else {
                // If we have analysis results (e.g., after a report has been generated),
                // forward the user message to the Groq fallback instead of showing a static message.
                if (window.analysisResults_COMBINED && window.analysisResults_COMBINED.length > 0) {
                // ----- Forward to Groq fallback, using the stored analysis context -----
                let groqPrompt = message;
                // Append the stored analysis context so the model sees it
                const context = JSON.stringify(window.analysisResults_COMBINED, null, 2);
                groqPrompt += `\n\n---\nPrevious analysis context (files that were analyzed):\n${context}\n---\n`;
                try {
                    const response = await fetch('/api/groq/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileContent: groqPrompt,
                            fileName: 'user_prompt',
                            mimeType: 'text/plain'
                        })
                    });
                    const data = await response.json();
                    const reply = data.analysis || 'No response from AI.';

                    // Keep the flag false so the reply is allowed
                    analyzer.reportGenerated = false;

                    analyzer.displayOutput(reply);
                    analyzer.addMessage(`Chatbot: ${reply}`, 'bot');
                } catch (err) {
                    console.error('Groq fallback error', err);
                    analyzer.displayOutput('Sorry, I could not get a response from the AI.');
                }
                } else {
                    analyzer.addMessage('No files selected. Please upload files first.', 'bot');
                }
            }
        });
    }
});

// --- Ensure docx is loaded before using ---
function ensureDocxLoaded() {
    if (!window.docx) {
        throw new Error('docx library is not loaded.');
    }
}

// --- Generate Word Report function ---
function generateWordReport(analysisResults) {
    ensureDocxLoaded();
    const docx = window.docx;
    analysisResults = analysisResults || window.analysisResults_COMBINED || [];
    if (!analysisResults.length) {
        alert('No analysis results available for report generation.');
        return;
    }

    // Build the document
    // Map each file to an array of paragraphs (for PCAP) or a single paragraph (other files), then flatten
    const fileParagraphs = analysisResults.flatMap(file => {
        // Detect PCAP files by extension or MIME type
        const isPCAP = (file.fileName && file.fileName.match(/\.(pcap|pcapng)$/i)) ||
            (file.mimeType && /pcap/.test(file.mimeType));
        if (isPCAP) {
            // For PCAP, aiAnalysis now includes the full formatted report
            const aiBlock = file.aiAnalysis || 'PCAP analysis completed successfully';
            const contentBlocks = aiBlock.split('\n\n').filter(block => block.trim());
            const contentParagraphs = contentBlocks.map(block => {
                if (block.includes('|') && block.includes('---')) {
                    // Simple table detection and creation
                    const lines = block.split('\n').filter(line => line.trim());
                    if (lines.length >= 2) {
                        const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
                        const rows = lines.slice(2).map(line => line.split('|').map(cell => cell.trim()).filter(cell => cell));
                        if (headers.length > 0 && rows.length > 0) {
                            const table = new docx.Table({
                                rows: [
                                    new docx.TableRow({
                                        children: headers.map(header => new docx.TableCell({
                                            children: [new docx.Paragraph(header)]
                                        }))
                                    }),
                                    ...rows.map(row => new docx.TableRow({
                                        children: row.map(cell => new docx.TableCell({
                                            children: [new docx.Paragraph(cell)]
                                        }))
                                    }))
                                ]
                            });
                            return table;
                        }
                    }
                }
                return new docx.Paragraph(block.trim());
            });
            return [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: '🔍 PCAP NETWORK TRAFFIC ANALYSIS', bold: true })
                    ]
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: '======================================================================' })
                    ]
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: `✅ Analysis Complete for: ${file.fileName}` })
                    ]
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: '──────────────────────────────────────────────────────────────────────' })
                    ]
                }),
                ...contentParagraphs,
                new docx.Paragraph('') // Blank line for spacing
            ].filter(Boolean);
        } else {
            // Default block for other files
            return [new docx.Paragraph({
                children: [
                    new docx.TextRun({ text: `File: ${file.fileName}`, bold: true }),
                    new docx.TextRun({ text: `\nType: ${file.mimeType}` }),
                    new docx.TextRun({ text: `\nSize: ${file.fileSize} bytes` }),
                    new docx.TextRun({ text: `\nAI Analysis: ${file.aiAnalysis || 'N/A'}` }),
                    new docx.TextRun({ text: `\nStego Analysis: ${file.stegoAiAnalysis || 'N/A'}` }),
                    new docx.TextRun({ text: `\nError: ${file.error || 'None'}` }),
                    new docx.TextRun({ text: '\n-----------------------------' })
                ]
            })];
        }
    });

    const doc = new docx.Document({
        sections: [
            {
                properties: {},
                children: [
                    new docx.Paragraph({
                        text: 'Digital Forensics Lab - Evidence Analysis Report',
                        heading: docx.HeadingLevel.HEADING_1,
                        alignment: docx.AlignmentType.CENTER
                    }),
                    new docx.Paragraph({
                        text: `Report generated: ${new Date().toLocaleString()}`,
                        spacing: { after: 300 }
                    }),
                    ...fileParagraphs
                ]
            }
        ]
    });

      docx.Packer.toBlob(doc).then(blob => {
          // ---- 2a. Create a temporary URL for the download ----
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href   = url;
          a.download = `Forensic_Evidence_Report_${Date.now()}.docx`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          }, 100);

          const reader = new zip.Iterator(blob);
          let documentXml = '';

          while (!reader.isDone()) {
              const file = reader.getNext();
              if (file.filename === 'word/document.xml') {
                  const data = new Uint8Array(file.content);
                  const hex  = Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
                  // Convert hex back to a string (the XML is UTF‑8)
                  documentXml = decodeURIComponent(
                      hex.match(/.{2}/g).map(byte => `%${byte}`).join('')
                  );
                  break; // we only need the first occurrence
              }
              reader.advance();
          }

          if (documentXml) {
              // Very simple extract: grab text between <w:t> … </w:t> tags
              const plain = documentXml.replace(/<\/?[^>]+(>|$)/g, '')      // remove all tags
                                        .replace(/\s+/g, ' ')                // collapse whitespace
                                        .trim();
              // Store it globally – this will be the source for later Q&A
              window._lastReportText = plain;
              window._reportGeneratedAt = Date.now();
          } else {
              console.warn('Could not locate document.xml inside generated .docx');
          }

      });
}

// Attach to window for global access
window.generateWordReport = generateWordReport;
window.ensureDocxLoaded = ensureDocxLoaded;
