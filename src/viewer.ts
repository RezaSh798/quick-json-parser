import browser from "webextension-polyfill";

const STORAGE_KEY = "quickJsonParserInput";
const MAX_NESTED_PARSE_DEPTH = 5;

const rootElement = getRequiredElement<HTMLElement>("json-root");
const treeContainer = getRequiredElement<HTMLElement>("json-tree-container");
const errorContainer = getRequiredElement<HTMLElement>("error-container");
const errorMessage = getRequiredElement<HTMLElement>("error-message");
const rawTextFallback = getRequiredElement<HTMLTextAreaElement>(
  "raw-text-fallback"
);

const copyButton = getRequiredElement<HTMLButtonElement>("copy-btn");
const collapseAllButton = getRequiredElement<HTMLButtonElement>(
  "collapse-all-btn"
);
const expandAllButton = getRequiredElement<HTMLButtonElement>("expand-all-btn");

let parsedValue: unknown = null;

document.addEventListener("DOMContentLoaded", () => {
  void initializeViewer();
});

copyButton.addEventListener("click", () => {
  void copyJSON();
});

collapseAllButton.addEventListener("click", () => {
  setAllNodesExpanded(false);
});

expandAllButton.addEventListener("click", () => {
  setAllNodesExpanded(true);
});

async function initializeViewer(): Promise<void> {
  try {
    // Prefer the text passed via the URL (set by the background when the
    // viewer is opened from a selection). This avoids any dependency on
    // storage-write timing across browsers.
    const urlInput = getInputFromUrl();

    if (urlInput !== null && urlInput.trim()) {
      parseAndRender(urlInput);
      return;
    }

    // Fallback: read from storage (e.g. a manually opened popup).
    const storedData = await browser.storage.local.get(STORAGE_KEY);
    const storedInput = storedData[STORAGE_KEY];

    if (typeof storedInput === "string" && storedInput.trim()) {
      parseAndRender(storedInput);
    } else {
      showError("هیچ ورودی JSON دریافت نشد.", "");
    }

    await browser.storage.local.remove(STORAGE_KEY);
  } catch (error) {
    showError(toErrorMessage(error), "");
  }
}

function getInputFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const input = params.get("input");

    return input === null ? null : decodeURIComponent(input);
  } catch {
    return null;
  }
}

function parseAndRender(rawInput: string): void {
  clearError();
  clearOutput();

  const input = rawInput.trim();

  if (!input) {
    showError("هیچ ورودی JSON دریافت نشد.", rawInput);
    parsedValue = null;
    return;
  }

  try {
    parsedValue = smartParseJSON(input);
    renderJSON(parsedValue);
  } catch (error) {
    parsedValue = null;
    showError(toErrorMessage(error), rawInput);
  }
}

