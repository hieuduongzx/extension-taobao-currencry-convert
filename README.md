# Taobao Currency Converter Extension

Chrome extension built with React + Vite + TypeScript + TailwindCSS.

## Features

- Converts Taobao CNY prices to USD or VND directly on the page
- Default target currency is USD
- Popup UI to switch currency and refresh exchange rates
- Automatic background rate refresh using Chrome alarms

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Load the `dist` folder in `chrome://extensions` with Developer Mode enabled.
