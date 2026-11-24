import { getCurrencyOption, moneyFractionDigits } from "./currencies.ts";
import type { ExchangeRates } from "./types.ts";

export const RATE_API_URL = "https://open.er-api.com/v6/latest/CNY";
export const RATE_TTL_MS = 12 * 60 * 60 * 1000;

/** Approximate multipliers when offline; refreshed values overwrite per key. */
export const FALLBACK_RATES: ExchangeRates = {
  values: {
    USD: 0.138,
    EUR: 0.128,
    GBP: 0.108,
    JPY: 21.4,
    CNY: 1,
    VND: 3500,
    KRW: 195,
    THB: 4.65,
    SGD: 0.185,
    MYR: 0.62,
    IDR: 2250,
    PHP: 7.85,
    HKD: 1.08,
    TWD: 4.45,
    INR: 12.1,
    AUD: 0.212,
    NZD: 0.235,
    CAD: 0.192,
    CHF: 0.12,
    SEK: 1.42,
    NOK: 1.52,
    DKK: 0.96,
    PLN: 0.55,
    CZK: 3.15,
    HUF: 52,
    RUB: 12.5,
    UAH: 5.6,
    TRY: 4.85,
    BRL: 0.78,
    MXN: 2.75,
    ARS: 125,
    CLP: 135,
    COP: 560,
    ZAR: 2.55,
    AED: 0.51,
    SAR: 0.52,
    ILS: 0.5,
    EGP: 6.8,
    PKR: 38.5,
    BDT: 16.2,
    LKR: 42,
    NPR: 18.5,
    MMK: 290,
    KHR: 560,
    LAK: 3050,
    BND: 0.185,
    KZT: 69
  },
  updatedAt: null,
  source: "fallback"
};

export function normalizeExchangeRates(raw: unknown): ExchangeRates {
  const base: ExchangeRates = {
    values: { ...FALLBACK_RATES.values },
    updatedAt: FALLBACK_RATES.updatedAt,
    source: FALLBACK_RATES.source
  };

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const record = raw as Record<string, unknown>;

  if (record.values && typeof record.values === "object" && !Array.isArray(record.values)) {
    const next: Record<string, number> = { ...base.values };
    for (const [key, value] of Object.entries(record.values as Record<string, unknown>)) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) {
        next[key] = num;
      }
    }
    return {
      values: next,
      updatedAt:
        typeof record.updatedAt === "string"
          ? record.updatedAt
          : record.updatedAt === null
            ? null
            : base.updatedAt,
      source: typeof record.source === "string" ? record.source : "stored"
    };
  }

  // Legacy flat-object migration support
  const legacy: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "updatedAt" || key === "source") continue;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      legacy[key] = value;
    }
  }

  return {
    values: { ...base.values, ...legacy },
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : record.updatedAt === null
          ? null
          : base.updatedAt,
    source: typeof record.source === "string" ? record.source : "migrated"
  };
}

export function getRate(rates: ExchangeRates, code: string): number {
  const current = rates.values[code];
  if (typeof current === "number" && Number.isFinite(current) && current > 0) {
    return current;
  }
  const fallback = FALLBACK_RATES.values[code];
  if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }
  return FALLBACK_RATES.values.USD;
}

export function isRatesExpired(rates: ExchangeRates, nowMs = Date.now()): boolean {
  if (!rates.updatedAt) {
    return true;
  }
  const timestamp = new Date(rates.updatedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return nowMs - timestamp > RATE_TTL_MS;
}

export function convertCnyAmount(
  cnyAmount: number,
  targetCode: string,
  rates: ExchangeRates
): number {
  if (!Number.isFinite(cnyAmount)) {
    return 0;
  }
  return cnyAmount * getRate(rates, targetCode);
}

export function formatConvertedMoney(
  cnyAmount: number,
  targetCode: string,
  rates: ExchangeRates
): string {
  const option = getCurrencyOption(targetCode);
  const locale = option?.locale ?? "en-US";
  const code = option?.code ?? targetCode;
  const value = convertCnyAmount(cnyAmount, code, rates);
  const fraction = moneyFractionDigits(code);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      ...fraction
    }).format(value);
  } catch {
    return `${value.toFixed(fraction.maximumFractionDigits)} ${code}`;
  }
}

/** Display multiplier "1 CNY -> X TARGET" in the popup. */
export function formatExchangeRateDisplay(code: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  const option = getCurrencyOption(code);
  const locale = option?.locale ?? "en-US";
  if (value >= 500) {
    return Math.round(value).toLocaleString(locale);
  }
  if (value >= 50) {
    return value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return value.toLocaleString(locale, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  });
}

export function parseManualRateInput(raw: string): number | null {
  const cleaned = raw.trim().replaceAll(",", "").replaceAll(" ", "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseQuickAmountInput(raw: string): number | null {
  const cleaned = raw.trim().replaceAll(",", "").replaceAll(" ", "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function formatUpdatedLabel(updatedAt: string | null, source: string, now = new Date()): string {
  if (!updatedAt) {
    return "Offline fallback rates";
  }
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "Offline fallback rates";
  }
  const timeText = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const dateText = sameDay
    ? timeText
    : `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeText}`;
  const prefix = source === "manual" ? "Manual rate" : "Updated";
  return `${prefix} · ${dateText}`;
}
