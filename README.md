# Quick JSON Parser

A lightweight browser extension for parsing and viewing selected JSON text instantly — via right-click menu or keyboard shortcut. Supports both **Chrome** and **Firefox**.

## What it does

Quick JSON Parser lets you select any JSON text on a webpage and open it in a formatted, collapsible tree viewer. Great for debugging APIs, inspecting log files, or pretty-printing raw JSON.

### Smart parsing

The viewer handles messy real-world JSON automatically:

- **Prefixed logs** — extracts JSON from inputs like `response body: { ... }`
- **Nested JSON strings** — recursively parses JSON embedded inside JSON strings (up to 5 levels deep)
- **Escaped JSON** — handles JSON copied as escaped strings (`{\"name\":\"Reza\"}`)
- **Fully quoted JSON** — unwraps outer quotes on single-quoted or double-quoted JSON strings
- **Balanced extraction** — finds the first balanced `{...}` or `[...]` block within mixed text
- **Error details** — reports invalid JSON with line/column position and a raw text fallback

## Screenshots

(Add screenshots here if you want)

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Build the extension:
   - Chrome: `npm run build:chrome`
   - Firefox: `npm run build:firefox`
   - Both: `npm run build`
4. Open your browser and go to:
   - Chrome: `chrome://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
5. Enable **Developer mode**
6. Click **Load unpacked** and select the `dist/<browser>` folder

## Usage

- Select any JSON text on a page
- Right-click → **Open with Quick JSON Parser**
- Or press `Ctrl+Shift+Y` (`Cmd+Shift+Y` on Mac)

A viewer window opens with:

- Syntax-highlighted, collapsible JSON tree
- Copy formatted JSON button
- Collapse/Expand all controls
- Error details with raw text fallback for invalid JSON

## Development

```bash
npm run dev        # Start Vite dev server
npm run build      # Build for both Chrome and Firefox
```

## License

MIT
