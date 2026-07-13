document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("targetText", (data) => {
    const rawText = data.targetText || "";
    if (!rawText) {
      showError("هیچ متنی برای بررسی ارسال نشده است.");
      return;
    }

    try {
      const parsedData = smartParseJSON(rawText);
      renderJSON(parsedData);
    } catch (err) {
      showError(err.message, rawText);
    }
  });

  // هندلر دکمه کپی
  document.getElementById("copy-btn").addEventListener("click", () => {
    const rootEl = document.getElementById("json-root");
    if (!rootEl.hasChildNodes()) return;
    
    // کپی تمیز JSON فرمت شده
    chrome.storage.local.get("targetText", (data) => {
      try {
        const cleaned = smartParseJSON(data.targetText);
        const pretty = JSON.stringify(cleaned, null, 2);
        navigator.clipboard.writeText(pretty).then(() => {
          const originalText = document.getElementById("copy-btn").innerText;
          document.getElementById("copy-btn").innerText = "کپی شد! ✅";
          setTimeout(() => {
            document.getElementById("copy-btn").innerText = originalText;
          }, 1500);
        });
      } catch (e) {}
    });
  });

  // کنترل باز و بسته کردن عمومی درخت
  document.getElementById("collapse-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".collapsible-wrapper").forEach(el => {
      el.classList.add("collapsed");
      const toggle = el.querySelector(".json-toggle");
      if (toggle) toggle.innerText = "▶";
    });
  });

  document.getElementById("expand-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".collapsible-wrapper").forEach(el => {
      el.classList.remove("collapsed");
      const toggle = el.querySelector(".json-toggle");
      if (toggle) toggle.innerText = "▼";
    });
  });
});

// هسته پارسر هوشمند
function smartParseJSON(str) {
  let cleanStr = str.trim();

  // ۱. اگر متن با کوتیشن شروع و تموم میشه و اسکیپ شده‌ست (احتمالاً فرم خام لاگ دابل-اسکیپ شده)، ابتدا یک بار دیکدش می‌کنیم
  if ((cleanStr.startsWith('"') && cleanStr.endsWith('"')) || (cleanStr.startsWith('`') && cleanStr.endsWith('`'))) {
    try {
      cleanStr = JSON.parse(cleanStr);
    } catch (e) {
      // اگر خطایی داد، به متد اصلی رجوع می‌کنیم
    }
  }

  // ۲. تلاش برای پارس مستقیم
  try {
    return JSON.parse(cleanStr);
  } catch (e) {}

  // ۳. تلاش برای پیدا کردن بلاک JSON وسط کاراکترهای مزاحم (براکت‌ها و آکولادها)
  const firstCurly = cleanStr.indexOf('{');
  const firstBracket = cleanStr.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstCurly !== -1 && (firstBracket === -1 || firstCurly < firstBracket)) {
    start = firstCurly;
    end = cleanStr.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = cleanStr.lastIndexOf(']');
  }

  if (start !== -1 && end !== -1 && end > start) {
    const candidate = cleanStr.substring(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // تلاش نهایی: اگر بک‌اسلش‌های کثیف مانع شده بودند، پاکسازی‌شان می‌کنیم
      try {
        const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        return JSON.parse(unescaped);
      } catch (innerError) {
        throw new Error(`شکست در پارس اتوماتیک با خطا: ${innerError.message}`);
      }
    }
  }

  throw new Error("تطابق ساختاری برقرار نشد. متن انتخابی شامل کاراکترهای استاندارد JSON ({ یا [) نیست.");
}

// رندر کردن گرافیکی درخت متغیرها
function renderJSON(data) {
  const container = document.getElementById("json-root");
  container.innerHTML = "";
  
  const rootElement = createNode(null, data, true);
  container.appendChild(rootElement);

  document.getElementById("json-tree-container").classList.remove("hidden");
}

