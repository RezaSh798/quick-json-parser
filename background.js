// ایجاد آیتم در منوی راست‌کلیک پس از نصب
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "parse-selected-json",
    title: "پارس به عنوان JSON 🛠️",
    contexts: ["selection"]
  });
});

// هندل کردن کلیک روی منوی راست‌کلیک
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "parse-selected-json") {
    openViewerWithText(info.selectionText);
  }
});

// هندل کردن فشردن شورت‌کات کیبورد
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "parse-json-selection") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    try {
      // اجرای یک اسکریپت موقت در صفحه وب برای گرفتن متن انتخاب شده
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      
      if (result && result.trim()) {
        openViewerWithText(result);
      }
    } catch (err) {
      console.error("خطا در خواندن متن انتخاب شده:", err);
    }
  }
});

// ذخیره متن در حافظه موقت افزونه و باز کردن پنجره نمایشگر زیبا
function openViewerWithText(text) {
  chrome.storage.local.set({ targetText: text }, () => {
    chrome.windows.create({
      url: "viewer.html",
      type: "popup",
      width: 850,
      height: 650,
      focused: true
    });
  });
}
