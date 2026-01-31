class FileAnalyzer {
    constructor() {
        this.uploadedFiles = [];
        this.protectedFiles = [];
        this.hashFiles = [];
        this.volatilityOutput = null; // Store volatility output for flowise
        this.analysisData = null; // Store analysis data for report generation
        this.analysisComplete = false; // Track analysis completion
        this.initializeElements();
        this.attachEventListeners();
        this.loadExistingFiles();
        this.loadExistingProtectedFiles();
        this.loadExistingHashes();
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.protectedFileInput = document.getElementById('protectedFileInput');
        this.fileList = document.getElementById('fileList');
        this.protectedFileList = document.getElementById('protectedFileList');
        this.hashList = document.getElementById('hashList');
        this.outputArea = document.getElementById('outputArea');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.saveReportBtn = document.getElementById('saveReportBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.protectedFileInput.addEventListener('change', (e) => this.handleProtectedFileUpload(e));
        this.analyzeBtn.addEventListener('click', () => this.analyzeFiles());
        this.saveReportBtn.addEventListener('click', () => this.saveReportToWord());
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

    loadExistingProtectedFiles() {
        fetch('/api/protected-files')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.files.length > 0) {
                    data.files.forEach(file => {
                        this.protectedFiles.push({
                            name: file.name,
                            size: file.sizeKB,
                            filename: file.name
                        });
                    });
                    this.updateProtectedFileList();
                }
            })
            .catch(error => {
                console.error('Error loading existing protected files:', error);
            });
    }

    loadExistingHashes() {
        fetch('/api/hashes')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.hashes.length > 0) {
                    data.hashes.forEach(hash => {
                        // Check if hash file already exists in array to prevent duplicates
                        const isDuplicate = this.hashFiles.some(h => h.name === hash.name);
                        if (!isDuplicate) {
                            this.hashFiles.push({
                                name: hash.name,
                                size: hash.sizeKB,
                                filename: hash.name
                            });
                        }
                    });
                    this.updateHashList();
                }
            })
            .catch(error => {
                console.error('Error loading existing hashes:', error);
            });
    }

    handleFileUpload(event) {
        const files = event.target.files;
        
        if (files.length === 0) return;

        this.displayOutput(`⏳ Uploading ${files.length} file(s)...`);
        this.showProgress();

        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }

        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                this.updateProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    data.files.forEach(file => {
                        this.uploadedFiles.push({
                            name: file.name,
                            size: (file.size / 1024).toFixed(2),
                            type: file.filename,
                            filename: file.filename
                        });
                    });
                    this.updateFileList();
                    this.displayOutput(`✅ ${files.length} file(s) uploaded successfully!\n\nClick "Analyze Uploaded Files" to process them.`);
                } else {
                    this.displayOutput(`❌ Upload failed: ${data.error}`);
                }
            } else {
                this.displayOutput(`❌ Upload failed with status ${xhr.status}`);
            }
            this.hideProgress();
            this.fileInput.value = '';
        });

        xhr.addEventListener('error', () => {
            console.error('Upload error:', xhr.status);
            this.displayOutput(`❌ Upload error: Network request failed`);
            this.hideProgress();
            this.fileInput.value = '';
        });

        xhr.open('POST', '/api/upload-multiple');
        xhr.send(formData);
    }

    handleProtectedFileUpload(event) {
        const files = event.target.files;
        
        if (files.length === 0) return;

        this.displayOutput(`⏳ Uploading ${files.length} protected file(s)...`);
        this.showProgress();

        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }

        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                this.updateProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    data.files.forEach(file => {
                        this.protectedFiles.push({
                            name: file.name,
                            size: (file.size / 1024).toFixed(2),
                            filename: file.filename
                        });
                    });
                    this.updateProtectedFileList();
                    this.displayOutput(`✅ ${files.length} protected file(s) uploaded successfully!\n📌 Click "Analyze uploaded files" to crack passwords.`);
                } else {
                    this.displayOutput(`❌ Upload failed: ${data.error}`);
                }
            } else {
                this.displayOutput(`❌ Upload failed with status ${xhr.status}`);
            }
            this.hideProgress();
            this.protectedFileInput.value = '';
        });

        xhr.addEventListener('error', () => {
            console.error('Upload error:', xhr.status);
            this.displayOutput(`❌ Upload error: Network request failed`);
            this.hideProgress();
            this.protectedFileInput.value = '';
        });

        xhr.open('POST', '/api/upload-protected');
        xhr.send(formData);
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
        
        if (this.uploadedFiles.length === 0) {
            this.fileList.innerHTML = '<p style="color: #999; font-size: 12px;">No files uploaded yet</p>';
            return;
        }

        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>
                    <strong>${file.name}</strong><br>
                    <small>${file.size} KB</small>
                </span>
                <button onclick="analyzer.removeFile(${index})">×</button>
            `;
            this.fileList.appendChild(fileItem);
        });
    }

    updateProtectedFileList() {
        this.protectedFileList.innerHTML = '';
        
        if (this.protectedFiles.length === 0) {
            this.protectedFileList.innerHTML = '<p style="color: #999; font-size: 12px;">No protected files added yet</p>';
            return;
        }

        this.protectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>
                    <strong>${file.name}</strong><br>
                    <small>${file.size} KB</small>
                </span>
                <button onclick="analyzer.removeProtectedFile(${index})">×</button>
            `;
            this.protectedFileList.appendChild(fileItem);
        });
    }

    updateHashList() {
        this.hashList.innerHTML = '';
        
        if (this.hashFiles.length === 0) {
            this.hashList.innerHTML = '<p style="color: #999; font-size: 12px;">No hash files generated yet</p>';
            return;
        }

        this.hashFiles.forEach((hash, index) => {
            const hashItem = document.createElement('div');
            hashItem.className = 'file-item';
            hashItem.innerHTML = `
                <span>
                    <strong>${hash.name}</strong><br>
                    <small>${hash.size} KB</small>
                </span>
                <div style="display: flex; gap: 5px;">
                    <button onclick="analyzer.crackPassword('${hash.name}')" style="background: #4CAF50; padding: 4px 8px; font-size: 11px;">🔓</button>
                    <button onclick="analyzer.removeHash(${index})" style="background: #ff6b6b; padding: 4px 8px; font-size: 11px;">×</button>
                </div>
            `;
            this.hashList.appendChild(hashItem);
        });
    }

    displayOutput(content) {
        this.outputArea.textContent = content;
        this.outputArea.scrollTop = 0;
    }

    autoProcessProtectedFiles() {
        fetch('/api/auto-process-protected-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let output = this.outputArea.textContent;
                output += '\n\n' + '='.repeat(70) + '\n';
                output += '🔓 PASSWORD CRACKING RESULTS\n';
                output += '='.repeat(70) + '\n\n';

                data.results.forEach(result => {
                    output += `📄 File: ${result.filename}\n`;
                    
                    if (result.success) {
                        output += `✅ Hash generated: ${result.hashFile}\n`;
                        output += `🔨 Tool used: ${result.hashTool}\n`;
                        
                        if (result.crackedPassword) {
                            output += `\n🔑 PASSWORD FOUND: ${result.crackedPassword}\n`;
                        }
                        
                        output += `\n📋 Show Output:\n`;
                        output += result.showOutput + '\n';
                    } else {
                        output += `❌ Error: ${result.error}\n`;
                        if (result.hashOutput) {
                            output += `Hash Output: ${result.hashOutput}\n`;
                        }
                    }
                    output += '\n' + '-'.repeat(70) + '\n';
                });

                this.displayOutput(output);
                this.loadExistingHashes(); // Refresh hash list
            } else {
                this.displayOutput(this.outputArea.textContent + `\n\n❌ Auto-processing failed: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Auto-process error:', error);
            this.displayOutput(this.outputArea.textContent + `\n\n❌ Error: ${error.message}`);
        })
        .finally(() => {
            this.analyzeBtn.disabled = false;
        });
    }

    analyzeFiles() {
        if (this.uploadedFiles.length === 0 && this.protectedFiles.length === 0) {
            this.displayOutput('❌ No files uploaded yet. Please upload files first.');
            return;
        }

        this.analyzeBtn.disabled = true;
        
        if (this.uploadedFiles.length > 0) {
            this.displayOutput(`⏳ Analyzing ${this.uploadedFiles.length} file(s)...\n\nIdentifying file types and extracting metadata...`);

            fetch('/api/analyze', {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    this.displayAnalysisResults(data.analysis);
                    
                    // Check for memory dump files and run volatility if found
                    const memDumpFiles = data.analysis.files.filter(f => f.type === 'MEMDUMP');
                    if (memDumpFiles.length > 0) {
                        this.runVolatilityAnalysis(memDumpFiles);
                    }
                } else {
                    this.displayOutput(`❌ Analysis failed: ${data.error}`);
                }
            })
            .catch(error => {
                console.error('Analysis error:', error);
                this.displayOutput(`❌ Analysis error: ${error.message}`);
            })
            .finally(() => {
                // Also process protected files if any exist
                if (this.protectedFiles.length > 0) {
                    this.displayOutput(this.outputArea.textContent + '\n\n⏳ Processing protected files with John...');
                    this.autoProcessProtectedFiles();
                } else {
                    this.analyzeBtn.disabled = false;
                }
            });
        } else if (this.protectedFiles.length > 0) {
            // Only protected files, process them directly
            this.displayOutput(`⏳ Processing ${this.protectedFiles.length} protected file(s) with John...\n\nGenerating hashes and cracking passwords...`);
            this.autoProcessProtectedFiles();
        }
    }

    runVolatilityAnalysis(memDumpFiles) {
        let output = '\n\n' + '='.repeat(70) + '\n';
        output += '💾 VOLATILITY 3 MEMORY ANALYSIS\n';
        output += '='.repeat(70) + '\n\n';
        
        memDumpFiles.forEach((file, index) => {
            output += `⏳ Analyzing: ${file.originalName}\n`;
        });
        
        this.displayOutput(this.outputArea.textContent + output);

        // Process each memory dump file
        memDumpFiles.forEach((file, index) => {
            fetch('/api/volatility/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.filename,
                    plugin: 'windows.pstree'
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                let resultOutput = this.outputArea.textContent;
                
                // Remove the loading indicator for this file
                resultOutput = resultOutput.replace(
                    `⏳ Analyzing: ${file.originalName}\n`,
                    ''
                );
                
                if (data.success) {
                    // Store the output in the variable for flowise
                    this.volatilityOutput = data.output;
                    
                    resultOutput += `✅ Analysis Complete for: ${file.originalName}\n`;
                    resultOutput += `Plugin: ${data.plugin}\n`;
                    resultOutput += `${'─'.repeat(70)}\n`;
                    resultOutput += `RAW OUTPUT:\n${data.output || '(No output)'}\n`;
                    resultOutput += `${'─'.repeat(70)}\n`;
                    
                    // Display Flowise AI Analysis if available
                    if (data.flowiseAnalysis) {
                        console.log('Flowise response:', data.flowiseAnalysis);
                        resultOutput += `\n🤖 AI ANALYSIS (Flowise)\n`;
                        resultOutput += `${'─'.repeat(70)}\n`;
                        // Handle different Flowise response formats
                        const analysisText = data.flowiseAnalysis.text || 
                                          data.flowiseAnalysis.answer || 
                                          data.flowiseAnalysis.output ||
                                          data.flowiseAnalysis.result ||
                                          data.flowiseAnalysis.message ||
                                          data.flowiseAnalysis.data?.text ||
                                          JSON.stringify(data.flowiseAnalysis);
                        resultOutput += analysisText;
                        resultOutput += `\n${'─'.repeat(70)}\n`;
                    } else {
                        console.log('No Flowise analysis received');
                    }
                } else {
                    resultOutput += `❌ Analysis Failed for: ${file.originalName}\n`;
                    resultOutput += `Error: ${data.error || 'Unknown error'}\n`;
                    if (data.output && data.output.trim()) {
                        resultOutput += `Output:\n${data.output}\n`;
                    }
                }
                
                this.displayOutput(resultOutput);
            })
            .catch(error => {
                console.error('Volatility error:', error);
                let resultOutput = this.outputArea.textContent;
                
                // Remove the loading indicator for this file
                resultOutput = resultOutput.replace(
                    `⏳ Analyzing: ${file.originalName}\n`,
                    ''
                );
                
                resultOutput += `❌ Volatility error for ${file.originalName}: ${error.message}\n`;
                this.displayOutput(resultOutput);
            });
        });
    }

    displayAnalysisResults(analysis) {
        this.analysisData = analysis;
        this.analysisComplete = true;
        this.saveReportBtn.disabled = false;
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
                
                // Display VirusTotal results if available
                if (file.virusTotal && file.virusTotal.scanned) {
                    output += `\n     🛡️ VirusTotal Scan Results:\n`;
                    output += `        Analysis ID: ${file.virusTotal.analysisId}\n`;
                    output += `        SHA256: ${file.virusTotal.sha256 || 'N/A'}\n`;
                    output += `        MD5: ${file.virusTotal.md5 || 'N/A'}\n`;
                    output += `        SHA1: ${file.virusTotal.sha1 || 'N/A'}\n`;
                    output += `        Status: ${file.virusTotal.status}\n`;
                    
                    if (file.virusTotal.stats) {
                        output += `        Detection Stats:\n`;
                        output += `          - Malicious: ${file.virusTotal.stats.malicious || 0}\n`;
                        output += `          - Undetected: ${file.virusTotal.stats.undetected || 0}\n`;
                        output += `          - Suspicious: ${file.virusTotal.stats.suspicious || 0}\n`;
                    }
                    
                    if (file.virusTotal.resultsUrl) {
                        output += `        Results URL: ${file.virusTotal.resultsUrl}\n`;
                    }
                } else if (file.virusTotal && !file.virusTotal.scanned) {
                    output += `\n     🛡️ VirusTotal: Not Scanned\n`;
                    output += `        Reason: ${file.virusTotal.reason}\n`;
                }
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

    removeHash(index) {
        const hash = this.hashFiles[index];
        
        fetch(`/api/hashes/${hash.filename}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.hashFiles.splice(index, 1);
                this.updateHashList();
                this.displayOutput(`🗑️ Hash file "${hash.name}" removed successfully.`);
            } else {
                this.displayOutput(`❌ Failed to delete hash file: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            this.displayOutput(`❌ Delete error: ${error.message}`);
        });
    }

    removeProtectedFile(index) {
        const file = this.protectedFiles[index];
        
        fetch(`/api/protected-files/${file.filename}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.protectedFiles.splice(index, 1);
                this.updateProtectedFileList();
                this.displayOutput(`🗑️ Protected file "${file.name}" removed successfully.`);
            } else {
                this.displayOutput(`❌ Failed to delete protected file: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            this.displayOutput(`❌ Delete error: ${error.message}`);
        });
    }

    crackPassword(hashFilename) {
        let output = this.outputArea.textContent;
        output += `\n\n` + '='.repeat(70) + '\n';
        output += `🔓 PASSWORD CRACKING (John the Ripper)\n`;
        output += '='.repeat(70) + '\n\n';
        output += `⏳ Cracking: ${hashFilename}\n`;
        output += `Wordlist: rockyou.txt\n`;
        output += `${'─'.repeat(70)}\n`;
        
        this.displayOutput(output);

        fetch('/api/john/crack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hashFilename: hashFilename
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            let resultOutput = this.outputArea.textContent;
            
            // Remove loading indicator
            resultOutput = resultOutput.replace(
                `⏳ Cracking: ${hashFilename}\nWordlist: rockyou.txt\n${'─'.repeat(70)}\n`,
                ''
            );

            if (data.success) {
                resultOutput += `✅ Cracking Results for: ${data.hashFile}\n`;
                resultOutput += `${'─'.repeat(70)}\n`;
                
                if (data.crackedPassword) {
                    resultOutput += `🔑 PASSWORD FOUND: ${data.crackedPassword}\n`;
                    resultOutput += `\n📋 Full Output:\n`;
                }
                
                resultOutput += data.showOutput || data.output || '';
                resultOutput += `\n${'─'.repeat(70)}\n`;
            } else {
                resultOutput += `❌ Cracking Failed for: ${data.hashFile}\n`;
                resultOutput += `Error: ${data.error}\n`;
                if (data.output) {
                    resultOutput += `Output: ${data.output}\n`;
                }
            }
            
            this.displayOutput(resultOutput);
        })
        .catch(error => {
            console.error('John the Ripper error:', error);
            let resultOutput = this.outputArea.textContent;
            
            // Remove loading indicator
            resultOutput = resultOutput.replace(
                `⏳ Cracking: ${hashFilename}\nWordlist: rockyou.txt\n${'─'.repeat(70)}\n`,
                ''
            );
            
            resultOutput += `❌ Error executing John the Ripper: ${error.message}\n`;
            this.displayOutput(resultOutput);
        });
    }

    saveReportToWord() {
        if (!this.analysisComplete || !this.analysisData) {
            this.displayOutput(this.outputArea.textContent + `\n\n❌ No analysis data to save. Please run analysis first.`);
            return;
        }

        this.saveReportBtn.disabled = true;
        const reportContent = this.outputArea.textContent;

        fetch('/api/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: reportContent,
                timestamp: Date.now()
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Forensic_Evidence_Report_${Date.now()}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.displayOutput(this.outputArea.textContent + `\n\n✅ Report saved as Forensic_Evidence_Report_${Date.now()}.docx`);
        })
        .catch(error => {
            console.error('Report generation error:', error);
            this.displayOutput(this.outputArea.textContent + `\n\n❌ Error generating report: ${error.message}`);
        })
        .finally(() => {
            this.saveReportBtn.disabled = false;
        });
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

ensureStylesheetLoaded();

let analyzer;
document.addEventListener('DOMContentLoaded', () => {
    analyzer = new FileAnalyzer();
});
