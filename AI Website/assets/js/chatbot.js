// Chatbot.js
// Flowise Cloud integration with Groq (no authentication)
// Replace CHATFLOW_ID with your Flowise chatflow ID

// -----------------------------
// File type recognition
// -----------------------------
function getFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const typeMap = {
    // Microsoft Office
    'xlsx': 'Microsoft Excel',
    'xls': 'Microsoft Excel',
    'docx': 'Microsoft Word',
    'doc': 'Microsoft Word',
    'pptx': 'Microsoft PowerPoint',
    'ppt': 'Microsoft PowerPoint',
    
    // Forensic Files
    'pcapng': 'Packet Capture',
    'pcap': 'Packet Capture',
    'mem': 'Memory Dump',
    'dmp': 'Memory Dump',
    'vmem': 'Virtual Machine Memory Dump',
    'mans': 'Unix Manual Page File',
    'raw': 'Raw Disk Image',
    'dd': 'Disk Image',
    'e01': 'EnCase Evidence File',
    'aff': 'Advanced Forensic Format',
    
    // Archives
    'zip': 'ZIP Archive',
    'rar': 'RAR Archive',
    '7z': '7-Zip Archive',
    'tar': 'TAR Archive',
    'gz': 'GZIP Archive',
    
    // Images
    'jpg': 'JPEG Image',
    'jpeg': 'JPEG Image',
    'png': 'PNG Image',
    'gif': 'GIF Image',
    'bmp': 'Bitmap Image',
    
    // Documents
    'pdf': 'PDF Document',
    'txt': 'Text File',
    'csv': 'CSV File',
    'json': 'JSON File',
    'xml': 'XML File',
    
    // Logs
    'log': 'Log File',
    'evtx': 'Windows Event Log',
    'evt': 'Windows Event Log',
    
    // Executables
    'exe': 'Executable',
    'dll': 'Dynamic Link Library',
    'sys': 'System File'
  };
  
  return typeMap[ext] || 'Unknown File Type';
}

// -----------------------------
// MIME type recognition
// -----------------------------
function getMimeType(ext) {
  const map = {
    // Text / code
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'md': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
    'js': 'application/javascript',
    'css': 'text/css',

    // Microsoft Documents
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',

    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',

    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',

    // Forensic / binaries (best-effort)
    'pcapng': 'application/x-pcapng',
    'pcap': 'application/x-pcap',
    'mem': 'application/octet-stream',
    'dmp': 'application/octet-stream',
    'vmem': 'application/octet-stream',
    'raw': 'application/octet-stream',
    'dd': 'application/octet-stream',
    'e01': 'application/octet-stream',
    'aff': 'application/octet-stream',

    // Executables
    'exe': 'application/vnd.microsoft.portable-executable',
    'dll': 'application/vnd.microsoft.portable-executable',
    'sys': 'application/octet-stream'
  };
  return map[ext] || 'application/octet-stream';
}

