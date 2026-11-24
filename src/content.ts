import {
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  STORAGE_KEYS,
  containsCny,
  convertPriceText,
  extractAmountFromText,
  formatConvertedMoney,
  formatExchangeRateDisplay,
  getRate,
  isCurrencyCode,
  isCurrencySymbolText,
  isStrictAmount,
  loadStoredSettings,
  normalizeExchangeRates,
  sanitizeCurrencyPreference,
  type CurrencyCode,
  type ExchangeRates,
  type RuntimeMessage
} from "./shared/index.ts";

const BADGE_STYLE_ID = "tbcc-price-badge-styles";
const BADGE_CLASS = "tbcc-price-badge";
const BLOCKED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

const trackedNodes = new Map<Text, string>();
const structuredAmountNodes = new Set<HTMLElement>();
const structuredMarkers = new WeakMap<HTMLElement, HTMLElement>();

let selectedCurrency: CurrencyCode = DEFAULT_CURRENCY;
let rates: ExchangeRates = normalizeExchangeRates(FALLBACK_RATES);
let isApplyingConversion = false;

/** Injects a clean *2k-style uniform 1px hairline pill stylesheet once per document. */
function ensureBadgeStyles(): void {
  if (document.getElementById(BADGE_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = BADGE_STYLE_ID;
  style.textContent = `
.${BADGE_CLASS} {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid rgba(234, 88, 12, 0.24);
  background-color: rgba(249, 115, 22, 0.09);
  color: #c2410c;
  font-family: "Segoe UI Variable", "Segoe UI", Inter, system-ui, sans-serif;
  font-size: clamp(11px, 0.72em, 13px);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  vertical-align: middle;
  text-decoration: none;
  box-sizing: border-box;
}
.${BADGE_CLASS}[data-tbcc-surface="dark"] {
  border-color: rgba(251, 146, 60, 0.34);
  background-color: rgba(249, 115, 22, 0.16);
  color: #fdba74;
}
`;
  (document.head || document.documentElement).appendChild(style);
}

/** Detects whether an element sits on a dark background surface for crisp badge contrast. */
function detectSurfaceTone(element: HTMLElement): "light" | "dark" {
  let cursor: HTMLElement | null = element;
  while (cursor) {
    const bg = window.getComputedStyle(cursor).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const alpha = match[4] === undefined ? 1 : Number.parseFloat(match[4]);
      if (alpha > 0.25) {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.45 ? "dark" : "light";
      }
    }
    cursor = cursor.parentElement;
  }
  return "light";
}

function buildBadgeTooltip(): string {
  const rateText = formatExchangeRateDisplay(selectedCurrency, getRate(rates, selectedCurrency));
  return `1 CNY = ${rateText} ${selectedCurrency} · Taobao Convert`;
}

function findNearbySymbolElement(amountElement: HTMLElement): HTMLElement | null {
  let sibling: Element | null = amountElement.previousElementSibling;
  let step = 0;
  while (sibling && step < 4) {
    if (sibling instanceof HTMLElement && isCurrencySymbolText(sibling.textContent ?? "")) {
      return sibling;
    }
    sibling = sibling.previousElementSibling;
    step += 1;
  }
  return null;
}

function applyStructuredConversion(amountElement: HTMLElement): void {
  const symbolElement = findNearbySymbolElement(amountElement);
  if (!amountElement.isConnected || !symbolElement) {
    structuredAmountNodes.delete(amountElement);
    return;
  }

  const amount = extractAmountFromText(amountElement.textContent ?? "");
  if (amount === null) {
    return;
  }

  let marker = structuredMarkers.get(amountElement);
  if (!marker) {
    const next = amountElement.nextElementSibling;
    if (next instanceof HTMLElement && next.dataset.tbccStructuredMarker === "1") {
      marker = next;
      structuredMarkers.set(amountElement, marker);
    }
  }

  const container = amountElement.parentElement;
  if (container) {
    const allMarkers = container.querySelectorAll('[data-tbcc-structured-marker="1"]');
    for (let i = 0; i < allMarkers.length; i += 1) {
      const candidate = allMarkers[i] as HTMLElement;
      if (candidate === marker) continue;
      const prev = candidate.previousElementSibling;
      if (prev && structuredMarkers.get(prev as HTMLElement) === candidate) {
        continue;
      }
      candidate.remove();
    }
  }

  const formattedText = `≈ ${formatConvertedMoney(amount, selectedCurrency, rates)}`;
  const tooltip = buildBadgeTooltip();

  if (marker) {
    marker.className = BADGE_CLASS;
    marker.dataset.tbccSurface = detectSurfaceTone(amountElement);
    marker.title = tooltip;
    marker.textContent = formattedText;
    return;
  }

  if (container) {
    ensureBadgeStyles();
    marker = document.createElement("span");
    marker.className = BADGE_CLASS;
    marker.dataset.tbccStructuredMarker = "1";
    marker.dataset.tbccSurface = detectSurfaceTone(amountElement);
    marker.title = tooltip;
    marker.textContent = formattedText;
    amountElement.insertAdjacentElement("afterend", marker);
    structuredMarkers.set(amountElement, marker);
  }
}

function findStructuredAmountNode(textNode: Text): HTMLElement | null {
  const parent = textNode.parentElement;
  if (!parent || parent.dataset.tbccStructuredMarker === "1") {
    return null;
  }

  const text = (textNode.nodeValue ?? "").trim();
  if (isCurrencySymbolText(text)) {
    let sibling: Element | null = parent.nextElementSibling;
    let step = 0;
    while (sibling && step < 4) {
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.tbccStructuredMarker !== "1" &&
        isStrictAmount(sibling.textContent ?? "") &&
        extractAmountFromText(sibling.textContent ?? "") !== null
      ) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
      step += 1;
    }
  }

  if (
    isStrictAmount(text) &&
    extractAmountFromText(text) !== null &&
    findNearbySymbolElement(parent)
  ) {
    return parent;
  }

  return null;
}

