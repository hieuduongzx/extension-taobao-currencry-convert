import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_THEME,
  FALLBACK_RATES,
  RATE_TTL_MS,
  STORAGE_KEYS,
  containsCny,
  convertCnyAmount,
  convertPriceText,
  extractAmountFromText,
  filterCurrencyOptions,
  formatConvertedMoney,
  formatExchangeRateDisplay,
  formatUpdatedLabel,
  getCurrencyOption,
  getRate,
  isCurrencyCode,
  isCurrencySymbolText,
  isRatesExpired,
  isStrictAmount,
  moneyFractionDigits,
  normalizeExchangeRates,
  parseAmount,
  parseManualRateInput,
  parseQuickAmountInput,
  sanitizeCurrencyPreference,
  sanitizeThemeMode
} from "../src/shared/index.ts";

test("preserves legacy storage keys for backwards compatibility", () => {
  assert.equal(STORAGE_KEYS.currency, "tbccTargetCurrency");
  assert.equal(STORAGE_KEYS.rates, "tbccExchangeRates");
  assert.equal(STORAGE_KEYS.autoUpdate, "tbccAutoUpdate");
  assert.equal(STORAGE_KEYS.theme, "tbccTheme");
});

test("validates and sanitizes currency codes & theme modes", () => {
  assert.equal(isCurrencyCode("USD"), true);
  assert.equal(isCurrencyCode("VND"), true);
  assert.equal(isCurrencyCode("FAKE"), false);
  assert.equal(sanitizeCurrencyPreference("VND"), "VND");
  assert.equal(sanitizeCurrencyPreference("INVALID"), DEFAULT_CURRENCY);
  assert.equal(sanitizeCurrencyPreference(null), DEFAULT_CURRENCY);
  assert.equal(getCurrencyOption("VND")?.symbol, "₫");

  assert.equal(sanitizeThemeMode("dark"), "dark");
  assert.equal(sanitizeThemeMode("light"), "light");
  assert.equal(sanitizeThemeMode("system"), "system");
  assert.equal(sanitizeThemeMode("sepia"), DEFAULT_THEME);
});

test("filters currency options by code, name, and symbol", () => {
  assert.equal(filterCurrencyOptions("").length, CURRENCY_OPTIONS.length);
  const vndMatches = filterCurrencyOptions("dong");
  assert.ok(vndMatches.some((item) => item.code === "VND"));
  const symbolMatches = filterCurrencyOptions("₫");
  assert.equal(symbolMatches.length, 1);
  assert.equal(symbolMatches[0].code, "VND");
});

test("normalizes modern, legacy, and malformed exchange rates", () => {
  const fromNull = normalizeExchangeRates(null);
  assert.equal(fromNull.source, "fallback");
  assert.equal(fromNull.values.USD, FALLBACK_RATES.values.USD);

  const modern = normalizeExchangeRates({
    values: { USD: 0.145, VND: 3650, BAD: -5, NAN: "oops" },
    updatedAt: "2026-11-24T10:00:00.000Z",
    source: "open.er-api.com"
  });
  assert.equal(modern.values.USD, 0.145);
  assert.equal(modern.values.VND, 3650);
  assert.equal(modern.values.BAD, undefined);
  assert.equal(modern.values.EUR, FALLBACK_RATES.values.EUR);
  assert.equal(modern.source, "open.er-api.com");

  const legacy = normalizeExchangeRates({
    USD: 0.15,
    VND: 3700,
    updatedAt: "2026-11-24T09:00:00.000Z"
  });
  assert.equal(legacy.values.USD, 0.15);
  assert.equal(legacy.values.VND, 3700);
  assert.equal(legacy.source, "migrated");
});

test("computes rate expiry accurately", () => {
  const now = Date.parse("2026-11-24T12:00:00.000Z");
  assert.equal(isRatesExpired(FALLBACK_RATES, now), true);

  const fresh = {
    ...FALLBACK_RATES,
    updatedAt: new Date(now - RATE_TTL_MS + 60_000).toISOString()
  };
  assert.equal(isRatesExpired(fresh, now), false);

  const stale = {
    ...FALLBACK_RATES,
    updatedAt: new Date(now - RATE_TTL_MS - 60_000).toISOString()
  };
  assert.equal(isRatesExpired(stale, now), true);
});

