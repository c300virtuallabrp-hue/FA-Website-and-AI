// Chatbot.js
// Flowise Cloud integration with Groq (no authentication)
// Replace CHATFLOW_ID with your Flowise chatflow ID

// -----------------------------
// Query function to Flowise API
// -----------------------------
async function query(data) {
  try {
    const response = await fetch(
      "https://cloud.flowiseai.com/api/v1/prediction/795794db-436d-4749-9a3b-daaaf78eb21c",
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
    return result;
  } catch (err) {
    console.error("Query error:", err);
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
  let html = md
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  return html;
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

  // -----------------------------
  // Initial state
  // -----------------------------
  if (!chatbotOpened || chatbotOpened === "false") {
    chatbotContainer?.classList.add("minimized");
    toggleBtn?.classList.add("visible");
  } else {
    chatbotContainer?.classList.remove("minimized");
    chatbotContainer?.classList.add("open");
    toggleBtn?.classList.remove("visible");
  }

  // -----------------------------
  // Form submit (send message)
  // -----------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userMsg = input.value.trim();
    if (!userMsg) return;

    messages.innerHTML += `<div class='chat-msg user'><b>You:</b> ${userMsg}</div>`;
    input.value = "";
    errorDiv.textContent = "";

    if (/unzip/i.test(userMsg) && zipFileNames.length === 0) {
      errorDiv.textContent = "Please upload a ZIP first—no filenames found.";
      return;
    }

    try {
      messages.innerHTML += `<div class='chat-msg bot' style='color:#888;'>Chatbot is typing...</div>`;
      const response = await query({ question: userMsg, zipFileNames });
      

      console.log("Flowise response:", response);
      // -----------------------------
      // Flowise error display logic
      // -----------------------------
      if (response?.error) {
        messages.innerHTML = messages.innerHTML.replace("Chatbot is typing...", "");
        messages.innerHTML += `<div class='chat-msg bot error'><b>Chatbot:</b> <span style="color:red;">${renderMarkdown(response.error)}</span></div>`;
        errorDiv.textContent = `Flowise error: ${response.error}`;
        messages.scrollTop = messages.scrollHeight;
        return;
      }

      // Try to parse JSON defensively
      function tryParseAnyJson(obj) {
        if (!obj) return null;
        if (obj.evidenceSummary && Array.isArray(obj.evidenceSummary)) return obj;
        if (typeof obj.text === "string") { try { return JSON.parse(obj.text); } catch {} }
        if (typeof obj?.message?.content === "string") { try { return JSON.parse(obj.message.content); } catch {} }
        if (typeof obj.answer === "string") { try { return JSON.parse(obj.answer); } catch {} }
        return null;
      }

      const parsed = tryParseAnyJson(response);
      let botMsg;

      if (parsed?.evidenceSummary && Array.isArray(parsed.evidenceSummary)) {
        botMsg = parsed.evidenceSummary.map(item =>
          `🗂️ <b>${item.filename}</b> (${item.type}): ${item.contents}`
        ).join("<br>");
      } else if (Array.isArray(response?.evidenceSummary)) {
        botMsg = response.evidenceSummary.map(item =>
          `🗂️ <b>${item.filename}</b> (${item.type}): ${item.contents}`
        ).join("<br>");
      } else if (response?.text) {
        botMsg = response.text;
      } else if (response?.message?.content) {
        botMsg = response.message.content;
      } else if (response?.answer) {
        botMsg = response.answer;
      } else {
        botMsg = JSON.stringify(response);
      }

      messages.innerHTML = messages.innerHTML.replace("Chatbot is typing...", "");
      messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> ${renderMarkdown(botMsg)}</div>`;
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      errorDiv.textContent = `Sorry, there was a problem contacting Chatbot: ${err.message}`;
    }
  });

  // -----------------------------
  // Minimize button
  // -----------------------------
  minimizeBtn?.addEventListener("click", function () {
    chatbotContainer.classList.add("minimized");
    chatbotContainer.classList.remove("open");
    toggleBtn?.classList.add("visible");
    localStorage.setItem("chatbotOpened", "false");
  });

  // -----------------------------
  // Toggle button
  // -----------------------------
  toggleBtn?.addEventListener("click", function () {
    chatbotContainer.classList.remove("minimized");
    chatbotContainer.classList.add("open");
    toggleBtn.classList.remove("visible");
    localStorage.setItem("chatbotOpened", "true");
    input.focus();
  });

  // -----------------------------
  // Anchor links (#chatbot)
  // -----------------------------
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

  // -----------------------------
  // Navigation active link
  // -----------------------------
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

  // -----------------------------
  // Load marked.js if missing
  // -----------------------------
  if (!window.marked && typeof marked === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    script.async = true;
    document.head.appendChild(script);
  }

  // -----------------------------
  // File upload (ZIP preview)
  // -----------------------------
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileList = document.getElementById("fileList");

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      fileList.innerHTML = "";
      zipFileNames = []; // overwrite every time

      for (const file of fileInput.files) {
        const listItem = document.createElement("div");
        listItem.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        fileList.appendChild(listItem);

        if (file.name.endsWith(".zip")) {
          try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);

            const evidenceHeader = document.createElement("div");
            evidenceHeader.innerHTML = `<b>Evidence found:</b>`;
            fileList.appendChild(evidenceHeader);

            const evidenceList = document.createElement("div");
            const currentZipEntries = [];

            for (const [filename, zipEntry] of Object.entries(content.files)) {
              if (!zipEntry.dir) {
                const shortName = filename.split("/").pop();
                currentZipEntries.push(shortName);
                const item = document.createElement("div");
                item.textContent = shortName;
                evidenceList.appendChild(item);
              }
            }

            zipFileNames = currentZipEntries; // overwrite with latest ZIP only
            fileList.appendChild(evidenceList);

            console.log("Collected zipFileNames:", zipFileNames);
          } catch (err) {
            const errorItem = document.createElement("div");
            errorItem.textContent = "Error reading ZIP file.";
            fileList.appendChild(errorItem);
          }

          console.log("Sending to Flowise:", {
  question: "Unzip this",
  variables: { zipFileNames },
  overrideConfig: { runtimeState: { zipFileNames } }
});

        }
      }
    });
  }
});