function createNode(key, value, isRoot = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "json-line";

  // ساختار کلید
  if (key !== null) {
    const keySpan = document.createElement("span");
    keySpan.className = "json-key";
    keySpan.innerText = `"${key}": `;
    wrapper.appendChild(keySpan);
  }

  const valueType = typeof value;

  if (value === null) {
    const nullSpan = document.createElement("span");
    nullSpan.className = "json-null";
    nullSpan.innerText = "null";
    wrapper.appendChild(nullSpan);
  } else if (valueType === "boolean") {
    const boolSpan = document.createElement("span");
    boolSpan.className = "json-boolean";
    boolSpan.innerText = value.toString();
    wrapper.appendChild(boolSpan);
  } else if (valueType === "number") {
    const numSpan = document.createElement("span");
    numSpan.className = "json-number";
    numSpan.innerText = value.toString();
    wrapper.appendChild(numSpan);
  } else if (valueType === "string") {
    // ترفند جذاب: اگر استرینگِ داخل فیلد خودش یک JSON Stringified بود، اون رو هم پارس کن و داخل درخت به صورت تو در تو رندر کن!
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        const nestedJson = JSON.parse(value);
        const nestedTree = createNode(key, nestedJson, false);
        return nestedTree; // کلون کردن گره به عنوان فرزند تو در تو
      } catch (e) {
        // اگر پارس نشد، به عنوان استرینگ معمولی رندرش کن
      }
    }
    const strSpan = document.createElement("span");
    strSpan.className = "json-string";
    strSpan.innerText = `"${value}"`;
    wrapper.appendChild(strSpan);
  } else if (valueType === "object") {
    const isArray = Array.isArray(value);
    const bracketOpen = isArray ? "[" : "{";
    const bracketClose = isArray ? "]" : "}";
    
    const collapsibleWrapper = document.createElement("div");
    collapsibleWrapper.className = "collapsible-wrapper";

    // ایجاد دکمه تاگل (کوچک/بزرگ کردن)
    const toggle = document.createElement("span");
    toggle.className = "json-toggle";
    toggle.innerText = "▼";
    collapsibleWrapper.appendChild(toggle);

    const bracketOpenSpan = document.createElement("span");
    bracketOpenSpan.className = "json-bracket-open";
    bracketOpenSpan.innerText = bracketOpen;
    collapsibleWrapper.appendChild(bracketOpenSpan);

    // پیش‌نمایش در حالت بسته بودن
    const previewSpan = document.createElement("span");
    previewSpan.className = "json-collapsed-preview";
    previewSpan.innerText = isArray ? " [...] " : " {...} ";
    collapsibleWrapper.appendChild(previewSpan);

    const childContainer = document.createElement("div");
    childContainer.className = "json-node";

    const keys = Object.keys(value);
    keys.forEach((childKey, idx) => {
      const childNode = createNode(isArray ? null : childKey, value[childKey]);
      // اضافه کردن کاما بین فیلدها
      if (idx < keys.length - 1) {
        const comma = document.createElement("span");
        comma.innerText = ",";
        childNode.appendChild(comma);
      }
      childContainer.appendChild(childNode);
    });

    collapsibleWrapper.appendChild(childContainer);

    const bracketCloseSpan = document.createElement("span");
    bracketCloseSpan.className = "json-bracket-close";
    bracketCloseSpan.innerText = bracketClose;
    collapsibleWrapper.appendChild(bracketCloseSpan);

    // رویداد تعاملی کلیک روی براکت‌ها یا آیکون تاگل
    const toggleHandler = (e) => {
      e.stopPropagation();
      const isCollapsed = collapsibleWrapper.classList.toggle("collapsed");
      toggle.innerText = isCollapsed ? "▶" : "▼";
    };

    toggle.addEventListener("click", toggleHandler);
    previewSpan.addEventListener("click", toggleHandler);

    wrapper.appendChild(collapsibleWrapper);
  }

  return wrapper;
}

// نمایش پنل خطا در صورت کرش کردن پارسر
function showError(message, rawText = "") {
  document.getElementById("error-message").innerText = message;
  if (rawText) {
    document.getElementById("raw-text-fallback").value = rawText;
    document.getElementById("error-container").classList.remove("hidden");
  } else {
    document.getElementById("error-container").classList.remove("hidden");
    document.querySelector(".raw-preview-container").classList.add("hidden");
  }
}
