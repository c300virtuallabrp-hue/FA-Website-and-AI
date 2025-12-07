// TODO: Replace YOUR_SPACE and YOUR_CHATFLOW_ID with your own values below
async function query(data) {
  const response = await fetch(
    "https://api.chatbot.com/spaces/YOUR_SPACE/chatflows/YOUR_CHATFLOW_ID/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  );
  const result = await response.json();
  return result;
}

function renderMarkdown(md) {
  if (window.marked) {
    return window.marked.parse(md);
  }
  let html = md
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  if (/^\s*\|.*\|/m.test(md)) {
    html = html.replace(/((?:^\s*\|.*\|\s*\n?)+)/gm, function(table) {
      const rows = table.trim().split(/\n/).filter(Boolean);
      if (rows.length < 2) return table;
      const header = rows[0].replace(/\|/g, ' ').trim().split(/\s{2,}/);
      const bodyRows = rows.slice(2).map(r => r.replace(/\|/g, ' ').trim().split(/\s{2,}/));
      let htmlTable = '<table class="chat-table"><thead><tr>';
      header.forEach(h => htmlTable += `<th>${h}</th>`);
      htmlTable += '</tr></thead><tbody>';
      bodyRows.forEach(row => {
        htmlTable += '<tr>';
        row.forEach(cell => htmlTable += `<td>${cell}</td>`);
        htmlTable += '</tr>';
      });
      htmlTable += '</tbody></table>';
      return htmlTable;
    });
  }
  return html;
}

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const errorDiv = document.getElementById('chat-error');
  const chatbotContainer = document.querySelector('.chatbot-container');
  const minimizeBtn = document.querySelector('.chatbot-minimize-btn');
  const toggleBtn = document.querySelector('.chatbot-toggle-btn');

  const chatbotOpened = localStorage.getItem('chatbotOpened');
  if (!chatbotOpened || chatbotOpened === 'false') {
    if (chatbotContainer) chatbotContainer.classList.add('minimized');
    if (toggleBtn) toggleBtn.classList.add('visible');
  } else {
    if (chatbotContainer) {
      chatbotContainer.classList.remove('minimized');
      chatbotContainer.classList.add('open');
    }
    if (toggleBtn) toggleBtn.classList.remove('visible');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMsg = input.value.trim();
    if (!userMsg) return;

    messages.innerHTML += `<div class='chat-msg user'><b>You:</b> ${userMsg}</div>`;
    input.value = '';
    errorDiv.textContent = '';

    try {
      messages.innerHTML += `<div class='chat-msg bot' style='color:#888;'>Chatbot is typing...</div>`;
      const response = await query({"question": userMsg});
      let botMsg = response.text || JSON.stringify(response);
      messages.innerHTML = messages.innerHTML.replace('Chatbot is typing...','');
      messages.innerHTML += `<div class='chat-msg bot'><b>Chatbot:</b> ${renderMarkdown(botMsg)}</div>`;
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      errorDiv.textContent = 'Sorry, there was a problem contacting Chatbot.';
    }
  });

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', function() {
      chatbotContainer.classList.add('minimized');
      chatbotContainer.classList.remove('open');
      if (toggleBtn) toggleBtn.classList.add('visible');
      localStorage.setItem('chatbotOpened', 'false');
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      chatbotContainer.classList.remove('minimized');
      chatbotContainer.classList.add('open');
      toggleBtn.classList.remove('visible');
      localStorage.setItem('chatbotOpened', 'true');
      input.focus();
    });
  }

  document.querySelectorAll('a[href="#chatbot"]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      if (chatbotContainer) {
        chatbotContainer.classList.remove('minimized');
        chatbotContainer.classList.add('open');
      }
      if (toggleBtn) toggleBtn.classList.remove('visible');
      localStorage.setItem('chatbotOpened', 'true');
      if (input) input.focus();
    });
  });

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  if (!window.marked && typeof marked === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.async = true;
    document.head.appendChild(script);
  }

  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileList = document.getElementById('fileList');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      fileList.innerHTML = '';

      for (const file of fileInput.files) {
        const listItem = document.createElement('div');
        listItem.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        fileList.appendChild(listItem);

        if (file.name.endsWith('.zip')) {
          try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);

            const evidenceHeader = document.createElement('div');
            evidenceHeader.innerHTML = `<b>Evidence found:</b>`;
            fileList.appendChild(evidenceHeader);

            const evidenceList = document.createElement('div'); // changed from <ul> to <div>
            for (const [filename, zipEntry] of Object.entries(content.files)) {
              if (!zipEntry.dir) {
                const shortName = filename.split('/').pop();
                const item = document.createElement('div'); // changed from <li> to <div>
                item.textContent = shortName;
                evidenceList.appendChild(item);
              }
            }
            fileList.appendChild(evidenceList);
          } catch (err) {
            const errorItem = document.createElement('div');
            errorItem.textContent = 'Error reading ZIP file.';
            fileList.appendChild(errorItem);
          }
        }
      }
    });
  }
});
