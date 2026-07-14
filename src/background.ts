import browser from "webextension-polyfill";

const CONTEXT_MENU_ID = "open-with-quick-json-parser";
const COMMAND_NAME = "open-json-parser";
const STORAGE_KEY = "quickJsonParserInput";

const VIEWER_WIDTH = 900;
const VIEWER_HEIGHT = 700;

/**
 * Create the context-menu item whenever the extension is installed
 * or updated.
 */
browser.runtime.onInstalled.addListener(() => {
  void createContextMenu();
});

/**
 * The context menu might not exist after temporarily reloading the
 * extension during development, so also create it on startup.
 */
browser.runtime.onStartup.addListener(() => {
  void createContextMenu();
});

async function createContextMenu(): Promise<void> {
  try {
    await browser.contextMenus.removeAll();

    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Open with Quick JSON Parser",
      contexts: ["selection"]
    });
  } catch (error) {
    console.error("Failed to create context menu:", error);
  }
}

/**
 * Handle the context-menu action.
 *
 * Firefox and Chrome both provide the selected text through
 * info.selectionText, so script injection is unnecessary here.
 */
browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  void saveAndOpenViewer(info.selectionText ?? "");
});

/**
 * Handle the keyboard shortcut declared in manifest.json.
 */
browser.commands.onCommand.addListener((command) => {
  if (command !== COMMAND_NAME) {
    return;
  }

  void handleKeyboardShortcut();
});

async function handleKeyboardShortcut(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true
    });

    const activeTab = tabs[0];

    if (activeTab?.id === undefined) {
      await openViewer("");
      return;
    }

    const results = await browser.scripting.executeScript({
      target: {
        tabId: activeTab.id
      },
      func: getSelectedText
    });

    const selection = results[0]?.result;

    await saveAndOpenViewer(
      typeof selection === "string" ? selection : ""
    );
  } catch (error) {
    /*
     * Script injection is blocked on internal pages such as
     * chrome://, about:, browser stores, and PDF viewers.
     * In that case, open an empty viewer instead.
     */
    console.error("Failed to read selected text:", error);
    await openViewer("");
  }
}

/**
 * This function runs inside the active tab.
 *
 * Keep it self-contained because executeScript serializes it before
 * running it in the page context.
 */
function getSelectedText(): string {
  const activeElement = document.activeElement;

  if (
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLInputElement
  ) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;

    if (start !== null && end !== null && start !== end) {
      return activeElement.value.slice(start, end);
    }
  }

  return window.getSelection()?.toString() ?? "";
}

async function saveAndOpenViewer(text: string): Promise<void> {
  // Persist as a fallback in case the URL parameter is lost or too long,
  // then open the viewer with the text encoded directly in the URL so the
  // popup does not depend on storage-write timing.
  try {
    await browser.storage.local.set({
      [STORAGE_KEY]: text
    });
  } catch (error) {
    console.error("Failed to save JSON input:", error);
  }

  await createViewerWindow(text);
}

async function openViewer(text: string): Promise<void> {
  await saveAndOpenViewer(text);
}

async function createViewerWindow(input: string): Promise<void> {
  try {
    const baseUrl = browser.runtime.getURL("viewer.html");
    const url = input
      ? `${baseUrl}?input=${encodeURIComponent(input)}`
      : baseUrl;

    await browser.windows.create({
      url,
      type: "popup",
      width: VIEWER_WIDTH,
      height: VIEWER_HEIGHT
    });
  } catch (error) {
    console.error("Failed to open JSON viewer:", error);
  }
}