// -----------------------------
// Query function to Flowise API
// -----------------------------
async function query(data) {
  try {
    const payload = {
      question: data.question,
      overrideConfig: {
        vars: {
          zipFileNames: data.zipFileNames || [],
          zipFileMetadata: data.zipFileMetadata || []
        }
      }
    };

    console.log('🔍 [QUERY] Preparing POST request');
    console.log('📤 [QUERY] Question:', data.question);
    console.log('📤 [QUERY] ZipFileNames type:', typeof data.zipFileNames, 'Length:', data.zipFileNames?.length);
    console.log('📤 [QUERY] ZipFileMetadata type:', typeof data.zipFileMetadata, 'Length:', data.zipFileMetadata?.length);
    console.log('📤 [QUERY] Full Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(
      "https://cloud.flowiseai.com/api/v1/prediction/f3cf608d-4877-4933-a08f-5075ca8017ca",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    console.log('📥 [QUERY] Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [QUERY] HTTP Error Response:', errorText);
      if (errorText.includes("Predictions limit exceeded")) {
        return {
          error: "Flowise quota exceeded. Here's a mock response for classroom testing.",
          evidenceSummary: (data.zipFileNames || []).map(name => ({
            filename: name,
            type: "MockType",
            contents: "This is a simulated analysis of the file."
          }))
        };
      }
      throw new Error(`Flowise error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [QUERY] Success Response received');

    // Defensive post-processing (Option A), but do not force empty if we have filenames
    const filenames = Array.isArray(data.zipFileNames) ? data.zipFileNames : [];

    // If shape missing, construct a compliant wrapper with either Unknown entries or []
    if (
      !result ||
      typeof result !== "object" ||
      !result.message ||
      typeof result.message.content !== "string"
    ) {
      const fallbackSummary = filenames.length
        ? filenames.map(name => ({ filename: name, type: getFileType(name), contents: getFileType(name) }))
        : [];
      return {
        message: {
          content: JSON.stringify({ evidenceSummary: fallbackSummary })
        }
      };
    }

    // Validate that content is parseable JSON
    try {
      const parsed = JSON.parse(result.message.content);
      // If evidenceSummary is missing or not an array, repair based on filenames
      if (!Array.isArray(parsed.evidenceSummary)) {
        parsed.evidenceSummary = filenames.length
          ? filenames.map(name => ({ filename: name, type: getFileType(name), contents: getFileType(name) }))
          : [];
        return { message: { content: JSON.stringify(parsed) } };
      }
      // If the array is empty but we have filenames, fill Unknown entries
      if (parsed.evidenceSummary.length === 0 && filenames.length > 0) {
        parsed.evidenceSummary = filenames.map(name => ({
          filename: name,
          type: getFileType(name),
          contents: getFileType(name)
        }));
        return { message: { content: JSON.stringify(parsed) } };
      }
    } catch {
      const fallbackSummary = filenames.length
        ? filenames.map(name => ({ filename: name, type: getFileType(name), contents: getFileType(name) }))
        : [];
      return {
        message: {
          content: JSON.stringify({ evidenceSummary: fallbackSummary })
        }
      };
    }

    return result;
  } catch (err) {
    console.error('❌ [QUERY] Exception thrown:', err.message);
    return { error: err.message };
  }
}

// -----------------------------
// Markdown rendering helper
// -----------------------------
function renderMarkdown(md) {
  if (window.marked) {
    return window.marked.parse(md);
  }
  let html = String(md || "")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  return html;
}

// -----------------------------
// Structured output validator
// -----------------------------
function validateEvidenceSummary(data) {
  return Array.isArray(data?.evidenceSummary) &&
    data.evidenceSummary.every(item =>
      item &&
      typeof item.filename === "string" &&
      typeof item.type === "string" &&
      typeof item.contents === "string"
    );
}

// -----------------------------
// Defensive JSON parser for Flowise shapes
// -----------------------------
function tryParseAnyJson(obj) {
  if (!obj) return null;
  if (validateEvidenceSummary(obj)) return obj;

  if (typeof obj.text === "string") {
    try { return JSON.parse(obj.text); } catch {}
  }
  if (typeof obj?.message?.content === "string") {
    try { return JSON.parse(obj.message.content); } catch {}
  }
  if (typeof obj.answer === "string") {
    try { return JSON.parse(obj.answer); } catch {}
  }

  if (obj?.message?.content && typeof obj.message.content === "object" && validateEvidenceSummary(obj.message.content)) {
    return obj.message.content;
  }

  return null;
}

// -----------------------------
// Client-Side File Analysis
// -----------------------------
async function analyzeFileContent(file, metadata) {
  const results = [];
  
  try {
    // Load libraries if needed
    await ensureLibrariesLoaded();
    
    // Excel file analysis (.xlsx and .xls)
    if (metadata.type === 'Microsoft Excel') {
      console.log('📊 Analyzing Excel file:', metadata.filename);
      const ext = metadata.filename.toLowerCase().split('.').pop();
      const workbook = XLSX.read(file, { type: 'array' });
      
      results.push(`📊 Excel Analysis: ${metadata.filename}`);
      if (ext === 'xls') {
        results.push(`  - Format: Legacy Excel 97-2003 (.xls)`);
      } else {
        results.push(`  - Format: Modern Excel (.xlsx)`);
      }
      results.push(`  - Total Sheets: ${workbook.SheetNames.length}`);
      results.push(`  - Sheet Names: ${workbook.SheetNames.join(', ')}`);
      
      // Analyze each sheet
      workbook.SheetNames.forEach((sheetName, idx) => {
        const sheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;
        const colCount = range.e.c - range.s.c + 1;
        
        results.push(`\n  Sheet ${idx + 1}: "${sheetName}"`);
        results.push(`    - Dimensions: ${rowCount} rows × ${colCount} columns`);
        results.push(`    - Range: ${sheet['!ref'] || 'Empty'}`);
        
        // Extract sample data from first few rows
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (jsonData.length > 0) {
          results.push(`    - Headers: ${JSON.stringify(jsonData[0]).substring(0, 100)}...`);
          if (jsonData.length > 1) {
            results.push(`    - Sample Row 2: ${JSON.stringify(jsonData[1]).substring(0, 100)}...`);
          }
          results.push(`    - Total Data Rows: ${jsonData.length - 1}`);
        }
      });
    }
    
    // Word file analysis (.docx and .doc)
    else if (metadata.type === 'Microsoft Word') {
      console.log('📝 Analyzing Word file:', metadata.filename);
      const ext = metadata.filename.toLowerCase().split('.').pop();
      
      if (typeof mammoth !== 'undefined') {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: file });
          const text = result.value;
          
          if (text && text.length > 0) {
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            const charCount = text.length;
            const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0).length;
            
            results.push(`📝 Word Analysis: ${metadata.filename}`);
            if (ext === 'doc') {
              results.push(`  - Format: Legacy Word 97-2003 (.doc)`);
            } else {
              results.push(`  - Format: Modern Word (.docx)`);
            }
            results.push(`  - Word Count: ${wordCount}`);
            results.push(`  - Character Count: ${charCount}`);
            results.push(`  - Paragraphs: ${paragraphs}`);
            results.push(`\n  Content Preview (first 500 chars):`);
            results.push(`  "${text.substring(0, 500).trim()}..."`);
            
            // Basic keyword analysis
            const keywords = extractKeywords(text);
            if (keywords.length > 0) {
              results.push(`\n  Top Keywords: ${keywords.slice(0, 10).join(', ')}`);
            }
            
            // Additional analysis for suspicious patterns
            const suspiciousPatterns = detectSuspiciousPatterns(text);
            if (suspiciousPatterns.length > 0) {
              results.push(`\n  ⚠️ Potential Items of Interest:`);
              suspiciousPatterns.forEach(pattern => {
                results.push(`    - ${pattern}`);
              });
            }
          } else {
            results.push(`📝 Word file: ${metadata.filename}`);
            results.push(`  - Format: ${ext === 'doc' ? 'Legacy Word (.doc)' : 'Modern Word (.docx)'}`);
            results.push(`  - File Size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`);
            results.push(`  - ⚠️ No text content could be extracted`);
            if (ext === 'doc') {
              results.push(`  - Note: Legacy .doc files may have limited parsing support`);
            }
          }
        } catch (err) {
          console.error('Error parsing Word document:', err);
          results.push(`📝 Word file: ${metadata.filename}`);
          results.push(`  - Format: ${ext === 'doc' ? 'Legacy Word (.doc)' : 'Modern Word (.docx)'}`);
          results.push(`  - File Size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`);
          results.push(`  - ⚠️ Error extracting content: ${err.message}`);
        }
      } else {
        results.push(`📝 Word file detected: ${metadata.filename} (${metadata.sizeBytes} bytes)`);
        results.push(`  - Binary content analysis not available`);
      }
    }
    
    // PowerPoint analysis (.pptx)
    else if (metadata.type === 'Microsoft PowerPoint') {
      console.log('📽️ Analyzing PowerPoint file:', metadata.filename);
      const ext = metadata.filename.toLowerCase().split('.').pop();
      
      if (ext === 'pptx') {
        try {
          // .pptx is a ZIP file containing XML
          const pptZip = await JSZip.loadAsync(file);
          const slides = [];
          let slideTexts = [];
          
          // Extract slide content
          const slideFiles = Object.keys(pptZip.files).filter(name => 
            name.match(/ppt\/slides\/slide\d+\.xml$/)
          );
          
          results.push(`📽️ PowerPoint Analysis: ${metadata.filename}`);
          results.push(`  - Total Slides: ${slideFiles.length}`);
          results.push(`  - File Size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`);
          
          // Parse each slide's XML
          for (const slideFile of slideFiles.sort()) {
            const slideXml = await pptZip.file(slideFile).async('text');
            const slideNum = slideFile.match(/slide(\d+)\.xml$/)[1];
            
            // Extract text from XML (simple regex-based extraction)
            const textMatches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
            const texts = textMatches.map(m => m.replace(/<\/?a:t>/g, ''));
            
            if (texts.length > 0) {
              slideTexts.push(`\n    Slide ${slideNum}: "${texts.join(' ').substring(0, 150)}..."`);
              slides.push({ slideNum, textCount: texts.length, text: texts.join(' ') });
            }
          }
          
          if (slides.length > 0) {
            results.push(`  - Slides with text content: ${slides.length}`);
            results.push(`\n  Slide Content Preview:`);
            results.push(...slideTexts.slice(0, 5)); // Show first 5 slides
            
            if (slideTexts.length > 5) {
              results.push(`    ... and ${slideTexts.length - 5} more slides`);
            }
            
            // Count total words across all slides
            const totalWords = slides.reduce((sum, s) => 
              sum + s.text.split(/\s+/).filter(w => w.length > 0).length, 0
            );
            results.push(`\n  - Total Words Across All Slides: ${totalWords}`);
          } else {
            results.push(`  - No text content extracted from slides`);
          }
          
        } catch (err) {
          console.error('Error parsing PPTX:', err);
          results.push(`📽️ PowerPoint file: ${metadata.filename}`);
          results.push(`  - File Size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`);
          results.push(`  - Error extracting slide content: ${err.message}`);
        }
      } else if (ext === 'ppt') {
        // Legacy .ppt format (binary)
        results.push(`📽️ PowerPoint Analysis: ${metadata.filename}`);
        results.push(`  - Format: Legacy Binary PowerPoint (.ppt)`);
        results.push(`  - File Size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`);
        results.push(`  - ⚠️ Legacy .ppt format requires specialized parsing`);
        results.push(`  - Recommendation: Convert to .pptx for full analysis`);
      }
    }
    
  } catch (err) {
    console.error('❌ Error analyzing file:', metadata.filename, err);
    results.push(`❌ Error analyzing ${metadata.filename}: ${err.message}`);
  }
  
  return results.join('\n');
}

// Extract keywords from text
function extractKeywords(text) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);
  
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const wordFreq = {};
  
  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

// Detect suspicious patterns in text (for forensic analysis)
function detectSuspiciousPatterns(text) {
  const patterns = [];
  
  // Check for email addresses
  const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
  if (emails && emails.length > 0) {
    patterns.push(`Found ${emails.length} email address(es): ${[...new Set(emails)].slice(0, 3).join(', ')}${emails.length > 3 ? '...' : ''}`);
  }
  
  // Check for phone numbers
  const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
  if (phones && phones.length > 0) {
    patterns.push(`Found ${phones.length} phone number(s)`);
  }
  
  // Check for URLs
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length > 0) {
    patterns.push(`Found ${urls.length} URL(s): ${[...new Set(urls)].slice(0, 2).join(', ')}${urls.length > 2 ? '...' : ''}`);
  }
  
  // Check for IP addresses
  const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  if (ips && ips.length > 0) {
    patterns.push(`Found ${ips.length} IP address(es): ${[...new Set(ips)].join(', ')}`);
  }
  
  // Check for dates
  const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g);
  if (dates && dates.length > 0) {
    patterns.push(`Found ${dates.length} date reference(s)`);
  }
  
  // Check for credit card patterns (simplified)
  const ccPatterns = text.match(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g);
  if (ccPatterns && ccPatterns.length > 0) {
    patterns.push(`⚠️ ALERT: Possible credit card number patterns detected`);
  }
  
  // Check for SSN patterns
  const ssnPatterns = text.match(/\b\d{3}-\d{2}-\d{4}\b/g);
  if (ssnPatterns && ssnPatterns.length > 0) {
    patterns.push(`⚠️ ALERT: Possible SSN patterns detected`);
  }
  
  // Check for common forensic keywords
  const forensicKeywords = ['password', 'confidential', 'secret', 'private', 'delete', 'evidence', 'hide', 'cover'];
  const foundKeywords = forensicKeywords.filter(kw => text.toLowerCase().includes(kw));
  if (foundKeywords.length > 0) {
    patterns.push(`Found forensically relevant keywords: ${foundKeywords.join(', ')}`);
  }
  
  return patterns;
}

// Ensure required libraries are loaded
async function ensureLibrariesLoaded() {
  // Load SheetJS (xlsx) for Excel parsing
  if (typeof XLSX === 'undefined') {
    console.log('📚 Loading SheetJS library...');
    await loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
    console.log('✅ SheetJS loaded');
  }
  
  // Load mammoth for Word parsing
  if (typeof mammoth === 'undefined') {
    console.log('📚 Loading Mammoth library...');
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
    console.log('✅ Mammoth loaded');
  }
}

// Helper to load external scripts
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// -----------------------------
// Word Document Report Generation (CLIENT-SIDE)
// -----------------------------
async function generateWordReport(zipFileNames, zipFileMetadata) {
  console.log('📄 Generating Word document on client side');
  
  // Get evidenceSummary from Flowise (this already works!)
  const response = await query({ 
    question: "Analyze these files and provide a summary", 
    zipFileNames, 
    zipFileMetadata 
  });
  
  console.log('Flowise response:', response);
  
  // Extract evidenceSummary and analysisResults
  let evidenceSummary = [];
  let analysisResults = [];
  
  if (response?.message?.content) {
    try {
      const parsed = JSON.parse(response.message.content);
      evidenceSummary = parsed.evidenceSummary || [];
      analysisResults = parsed.analysisResults || [];
      console.log('📋 Evidence Summary:', evidenceSummary);
      console.log('📋 Analysis Results:', analysisResults);
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  }
  
  // If no summary from Flowise, use metadata
  if (!evidenceSummary || evidenceSummary.length === 0) {
    evidenceSummary = zipFileMetadata.map(item => ({
      filename: item.filename,
      type: item.type,
      contents: `File type: ${item.type}`
    }));
  }
  
  // ===== NEW: Make follow-up queries for detailed analysis =====
  console.log('🔍 Requesting detailed analysis from AI...');
  
  // Query AI for each Microsoft file
  const microsoftFiles = zipFileMetadata.filter(f => 
    f.type.includes('Microsoft') || f.type.includes('Excel') || f.type.includes('Word') || f.type.includes('PowerPoint')
  );
  
  for (const file of microsoftFiles) {
    try {
      const detailQuery = `Provide a detailed forensic analysis of the file "${file.filename}" which is a ${file.type} file (${(file.sizeBytes / 1024).toFixed(2)} KB). What insights can you provide about its potential contents, purpose, and forensic significance?`;
      
      const detailResponse = await query({
        question: detailQuery,
        zipFileNames: [file.filename],
        zipFileMetadata: [file]
      });
      
      if (detailResponse?.message?.content) {
        analysisResults.push(`\n=== AI Analysis: ${file.filename} ===`);
        analysisResults.push(detailResponse.message.content);
      }
    } catch (err) {
      console.error('Error getting AI analysis for', file.filename, err);
    }
  }
  
  // ===== NEW: Perform client-side analysis =====
  console.log('🔬 Performing client-side file analysis...');
  
  // Re-read the ZIP file to get actual file contents
  const fileInput = document.getElementById('fileInput');
  if (fileInput.files.length > 0) {
    const zipFile = fileInput.files[0];
    
    try {
      await ensureLibrariesLoaded();
      const zip = new JSZip();
      const content = await zip.loadAsync(zipFile);
      
      for (const metadata of zipFileMetadata) {
        const microsoftTypes = ['Microsoft Excel', 'Microsoft Word', 'Microsoft PowerPoint'];
        if (microsoftTypes.includes(metadata.type)) {
          const zipEntry = content.file(metadata.path);
          if (zipEntry) {
            const fileBuffer = await zipEntry.async('arraybuffer');
            const analysis = await analyzeFileContent(fileBuffer, metadata);
            analysisResults.push(`\n=== Client-Side Analysis: ${metadata.filename} ===`);
            analysisResults.push(analysis);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error performing client-side analysis:', err);
      analysisResults.push(`\n⚠️ Client-side analysis partially failed: ${err.message}`);
    }
  }
  
  console.log('📊 Total analysis results collected:', analysisResults.length);
  console.log('Analysis Results:', analysisResults);
  
  // Generate Word document using docx library (CLIENT SIDE!)
  console.log('📄 Checking docx library...');
  console.log('All window properties:', Object.keys(window).slice(0, 50));
  
  // Wait for docx to load if needed
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait half a second for script to load
  
  // Check all possible global names
  let docxLib = window.docx || window.docxjs || window.Docx || window.DOCX;
  
  if (!docxLib) {
    console.error('❌ docx library not found!');
    console.error('All window keys containing "doc":', Object.keys(window).filter(k => k.toLowerCase().includes('doc')));
    console.error('Trying to load docx from script tag...');
    
    // Try to load it dynamically if missing
    if (!document.querySelector('script[src*="docx"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/docx@7.8.2/build/index.js';
      document.head.appendChild(script);
      
      // Wait for it to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      // Check again after loading
      docxLib = window.docx || window.docxjs || window.Docx || window.DOCX;
    }
    
    if (!docxLib) {
      throw new Error('docx library failed to load. Please refresh the page and try again.');
    }
  }
  
  console.log('✅ docx library found:', typeof docxLib);
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docxLib;
  
  // Build document content
  const docChildren = [
    new Paragraph({
      text: 'Evidence Analysis Report',
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleString()}`,
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Files in Evidence:',
      heading: HeadingLevel.HEADING_2
    }),
    ...evidenceSummary.flatMap(item => [
      new Paragraph({
        text: `File: ${item.filename}`,
        heading: HeadingLevel.HEADING_3
      }),
      new Paragraph({
        text: `Type: ${item.type}`
      }),
      new Paragraph({
        text: `Contents: ${item.contents}`
      }),
      new Paragraph({ text: '' })
    ])
  ];
  
  // Add analysis results if available
  if (analysisResults && analysisResults.length > 0) {
    docChildren.push(
      new Paragraph({
        text: 'Detailed Analysis:',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: '' })
    );
    
    analysisResults.forEach(result => {
      const resultText = String(result);
      
      // Handle section headers
      if (resultText.startsWith('===')) {
        docChildren.push(
          new Paragraph({
            text: resultText.replace(/===/g, '').trim(),
            heading: HeadingLevel.HEADING_3
          })
        );
      }
      // Handle bullet points
      else if (resultText.match(/^\s*[-•*]\s/)) {
        docChildren.push(
          new Paragraph({ 
            text: resultText.trim().replace(/^[-•*]\s*/, ''),
            bullet: { level: 0 }
          })
        );
      }
      // Handle regular paragraphs
      else if (resultText.trim()) {
        // Split by newlines to preserve formatting
        const lines = resultText.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            docChildren.push(
              new Paragraph({ text: line.trim() })
            );
          }
        });
      }
      
      docChildren.push(new Paragraph({ text: '' }));
    });
  } else {
    docChildren.push(
      new Paragraph({
        text: 'Detailed Analysis:',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: '' }),
      new Paragraph({ 
        text: 'No detailed analysis results were generated. This may occur if:'
      }),
      new Paragraph({ 
        text: '• The AI service is unavailable or has exceeded quota limits',
        bullet: { level: 0 }
      }),
      new Paragraph({ 
        text: '• The files could not be analyzed automatically',
        bullet: { level: 0 }
      }),
      new Paragraph({ 
        text: '• No Microsoft Office files were present in the evidence',
        bullet: { level: 0 }
      }),
      new Paragraph({ text: '' }),
      new Paragraph({ 
        text: 'Recommendation: Please use the chat interface to ask specific questions about the evidence files.'
      })
    );
  }
  
  const doc = new Document({
    sections: [{
      children: docChildren
    }]
  });
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Evidence_Report.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('✅ Word document generated and downloaded');
  return true;
}

