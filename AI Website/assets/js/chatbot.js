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
      "https://cloud.flowiseai.com/api/v1/prediction/b5a214d5-4f92-4f5c-b122-9c5491ea760e",
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
      docChildren.push(
        new Paragraph({ text: String(result) }),
        new Paragraph({ text: '' })
      );
    });
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