function trackStructuredByTextNode(textNode: Text): void {
  const amountNode = findStructuredAmountNode(textNode);
  if (!amountNode) {
    return;
  }
  structuredAmountNodes.add(amountNode);
  applyStructuredConversion(amountNode);
}

function isTextNodeEligible(node: Text): boolean {
  if (!node.nodeValue || !node.nodeValue.trim()) {
    return false;
  }

  const parent = node.parentElement;
  if (!parent || parent.dataset.tbccStructuredMarker === "1") {
    return false;
  }

  if (BLOCKED_TAGS.has(parent.tagName) || parent.isContentEditable) {
    return false;
  }

  return true;
}

function applyConversionToNode(node: Text): void {
  const originalText = trackedNodes.get(node);
  if (!originalText) {
    return;
  }

  const convertedText = convertPriceText(originalText, selectedCurrency, rates);
  if (node.nodeValue === convertedText) {
    return;
  }

  isApplyingConversion = true;
  node.nodeValue = convertedText;
  isApplyingConversion = false;
}

function trackAndConvert(node: Text): void {
  if (!isTextNodeEligible(node)) {
    return;
  }

  trackStructuredByTextNode(node);

  const text = node.nodeValue ?? "";
  if (!containsCny(text)) {
    return;
  }

  trackedNodes.set(node, text);
  applyConversionToNode(node);
}

function scanNodeTree(root: Node | null): void {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    trackAndConvert(current as Text);
    current = walker.nextNode();
  }
}

function applyToTrackedNodes(): void {
  for (const [node] of trackedNodes) {
    if (!node.isConnected) {
      trackedNodes.delete(node);
      continue;
    }
    applyConversionToNode(node);
  }

  for (const amountNode of structuredAmountNodes) {
    if (!amountNode.isConnected) {
      structuredAmountNodes.delete(amountNode);
      continue;
    }
    applyStructuredConversion(amountNode);
  }
}

function observeDom(): void {
  const observer = new MutationObserver((mutations) => {
    if (isApplyingConversion) {
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            trackAndConvert(node as Text);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.dataset.tbccStructuredMarker !== "1") {
              scanNodeTree(el);
            }
          }
        }
      }

      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const node = mutation.target as Text;
        const latestText = node.nodeValue ?? "";

        trackStructuredByTextNode(node);

        const original = trackedNodes.get(node);
        if (original && latestText === convertPriceText(original, selectedCurrency, rates)) {
          continue;
        }

        if (!containsCny(latestText)) {
          trackedNodes.delete(node);
          continue;
        }

        trackedNodes.set(node, latestText);
        applyConversionToNode(node);
        trackStructuredByTextNode(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function ratesAreUsable(nextRates: ExchangeRates, currency: CurrencyCode): boolean {
  return Number.isFinite(getRate(nextRates, currency));
}

async function loadInitialSettings(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "tbcc:getSettings"
    } satisfies RuntimeMessage)) as
      | { currency?: string; rates?: ExchangeRates }
      | undefined;

    if (response?.currency && isCurrencyCode(response.currency)) {
      selectedCurrency = response.currency;
    }

    if (response?.rates) {
      const normalized = normalizeExchangeRates(response.rates);
      if (ratesAreUsable(normalized, selectedCurrency)) {
        rates = normalized;
      }
    }
  } catch {
    const stored = await loadStoredSettings();
    selectedCurrency = stored.currency;
    rates = stored.rates;
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEYS.currency]) {
    selectedCurrency = sanitizeCurrencyPreference(changes[STORAGE_KEYS.currency].newValue);
    applyToTrackedNodes();
  }

  if (areaName === "local" && changes[STORAGE_KEYS.rates]) {
    const nextRates = normalizeExchangeRates(changes[STORAGE_KEYS.rates].newValue);
    if (ratesAreUsable(nextRates, selectedCurrency)) {
      rates = nextRates;
      applyToTrackedNodes();
    }
  }
});

loadInitialSettings()
  .catch(() => undefined)
  .finally(() => {
    ensureBadgeStyles();
    scanNodeTree(document.body);
    observeDom();
  });