// -----------------------------
// Download Word Document from Base64
// -----------------------------
function downloadWordDocument(base64String, zipFileNames) {
  try {
    console.log('📥 [REPORT] Converting base64 to Word document');
    
    // Convert base64 to binary
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob
    const blob = new Blob([bytes], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.setAttribute('href', url);
    element.setAttribute('download', `Forensic_Evidence_Report_${new Date().getTime()}.docx`);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
    
    console.log('✅ [REPORT] Word document downloaded successfully');
    return true;
  } catch (err) {
    console.error('❌ [REPORT] Error downloading Word document:', err);
    return false;
  }
}

// -----------------------------
// Create Fallback Text Report (Client-side)
// -----------------------------
function createFallbackReport(zipFileNames, zipFileMetadata) {
  try {
    // Create a comprehensive text report
    let reportContent = `FORENSIC EVIDENCE ANALYSIS REPORT
=====================================
Generated: ${new Date().toLocaleString()}

FILES ANALYZED
==============
Total Files: ${zipFileNames.length}

`;

    zipFileMetadata.forEach((file, index) => {
      reportContent += `
[${index + 1}] ${file.filename}
    Type: ${file.type}
    Size: ${(file.sizeBytes / 1024).toFixed(2)} KB (${file.sizeBytes} bytes)
    MIME Type: ${file.mime}
    Location: ${file.path}
    Preview Available: ${file.preview ? 'Yes' : 'No'}
    ${file.preview ? '\n    Content Preview:\n    ' + file.preview.substring(0, 200) + '...' : ''}
`;
    });

    reportContent += `

FORENSIC SUMMARY
================
Analysis Date: ${new Date().toLocaleString()}
Total Files Processed: ${zipFileNames.length}
Report Status: PRELIMINARY EVIDENCE SUMMARY

RECOMMENDATIONS
===============
1. Use the AI chat interface for detailed analysis of individual files
2. Ask specific questions about file contents and metadata
3. Request file type classification and forensic insights
4. For detailed content analysis, inquire about specific file types

NOTE: This is a preliminary summary report. For comprehensive forensic analysis,
please engage with the AI assistant through the chat interface.

END OF REPORT
`;

    // Download as text file
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportContent));
    element.setAttribute('download', 'Evidence_Analysis_Report_' + new Date().getTime() + '.txt');
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    console.log('✅ Report generated and downloaded as .txt');
    return true;
  } catch (err) {
    console.error('❌ Error creating fallback report:', err);
    return false;
  }
}