test("converts and formats currency values accurately", () => {
  const sampleRates = normalizeExchangeRates({
    values: { USD: 0.14, VND: 3500, JPY: 21.5 },
    updatedAt: "2026-11-24T10:00:00.000Z",
    source: "open.er-api.com"
  });

  assert.equal(getRate(sampleRates, "USD"), 0.14);
  assert.equal(moneyFractionDigits("USD").maximumFractionDigits, 2);
  assert.equal(moneyFractionDigits("VND").maximumFractionDigits, 0);
  assert.equal(moneyFractionDigits("JPY").maximumFractionDigits, 0);

  assert.equal(Math.round(convertCnyAmount(100, "USD", sampleRates) * 100) / 100, 14);
  assert.equal(formatConvertedMoney(100, "USD", sampleRates), "$14.00");
  assert.match(formatConvertedMoney(100, "VND", sampleRates), /350[.,]000/);
  assert.equal(formatExchangeRateDisplay("USD", 0.149717), "0.149717");
  assert.equal(formatExchangeRateDisplay("VND", 3521.8), "3.522");
  assert.equal(formatExchangeRateDisplay("USD", -1), "—");
});

test("parses manual rate and quick converter inputs safely", () => {
  assert.equal(parseManualRateInput("3,650.5"), 3650.5);
  assert.equal(parseManualRateInput("0"), null);
  assert.equal(parseManualRateInput("-12"), null);
  assert.equal(parseManualRateInput("abc"), null);

  assert.equal(parseQuickAmountInput("1,299.50"), 1299.5);
  assert.equal(parseQuickAmountInput("0"), 0);
  assert.equal(parseQuickAmountInput("-5"), null);
  assert.equal(parseQuickAmountInput(""), null);
});

test("formats updated label for fallback, live, and manual rates", () => {
  assert.equal(formatUpdatedLabel(null, "fallback"), "Offline fallback rates");
  const now = new Date("2026-11-24T14:30:00.000Z");
  const liveLabel = formatUpdatedLabel("2026-11-24T14:15:00.000Z", "open.er-api.com", now);
  assert.ok(liveLabel.startsWith("Updated · "));
  const manualLabel = formatUpdatedLabel("2026-11-24T14:15:00.000Z", "manual", now);
  assert.ok(manualLabel.startsWith("Manual rate · "));
});

test("detects and converts Taobao CNY price strings cleanly and idempotently", () => {
  const sampleRates = normalizeExchangeRates({
    values: { USD: 0.14, EUR: 0.13 },
    updatedAt: "2026-11-24T10:00:00.000Z",
    source: "open.er-api.com"
  });

  assert.equal(containsCny("¥199.00"), true);
  assert.equal(containsCny("￥1,299"), true);
  assert.equal(containsCny("Shipping 15元"), true);
  assert.equal(containsCny("Free shipping"), false);

  assert.equal(isCurrencySymbolText("¥"), true);
  assert.equal(isCurrencySymbolText(" ￥ "), true);
  assert.equal(isCurrencySymbolText("$"), false);

  assert.equal(isStrictAmount("1,299.50"), true);
  assert.equal(isStrictAmount("199.00"), true);
  assert.equal(isStrictAmount("¥199"), false);

  assert.equal(parseAmount("1,299.50"), 1299.5);
  assert.equal(extractAmountFromText("Price 299.00 only"), 299);

  const firstPass = convertPriceText("Coupon ¥50 · Shipping 10元", "USD", sampleRates);
  assert.equal(firstPass, "Coupon ¥50 ≈ $7.00 · Shipping 10元 ≈ $1.40");

  // Re-converting with a new currency replaces previous conversion cleanly
  const secondPass = convertPriceText(firstPass, "EUR", sampleRates);
  assert.ok(secondPass.includes("¥50 ≈ "));
  assert.ok(secondPass.includes("10元 ≈ "));
  assert.equal(secondPass.includes("$7.00"), false);
});
