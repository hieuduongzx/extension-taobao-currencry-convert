import { formatConvertedMoney } from "./rates.ts";
import type { ExchangeRates } from "./types.ts";

const CNY_IN_TEXT_PATTERN = /[\u00A5\uFFE5]|\b\d[\d,.]*\s*\u5143/;
const CNY_PRICE_PATTERN =
  /(\u00A5|\uFFE5)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)|([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*\u5143/g;
const NUMBER_PATTERN = /[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/;
const CONVERTED_SUFFIX_PATTERN = /\s*≈\s*[^\s·|;,)\]]+(?:\s*[A-Z]{3})?/g;

export function containsCny(text: string): boolean {
  return CNY_IN_TEXT_PATTERN.test(text);
}

export function parseAmount(amountText: string): number | null {
  const normalized = amountText.replaceAll(",", "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function extractAmountFromText(text: string): number | null {
  const match = text.match(NUMBER_PATTERN);
  if (!match) {
    return null;
  }
  return parseAmount(match[0]);
}

export function isCurrencySymbolText(text: string): boolean {
  const normalized = text.trim();
  return normalized === "\u00A5" || normalized === "\uFFE5";
}

export function isStrictAmount(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /^[\d,.\s-]+$/.test(trimmed) && /\d/.test(trimmed);
}

export function convertPriceText(
  text: string,
  targetCode: string,
  rates: ExchangeRates
): string {
  const stripped = text.replace(CONVERTED_SUFFIX_PATTERN, "");

  return stripped.replace(
    CNY_PRICE_PATTERN,
    (match, _symbol, amountFromSymbol, amountFromYuan) => {
      const amountText = (amountFromSymbol || amountFromYuan) as string;
      const amount = parseAmount(amountText);
      if (amount === null) {
        return match;
      }
      return `${match} ≈ ${formatConvertedMoney(amount, targetCode, rates)}`;
    }
  );
}