// -----------------------------
// DOM Ready
// -----------------------------
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messages = document.getElementById("chat-messages");
  const errorDiv = document.getElementById("chat-error");
  const chatbotContainer = document.querySelector(".chatbot-container");
  const minimizeBtn = document.querySelector(".chatbot-minimize-btn");
  const toggleBtn = document.querySelector(".chatbot-toggle-btn");
  const chatbotOpened = localStorage.getItem("chatbotOpened");

  // Keep track of filenames extracted from ZIP
  let zipFileNames = [];
  let zipFileMetadata = [];
  let isProcessingZip = false;

  // Initial state
  if (!chatbotOpened || chatbotOpened === "false") {
    chatbotContainer?.classList.add("minimized");
    toggleBtn?.classList.add("visible");
  } else {
    chatbotContainer?.classList.remove("minimized");
    chatbotContainer?.classList.add("open");
    toggleBtn?.classList.remove("visible");
  }

  // Store current file info for chat display
  let currentFileInfo = null;

  // Form submit (send message)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userMsg = input.value.trim();
    if (!userMsg) return;

    // Block submission if still processing ZIP
    if (isProcessingZip) {
      errorDiv.textContent = "Please wait, still processing uploaded file...";
      return;
    }

    // Create user message with file card if file is attached
    let userMsgHtml = `<div class='chat-msg user'>`;

    if (currentFileInfo) {
      userMsgHtml += `
        <div style="display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; justify-content: flex-start;">
          <div><b>You:</b> ${renderMarkdown(userMsg)}</div>
          <div class="chat-file-card">
            <div class="file-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="file-card-info">
              <div class="file-card-name">${currentFileInfo.name}</div>
              <div class="file-card-type">ZIP Archive</div>
            </div>
          </div>
        </div>
      `;
    } else {
      userMsgHtml += `<b>You:</b> ${renderMarkdown(userMsg)}`;
    }

    userMsgHtml += `</div>`;
    messages.innerHTML += userMsgHtml;
    
    input.value = "";
    errorDiv.textContent = "";
    
    // Store current arrays before clearing display (to preserve for query)
    const preservedFileNames = [...zipFileNames];
    const preservedMetadata = [...zipFileMetadata];
    
    // Clear file display after showing in chat
    if (fileList) {
      fileList.innerHTML = "";
    }
    
    // Restore arrays after clearing display
    zipFileNames = preservedFileNames;
    zipFileMetadata = preservedMetadata;

    // Simple intent: trigger when message contains the word "unzip"
    const unzipIntent = /unzip/i.test(userMsg);
    if (unzipIntent) {
      console.log('🔍 [UNZIP] Unzip intent detected');
      console.log('📊 [UNZIP] Current zipFileNames:', zipFileNames, 'Length:', zipFileNames?.length);
      console.log('📊 [UNZIP] Current zipFileMetadata:', zipFileMetadata, 'Length:', zipFileMetadata?.length);
      
      if (zipFileNames.length === 0) {
        errorDiv.textContent = "Please upload a ZIP first—no filenames found.";
        console.error('❌ [UNZIP] No files to unzip!');
        return;
      }
    }

    // Check if user wants to generate a report
    const reportIntent = /(generate|create|make|build|produce)(\s+me)?(\s+a)?\s+report/i.test(userMsg);
    if (reportIntent) {
      if (zipFileNames.length === 0) {
        errorDiv.textContent = "Please upload a ZIP file first—no files to include in the report.";
        messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> I need you to upload evidence files first to generate a report.</div>`;
        messages.scrollTop = messages.scrollHeight;
        return;
      }

      try {
        messages.innerHTML += `<div class='chat-msg bot' style='color:#888;'>📄 Generating Word document report...</div>`;
        messages.scrollTop = messages.scrollHeight;

        const success = await generateWordReport(zipFileNames, zipFileMetadata);

        messages.innerHTML = messages.innerHTML.replace("📄 Generating Word document report...", "");
        if (success) {
          messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> ✅ Report generated and downloaded successfully! Your Evidence Analysis Report is ready.</div>`;
        } else {
          messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> ❌ Failed to generate report. Please try again.</div>`;
          errorDiv.textContent = "Report generation failed. Please check the console for details.";
        }
        messages.scrollTop = messages.scrollHeight;
        return;
      } catch (err) {
        messages.innerHTML = messages.innerHTML.replace("📄 Generating Word document report...", "");
        errorDiv.textContent = `Report error: ${err.message}`;
        messages.scrollTop = messages.scrollHeight;
      }
    }

    try {
      messages.innerHTML += `<div class='chat-msg bot' style='color:#888;'>Chatbot is typing...</div>`;
      // Flowise expects a specific phrase; normalize when intent detected
      const flowQuestion = unzipIntent ? "Unzip this" : userMsg;
      const response = await query({ question: flowQuestion, zipFileNames, zipFileMetadata });



      // Flowise error display logic
      if (response?.error) {
        messages.innerHTML = messages.innerHTML.replace("Chatbot is typing...", "");
        messages.innerHTML += `<div class='chat-msg bot error'><b>Chatbot:</b> <span style="color:red;">${renderMarkdown(response.error)}</span></div>`;
        errorDiv.textContent = `Flowise error: ${response.error}`;
        messages.scrollTop = messages.scrollHeight;
        return;
      }

      // Parse JSON defensively
      const parsed = tryParseAnyJson(response);
      let botMsg;

      if (validateEvidenceSummary(parsed)) {
      botMsg = parsed.evidenceSummary.map(item =>
        `🗂️ <b>${item.filename}</b> (${item.type})`
      ).join("<br>");
    } else if (Array.isArray(response?.evidenceSummary)) {
      botMsg = response.evidenceSummary.map(item =>
        `🗂️ <b>${item.filename}</b> (${item.type})`
      ).join("<br>");
    } else if (typeof response?.message?.content === "string") {
      // Try parsing stringified JSON to display nicely
      try {
        const contentJson = JSON.parse(response.message.content);
        if (validateEvidenceSummary(contentJson)) {
          botMsg = contentJson.evidenceSummary.map(item =>
            `🗂️ <b>${item.filename}</b> (${item.type})`
          ).join("<br>");
        } else {
          botMsg = response.message.content; // raw
        }
      } catch {
        botMsg = response.message.content; // raw
      }
    } else if (response?.text) {
      botMsg = response.text;
    } else if (response?.answer) {
      botMsg = response.answer;
    } else {
      botMsg = JSON.stringify(response, null, 2);
    }

      messages.innerHTML = messages.innerHTML.replace("Chatbot is typing...", "");
      messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> ${renderMarkdown(botMsg)}</div>`;
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      messages.innerHTML = messages.innerHTML.replace("Chatbot is typing...", "");
      errorDiv.textContent = `Sorry, there was a problem contacting Chatbot: ${err.message}`;
    }
  });

  // Minimize button
  minimizeBtn?.addEventListener("click", function () {
    chatbotContainer.classList.add("minimized");
    chatbotContainer.classList.remove("open");
    toggleBtn?.classList.add("visible");
    localStorage.setItem("chatbotOpened", "false");
  });

  // Toggle button
  toggleBtn?.addEventListener("click", function () {
    chatbotContainer.classList.remove("minimized");
    chatbotContainer.classList.add("open");
    toggleBtn.classList.remove("visible");
    localStorage.setItem("chatbotOpened", "true");
    input.focus();
  });

  // Anchor links (#chatbot)
  document.querySelectorAll('a[href="#chatbot"]').forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      chatbotContainer?.classList.remove("minimized");
      chatbotContainer?.classList.add("open");
      toggleBtn?.classList.remove("visible");
      localStorage.setItem("chatbotOpened", "true");
      input?.focus();
    });
  });

  // Navigation active link
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Load marked.js if missing
  if (!window.marked && typeof marked === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    script.async = true;
    document.head.appendChild(script);
  }

  // Ensure JSZip is available
  if (typeof JSZip === "undefined") {
    const jszipScript = document.createElement("script");
    jszipScript.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    jszipScript.async = true;
    document.head.appendChild(jszipScript);
  }

  // File upload (ZIP preview)
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileList = document.getElementById("fileList");

  if (uploadBtn && fileInput && fileList) {
    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      fileList.innerHTML = "";
      zipFileNames = []; // overwrite every time
      zipFileMetadata = []; // overwrite every time

      for (const file of fileInput.files) {
        if (!file.name.endsWith(".zip")) {
          const notZip = document.createElement("div");
          notZip.textContent = "Not a ZIP file; ignored for evidence extraction.";
          notZip.style.color = "#888";
          fileList.appendChild(notZip);
          continue;
        }

        // Store file info for chat display
        currentFileInfo = {
          name: file.name,
          size: file.size
        };

        // ChatGPT-style file card (Show when a file is being submitted)
        const fileCard = document.createElement("div");
        fileCard.className = "file-card";
        fileCard.innerHTML = `
          <div class="file-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="file-card-info">
            <div class="file-card-name">${file.name}</div>
            <div class="file-card-type">ZIP Archive</div>
            <div class="file-card-status" style="font-size: 0.85em; margin-top: 4px; color: #888;">Processing ZIP file...</div>
          </div>
          <button class="file-card-remove" title="Remove file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;
        fileList.appendChild(fileCard);

        // Remove button functionality
        const removeBtn = fileCard.querySelector(".file-card-remove");
        removeBtn.addEventListener("click", () => {
          fileCard.remove();
          zipFileNames = [];
          zipFileMetadata = [];
          fileInput.value = "";
          currentFileInfo = null;
          isProcessingZip = false;
        });

        // Wait for JSZip if it hasn't loaded yet
        await waitForJSZip();

        // Set processing flag
        isProcessingZip = true;
        console.log('=== Starting ZIP Processing ===');
        console.log('File:', file.name, '| Size:', file.size, 'bytes');

        try {
          const zip = new JSZip();
          const content = await zip.loadAsync(file);
          console.log('ZIP loaded successfully, entries:', Object.keys(content.files).length);

          const currentZipEntries = [];
          const currentZipMetadata = [];

          for (const [filename, zipEntry] of Object.entries(content.files)) {
            if (!zipEntry.dir) {
              const shortName = filename.split("/").pop();
              currentZipEntries.push(shortName);

              try {
                const buffer = await zipEntry.async("arraybuffer");
                const sizeBytes = buffer.byteLength;
                const ext = shortName.toLowerCase().split('.').pop();
                const type = getFileType(shortName);
                const mime = getMimeType(ext);

                let preview = null;
                const textLike = new Set(["txt","csv","json","xml","md","html","htm","log"]);
                if (textLike.has(ext)) {
                  try {
                    const decoder = new TextDecoder();
                    const text = decoder.decode(new Uint8Array(buffer));
                    preview = String(text).slice(0, 500);
                  } catch {}
                }

                const metadata = {
                  filename: shortName,
                  path: filename,
                  type,
                  sizeBytes,
                  mime,
                  preview
                };
                
                currentZipMetadata.push(metadata);
                console.log(`📄 Extracted: ${shortName}`);
                console.log('   Type:', type, '| Size:', sizeBytes, 'bytes | MIME:', mime);
                if (preview) {
                  console.log('   Preview:', preview.slice(0, 100) + '...');
                }
              } catch (err) {
                console.error(`❌ Error processing ${shortName}:`, err);
              }
            }
          }

          // Store all filenames automatically
          zipFileNames = [...currentZipEntries];
          zipFileMetadata = [...currentZipMetadata];
          
          console.log('✅ ZIP Processing Complete');
          console.log('Total files extracted:', zipFileNames.length);
          console.log('Filenames:', zipFileNames);
          console.log('Full Metadata:', zipFileMetadata);
          console.log('=== End ZIP Processing ===\n');
          
          // Clear processing flag and show success
          isProcessingZip = false;
          
          // Update card to success state
          const statusEl = fileCard.querySelector(".file-card-status");
          const fileCount = currentZipEntries.length;
          const fileWord = fileCount === 1 ? "file" : "files";
          if (statusEl) {
            statusEl.textContent = `All ${fileCount} ${fileWord} uploaded successfully`;
            statusEl.style.color = "#10b981";
          }
          fileCard.style.borderColor = "#10b981";
          fileCard.style.backgroundColor = "rgba(16, 185, 129, 0.05)";
        } catch (err) {
          console.error('❌ ZIP Processing Failed:', err);
          console.error('File:', file.name);
          console.log('=== End ZIP Processing (Error) ===\n');
          
          // Clear processing flag on error
          isProcessingZip = false;
          
          // Show error in card status
          const statusEl = fileCard.querySelector(".file-card-status");
          if (statusEl) {
            statusEl.textContent = "Error reading ZIP file";
            statusEl.style.color = "#ef4444";
          }
          fileCard.style.borderColor = "#ef4444";
          fileCard.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
        }
      }
    });
  }
});

// -----------------------------
// Helper: wait for JSZip global
// -----------------------------
function waitForJSZip(timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      if (typeof JSZip !== "undefined") return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("JSZip failed to load"));
      }
      setTimeout(check, 50);
    })();
  });
}

// Intent helper no longer needed; simplified to "/unzip/i" in submit handler