function smartParseJSON(input: string): unknown {
  const candidates = buildParseCandidates(input);
  let lastError: unknown = new Error("Invalid JSON.");

  for (const candidate of candidates) {
    try {
      return parseNestedJSON(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw enhanceJSONError(lastError, input);
}

function buildParseCandidates(input: string): string[] {
  const trimmed = input.trim();
  const candidates = new Set<string>();

  candidates.add(trimmed);

  /*
   * Logs sometimes contain a JSON payload after a prefix such as:
   * "response body: { ... }"
   */
  const extractedObject = extractBalancedJSON(trimmed, "{", "}");

  if (extractedObject) {
    candidates.add(extractedObject);
  }

  const extractedArray = extractBalancedJSON(trimmed, "[", "]");

  if (extractedArray) {
    candidates.add(extractedArray);
  }

  /*
   * Handle JSON copied as an escaped string, for example:
   * {\"name\":\"Reza\"}
   */
  if (trimmed.includes('\\"')) {
    candidates.add(trimmed.replace(/\\"/g, '"'));
  }

  /*
   * Handle a fully quoted JSON string that may have been copied from
   * a log or another JSON property.
   */
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const withoutOuterQuotes = trimmed.slice(1, -1);
    candidates.add(withoutOuterQuotes);
    candidates.add(
      withoutOuterQuotes.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    );
  }

  return [...candidates];
}

function parseNestedJSON(value: string): unknown {
  let currentValue: unknown = JSON.parse(value);

  for (let depth = 0; depth < MAX_NESTED_PARSE_DEPTH; depth += 1) {
    if (typeof currentValue !== "string") {
      break;
    }

    const trimmed = currentValue.trim();

    if (!looksLikeJSON(trimmed)) {
      break;
    }

    currentValue = JSON.parse(trimmed);
  }

  return currentValue;
}

function looksLikeJSON(value: string): boolean {
  if (!value) {
    return false;
  }

  const startsAndEndsLikeJSON =
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith('"') && value.endsWith('"'));

  return startsAndEndsLikeJSON;
}

function extractBalancedJSON(
  input: string,
  openingCharacter: "{" | "[",
  closingCharacter: "}" | "]"
): string | null {
  const startIndex = input.indexOf(openingCharacter);

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let isInsideString = false;
  let isEscaped = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const character = input[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === "\\" && isInsideString) {
      isEscaped = true;
      continue;
    }

    if (character === '"') {
      isInsideString = !isInsideString;
      continue;
    }

    if (isInsideString) {
      continue;
    }

    if (character === openingCharacter) {
      depth += 1;
    } else if (character === closingCharacter) {
      depth -= 1;

      if (depth === 0) {
        return input.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function renderJSON(value: unknown): void {
  clearOutput();
  showTree();

  const rootNode = createValueNode(value, null, true);
  rootElement.append(rootNode);
}

function createValueNode(
  value: unknown,
  key: string | number | null,
  isRoot = false
): HTMLElement {
  if (isContainer(value)) {
    return createContainerNode(value, key, isRoot);
  }

  return createPrimitiveNode(value, key);
}

function createContainerNode(
  value: Record<string, unknown> | unknown[],
  key: string | number | null,
  isRoot: boolean
): HTMLElement {
  const node = document.createElement("div");
  node.className = "json-node";

  const toggle = document.createElement("span");
  toggle.className = "json-toggle";
  toggle.textContent = "▼";
  toggle.setAttribute("aria-label", "جمع کردن گره JSON");
  toggle.addEventListener("click", () => {
    toggleNode(node);
  });
  node.append(toggle);

  if (key !== null) {
    node.append(createKeyElement(key));
    node.append(document.createTextNode(": "));
  } else if (!isRoot) {
    node.append(document.createTextNode(""));
  }

  const isArray = Array.isArray(value);
  const entries = Object.entries(value);

  const openBracket = document.createElement("span");
  openBracket.className = "json-bracket-open";
  openBracket.textContent = isArray ? "[" : "{";
  node.append(openBracket);

  const preview = document.createElement("span");
  preview.className = "json-collapsed-preview";
  preview.textContent = isArray
    ? ` Array(${entries.length}) `
    : ` Object(${entries.length}) `;
  preview.addEventListener("click", () => {
    toggleNode(node);
  });
  node.append(preview);

  for (const [childKey, childValue] of entries) {
    const normalizedKey = isArray ? Number(childKey) : childKey;

    node.append(createValueNode(childValue, normalizedKey));
  }

  const closeBracket = document.createElement("div");
  closeBracket.className = "json-bracket-close";
  closeBracket.textContent = isArray ? "]" : "}";
  node.append(closeBracket);

  return node;
}

function createPrimitiveNode(
  value: unknown,
  key: string | number | null
): HTMLElement {
  const node = document.createElement("div");
  node.className = "json-node";

  if (key !== null) {
    node.append(createKeyElement(key));
    node.append(document.createTextNode(": "));
  }

  const valueElement = document.createElement("span");
  valueElement.className = `json-${getValueType(value)}`;
  valueElement.textContent = stringifyPrimitive(value);

  node.append(valueElement);

  return node;
}

function createKeyElement(key: string | number): HTMLElement {
  const keyElement = document.createElement("span");
  keyElement.className = "json-key";
  keyElement.textContent =
    typeof key === "number" ? String(key) : JSON.stringify(key);

  return keyElement;
}

function toggleNode(node: HTMLElement): void {
  const willCollapse = !node.classList.contains("collapsed");
  const toggle = node.querySelector<HTMLElement>(":scope > .json-toggle");

  node.classList.toggle("collapsed", willCollapse);

  if (toggle) {
    toggle.textContent = willCollapse ? "▶" : "▼";
    toggle.setAttribute(
      "aria-label",
      willCollapse ? "باز کردن گره JSON" : "جمع کردن گره JSON"
    );
  }
}

function setAllNodesExpanded(shouldExpand: boolean): void {
  const nodes = rootElement.querySelectorAll<HTMLElement>(".json-node");

  for (const node of nodes) {
    const toggle = node.querySelector<HTMLElement>(":scope > .json-toggle");

    if (!toggle) {
      continue;
    }

    node.classList.toggle("collapsed", !shouldExpand);
    toggle.textContent = shouldExpand ? "▼" : "▶";
    toggle.setAttribute(
      "aria-label",
      shouldExpand ? "جمع کردن گره JSON" : "باز کردن گره JSON"
    );
  }
}

async function copyJSON(): Promise<void> {
  try {
    if (parsedValue === null) {
      throw new Error("هنوز چیزی برای کپی کردن وجود ندارد.");
    }

    const formattedJSON = JSON.stringify(parsedValue, null, 2);

    await navigator.clipboard.writeText(formattedJSON);

    flashButton(copyButton, "کپی شد!");
  } catch (error) {
    flashButton(copyButton, "کپی نشد");
    console.error(toErrorMessage(error));
  }
}

function flashButton(button: HTMLButtonElement, message: string): void {
  const previousText = button.textContent;

  button.textContent = message;

  window.setTimeout(() => {
    button.textContent = previousText;
  }, 1200);
}

function isContainer(
  value: unknown
): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function getValueType(
  value: unknown
): "string" | "number" | "boolean" | "null" | "unknown" {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      return "string";

    case "number":
      return "number";

    case "boolean":
      return "boolean";

    default:
      return "unknown";
  }
}

function stringifyPrimitive(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function enhanceJSONError(error: unknown, input: string): Error {
  const originalMessage = toErrorMessage(error);
  const positionMatch = originalMessage.match(/position\s+(\d+)/i);

  if (!positionMatch) {
    return new Error(`Invalid JSON: ${originalMessage}`);
  }

  const position = Number(positionMatch[1]);
  const { line, column } = getLineAndColumn(input, position);

  return new Error(
    `Invalid JSON at line ${line}, column ${column}: ${originalMessage}`
  );
}

function getLineAndColumn(
  input: string,
  position: number
): { line: number; column: number } {
  const contentBeforeError = input.slice(0, position);
  const lines = contentBeforeError.split("\n");

  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
}

function showError(message: string, rawText: string): void {
  errorMessage.textContent = message;
  rawTextFallback.value = rawText;
  errorContainer.classList.remove("hidden");
  treeContainer.classList.add("hidden");
}

function showTree(): void {
  errorContainer.classList.add("hidden");
  treeContainer.classList.remove("hidden");
}

function clearError(): void {
  errorMessage.textContent = "";
  rawTextFallback.value = "";
}

function clearOutput(): void {
  rootElement.replaceChildren();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element "#${id}" was not found.`);
  }

  return element as T;
}
