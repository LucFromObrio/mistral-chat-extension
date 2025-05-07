"use strict";

/**
 * Викликає Mistral API (small latest) для отримання відповіді на запит.
 * Якщо зміниться endpoint або параметри — правте лише цей блок.
 * @param {string} promptText — текст запиту користувача.
 * @returns {Promise<string>} — текст відповіді асистента.
 */
async function fetchMistralCompletion(promptText) {
  // Дістаємо API-ключ
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    throw new Error('API-ключ не встановлено в налаштуваннях');
  }

  // Використовуємо модель mistral-small-latest
  const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'user', content: promptText }
      ],
      temperature: 0.7,
      max_tokens: 512
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Mistral API помилка ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  // Відповідь у choices[0].message.content
  return data.choices?.[0]?.message?.content || '';
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const $ = id => document.getElementById(id);

  // — Панелі
  const panels = {
    list: $("chatListPanel"),
    chat: $("mainChatPanel"),
    set:  $("settingsPanel")
  };

  // — UI-елементи
  const chatList     = $("chatList"),
        newChatBtn   = $("newChatBtn"),
        backToListBtn= $("backToListBtn"),
        settingsBtns = document.querySelectorAll(".settings-btn"),
        backFromSet  = $("backFromSettingsBtn"),
        chatTitle    = $("chatTitle"),
        historyDiv   = $("history"),
        editor       = $("userInput"),
        formatBar    = document.querySelector(".formatBar"),
        detachBtn    = $("detachBtn"),
        sideListBtn  = $("sidePanelBtnList"),
        sideChatBtn  = $("sidePanelBtnChat"),
        apiKeyInput  = $("apiKeyInput"),
        saveKeyBtn   = $("saveKeyBtn");

  let chats = {}, currentId = null;

  // — Завантаження з storage
  chrome.storage.local.get(
    ["apiKey","chats","currentId","pendingText"],
    data => {
      if (data.apiKey) apiKeyInput.value = data.apiKey;
      if (data.chats)  chats = data.chats;
      if (data.currentId && chats[data.currentId]) currentId = data.currentId;
      else currentId = createChat();

      renderChatList();
      renderChat();
      openPanel("chat");

      if (data.pendingText) {
        editor.innerText = data.pendingText;
        autoGrow();
        chrome.storage.local.remove("pendingText");
      }

      bindInputAutoGrow();
      bindFormatting();
    }
  );

  // — Перемикач панелей
  function openPanel(name) {
    Object.entries(panels).forEach(([k,el]) =>
      el.classList.toggle("open", k === name)
    );
  }

  // — Створити новий чат
  function createChat() {
    const id = Date.now().toString();
    chats[id] = { name: `Чат ${Object.keys(chats).length+1}`, messages: [] };
    currentId = id;
    chrome.storage.local.set({ chats, currentId });
    return id;
  }

  // — Рендер списку чатів
  function renderChatList() {
    chatList.innerHTML = "";
    Object.entries(chats).forEach(([id,chat]) => {
      const card = document.createElement("div");
      card.className = "chat-card";

      const nameDiv = document.createElement("div");
      nameDiv.className = "chat-name";
      nameDiv.textContent = chat.name;
      card.appendChild(nameDiv);

      // Видалити чат
      const delBtn = document.createElement("button");
      delBtn.className = "trash-btn icon-btn";
      delBtn.innerHTML = `<span class="material-symbols-rounded">delete_outline</span>`;
      delBtn.onclick = e => {
        e.stopPropagation();
        if (!confirm(`Видалити «${chat.name}»?`)) return;
        delete chats[id];
        chrome.storage.local.set({ chats });
        if (id === currentId) {
          const keys = Object.keys(chats);
          currentId = keys.length ? keys[0] : createChat();
          renderChat();
        }
        renderChatList();
      };
      card.appendChild(delBtn);

      // Перейменувати чат
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn icon-btn";
      editBtn.innerHTML = `<span class="material-symbols-rounded">edit</span>`;
      editBtn.onclick = e => {
        e.stopPropagation();
        const nn = prompt("Нова назва чату:", chat.name);
        if (nn) {
          chat.name = nn.trim();
          chrome.storage.local.set({ chats });
          renderChatList();
          if (id === currentId) renderChat();
        }
      };
      card.appendChild(editBtn);

      // Відкрити чат
      card.onclick = () => {
        currentId = id;
        chrome.storage.local.set({ currentId });
        renderChat();
        openPanel("chat");
      };

      chatList.appendChild(card);
    });
  }

  // — Рендер історії
  function renderChat() {
    historyDiv.innerHTML = "";
    (chats[currentId].messages || []).forEach(m => {
      const row = document.createElement("div");
      row.className = `bubble-row ${m.role}`;
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = m.content;
      row.appendChild(bubble);

      if (m.role === "assistant") {
        const copyText = document.createElement("div");
        copyText.className = "copy-text";
        copyText.textContent = "скопіювати";
        copyText.onclick = () => navigator.clipboard.writeText(m.content);
        row.appendChild(copyText);
      }

      historyDiv.appendChild(row);
    });
    historyDiv.scrollTop = historyDiv.scrollHeight;
    chatTitle.textContent = chats[currentId].name;
  }

  // — Відправлення (Ctrl+Enter) з викликом Mistral
  async function sendMessage() {
    const txt = editor.innerText.trim();
    if (!txt) return;

    // 1) Додаємо повідомлення користувача
    chats[currentId].messages.push({ role: "user", content: txt });
    chrome.storage.local.set({ chats });
    renderChat();
    editor.innerText = "";
    autoGrow();

    // 2) Запит до Mistral
    try {
      const assistantText = await fetchMistralCompletion(txt);
      chats[currentId].messages.push({ role: "assistant", content: assistantText });
      chrome.storage.local.set({ chats });
      renderChat();
    } catch (err) {
      console.error("Помилка при виклику Mistral:", err);
      // тут можна додати UI-повідомлення про помилку
    }
  }

  // — Автонапрягання editor
  function autoGrow() {
    editor.style.height = "auto";
    editor.style.height = Math.min(editor.scrollHeight, 200) + "px";
  }
  function bindInputAutoGrow() {
    editor.addEventListener("input", autoGrow);
  }

  // — INLINE-TOOLBAR
  function bindFormatting() {
    const btns = document.querySelectorAll(".format-btn");
    function updateBar() {
      const lines = editor.innerText.split("\n").filter(l => l.trim().length > 0);
      formatBar.style.display = lines.length >= 3 ? "flex" : "none";
    }
    editor.addEventListener("input", updateBar);
    updateBar();
    btns.forEach(btn => {
      btn.onclick = () => {
        document.execCommand(btn.dataset.cmd, false);
        editor.focus();
      };
    });
  }

  // — Інші обробники
  newChatBtn.onclick          = () => { createChat(); renderChatList(); };
  editor.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  settingsBtns.forEach(b => b.onclick = () => openPanel("set"));
  backFromSet.onclick         = () => openPanel("chat");
  backToListBtn.onclick       = () => openPanel("list");
  detachBtn.onclick           = () => chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup", width: 400, height: 600
  });
  sideListBtn.onclick         = sideChatBtn.onclick = openSidePanel;
  saveKeyBtn.onclick          = () => chrome.storage.local.set(
    { apiKey: apiKeyInput.value.trim() },
    () => alert("API-ключ збережено!")
  );

  function openSidePanel() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
      const t = tabs[0];
      if (t && typeof t.id === "number") chrome.sidePanel.open({ tabId: t.id });
    });
  }
}
