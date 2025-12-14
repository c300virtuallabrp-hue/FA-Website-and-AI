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
// Query function to Flowise API
// -----------------------------
async function query(data) {
  try {
    const response = await fetch(
      "https://cloud.flowiseai.com/api/v1/prediction/8610024c-1a33-47cb-aa19-d0004c53b83d",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          variables: { zipFileNames: data.zipFileNames || [] },
          overrideConfig: {
            runtimeState: { zipFileNames: data.zipFileNames || [] }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
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
    
    // Clear file display after showing in chat
    if (fileList) {
      fileList.innerHTML = "";
    }

    // Simple intent: trigger when message contains the word "unzip"
    const unzipIntent = /unzip/i.test(userMsg);
    if (unzipIntent && zipFileNames.length === 0) {
      errorDiv.textContent = "Please upload a ZIP first—no filenames found.";
      return;
    }

    try {
      messages.innerHTML += `<div class='chat-msg bot' style='color:#888;'>Chatbot is typing...</div>`;
      // Flowise expects a specific phrase; normalize when intent detected
      const flowQuestion = unzipIntent ? "Unzip this" : userMsg;
      const response = await query({ question: flowQuestion, zipFileNames });



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
          fileInput.value = "";
          currentFileInfo = null;
        });

        // Wait for JSZip if it hasn't loaded yet
        await waitForJSZip();

        try {
          const zip = new JSZip();
          const content = await zip.loadAsync(file);

          const currentZipEntries = [];

          for (const [filename, zipEntry] of Object.entries(content.files)) {
            if (!zipEntry.dir) {
              const shortName = filename.split("/").pop();
              currentZipEntries.push(shortName);
            }
          }

          // Store all filenames automatically
          zipFileNames = [...currentZipEntries];
        } catch (err) {
          const errorItem = document.createElement("div");
          errorItem.textContent = "Error reading ZIP file.";
          errorItem.style.color = "red";
          fileList.appendChild(errorItem);
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
