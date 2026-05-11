chrome.action.onClicked.addListener((tab) => {
  const tabUrl = encodeURIComponent(tab.url || '');
  chrome.windows.create({
    url: chrome.runtime.getURL('panel.html') + '?tabId=' + tab.id + '&tabUrl=' + tabUrl,
    type: 'popup',
    width: 1140,
    height: 860,
    focused: true,
  });
});

// Relay messages from content script to the panel window
chrome.runtime.onMessage.addListener((msg, sender) => {
  chrome.runtime.sendMessage(msg).catch(() => {});
});
