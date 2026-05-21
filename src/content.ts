import {
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  STORAGE_KEYS,
  formatConvertedMoney,
  getRate,
  isCurrencyCode,
  normalizeExchangeRates,
  sanitizeCurrencyPreference,
  type CurrencyCode,
  type ExchangeRates
} from "./shared";

const CNY_IN_TEXT_PATTERN = /[\u00A5\uFFE5]|\b\d[\d,.]*\s*\u5143/;
const CNY_PRICE_PATTERN =
  /(\u00A5|\uFFE5)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)|([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*\u5143/g;
const NUMBER_PATTERN = /[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/;

const trackedNodes = new Map<Text, string>();
const structuredAmountNodes = new Set<HTMLElement>();
const structuredMarkers = new WeakMap<HTMLElement, HTMLElement>();
let selectedCurrency: CurrencyCode = DEFAULT_CURRENCY;
let rates: ExchangeRates = normalizeExchangeRates(FALLBACK_RATES);
let isApplyingConversion = false;

function containsCny(text: string): boolean {
  return CNY_IN_TEXT_PATTERN.test(text);
}

function parseAmount(amountText: string): number | null {
  const normalized = amountText.replaceAll(",", "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractAmountFromText(text: string): number | null {
  const match = text.match(NUMBER_PATTERN);
  if (!match) {
    return null;
  }
  return parseAmount(match[0]);
}

function formatConvertedAmount(cnyAmount: number): string {
  return formatConvertedMoney(cnyAmount, selectedCurrency, rates);
}

function convertText(text: string): string {
  const convertedPricePattern = /\s*≈[^≈]*/g;
  let result = text.replace(convertedPricePattern, "");

  return result.replace(CNY_PRICE_PATTERN, (match, symbol, amountFromSymbol, amountFromYuan) => {
    const amountText = (amountFromSymbol || amountFromYuan) as string;
    const amount = parseAmount(amountText);
    if (amount === null) {
      return match;
    }

    return `${match} ≈ ${formatConvertedAmount(amount)}`;
  });
}

function isCurrencySymbolText(text: string): boolean {
  const normalized = text.trim();
  return normalized === "\u00A5" || normalized === "\uFFE5";
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

function applyStructuredConversion(amountElement: HTMLElement) {
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
    for (let i = 0; i < allMarkers.length; i++) {
      const m = allMarkers[i] as HTMLElement;
      if (m === marker) continue;
      const prev = m.previousElementSibling;
      if (prev && structuredMarkers.get(prev as HTMLElement) === m) {
        continue;
      }
      m.remove();
    }
  }

  if (marker) {
    marker.textContent = `≈ ${formatConvertedAmount(amount)}`;
    return;
  }

  if (container) {
    marker = document.createElement("span");
    marker.dataset.tbccStructuredMarker = "1";
    marker.style.marginLeft = "6px";
    marker.style.fontSize = "0.85em";
    marker.style.fontWeight = "600";
    marker.style.color = "#3b82f6";
    marker.style.opacity = "0.9";
    marker.style.whiteSpace = "nowrap";
    marker.textContent = `≈ ${formatConvertedAmount(amount)}`;
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

  if (isStrictAmount(text) && extractAmountFromText(text) !== null && parent instanceof HTMLElement && findNearbySymbolElement(parent)) {
    return parent;
  }

  return null;
}

function trackStructuredByTextNode(textNode: Text) {
  const amountNode = findStructuredAmountNode(textNode);
  if (!amountNode) {
    return;
  }

  structuredAmountNodes.add(amountNode);
  applyStructuredConversion(amountNode);
}

function isStrictAmount(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /^[\d,.\s-]+$/.test(trimmed) && /\d/.test(trimmed);
}

function isTextNodeEligible(node: Text): boolean {
  if (!node.nodeValue || !node.nodeValue.trim()) {
    return false;
  }

  const parent = node.parentElement;
  if (!parent) {
    return false;
  }

  const blockedTags = ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"];
  if (blockedTags.includes(parent.tagName)) {
    return false;
  }

  if (parent.isContentEditable) {
    return false;
  }

  return true;
}

function applyConversionToNode(node: Text) {
  const originalText = trackedNodes.get(node);
  if (!originalText) {
    return;
  }

  const convertedText = convertText(originalText);
  if (node.nodeValue === convertedText) {
    return;
  }

  isApplyingConversion = true;
  node.nodeValue = convertedText;
  isApplyingConversion = false;
}

function trackAndConvert(node: Text) {
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

function scanNodeTree(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    trackAndConvert(textNode);
    current = walker.nextNode();
  }
}

function applyToTrackedNodes() {
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

function observeDom() {
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
            scanNodeTree(node);
          }
        }
      }

      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const node = mutation.target as Text;
        const latestText = node.nodeValue ?? "";

        trackStructuredByTextNode(node);

        const original = trackedNodes.get(node);
        if (original && latestText === convertText(original)) {
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

function ratesAreUsable(r: ExchangeRates, currency: CurrencyCode): boolean {
  return Number.isFinite(getRate(r, currency));
}

async function loadSettingsFromBackground(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "tbcc:getSettings"
    })) as
      | {
          currency?: CurrencyCode;
          rates?: ExchangeRates;
        }
      | undefined;

    if (response?.currency && isCurrencyCode(response.currency)) {
      selectedCurrency = response.currency;
    }

    if (response?.rates && ratesAreUsable(response.rates, selectedCurrency)) {
      rates = normalizeExchangeRates(response.rates);
    }
  } catch {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get([STORAGE_KEYS.currency]),
      chrome.storage.local.get([STORAGE_KEYS.rates])
    ]);

    selectedCurrency = sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]);
    rates = normalizeExchangeRates(localData[STORAGE_KEYS.rates]);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEYS.currency]) {
    const next = sanitizeCurrencyPreference(changes[STORAGE_KEYS.currency].newValue);
    selectedCurrency = next;
    applyToTrackedNodes();
  }

  if (areaName === "local" && changes[STORAGE_KEYS.rates]) {
    const newRates = changes[STORAGE_KEYS.rates].newValue as ExchangeRates | undefined;
    if (newRates && ratesAreUsable(normalizeExchangeRates(newRates), selectedCurrency)) {
      rates = normalizeExchangeRates(newRates);
      applyToTrackedNodes();
    }
  }
});

loadSettingsFromBackground()
  .then(() => {
    scanNodeTree(document.body);
    observeDom();
  })
  .catch(() => {
    scanNodeTree(document.body);
    observeDom();
  });
