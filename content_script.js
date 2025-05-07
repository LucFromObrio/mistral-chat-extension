// content_script.js
// Скрипт, що додає плаваючу кнопку “Send➤” при виділенні тексту на сторінці

(() => {
    let btn = null;
  
    document.addEventListener("selectionchange", () => {
      const sel = document.getSelection();
  
      // Видаляємо попередню кнопку, якщо є
      if (btn) {
        btn.remove();
        btn = null;
      }
  
      // Якщо нічого не виділено або виділення порожнє — виходимо
      if (!sel || sel.isCollapsed) return;
  
      const text = sel.toString().trim();
      if (text.length < 3) return;  // мін. довжина виділення
  
      // Отримуємо позицію виділення
      const range = sel.getRangeAt(0);
      const rect  = range.getBoundingClientRect();
  
      // Створюємо кнопку
      btn = document.createElement("button");
      btn.id = "nebula-quick-send-btn";
      btn.textContent = "Send➤";
      Object.assign(btn.style, {
        position:        "absolute",
        top:             `${rect.top - 30 + window.scrollY}px`,
        left:            `${rect.left + window.scrollX}px`,
        zIndex:          2147483647,
        padding:         "4px 8px",
        fontSize:        "12px",
        background:      "#4a90e2",
        color:           "#fff",
        border:          "none",
        borderRadius:    "4px",
        cursor:          "pointer",
        boxShadow:       "0 2px 6px rgba(0,0,0,0.3)",
        transition:      "opacity 0.2s",
        opacity:         "0.9"
      });
  
      // При кліку надсилаємо виділений текст у popup через service_worker
      btn.addEventListener("click", e => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: "selectedText", text });
        sel.removeAllRanges();
        btn.remove();
        btn = null;
      });
  
      // Додаємо кнопку в документ
      document.body.appendChild(btn);
    });
  })();
  