// service_worker.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Service Worker installed; sidePanel available:", chrome.sidePanel);
});

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabs[0]?.id;
  if (chrome.sidePanel?.open && typeof tabId === "number") {
    chrome.sidePanel.open({ tabId });
  } else {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 400,
      height: 600
    });
  }
});
