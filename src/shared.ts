/** Curated for Taobao shoppers; rates are “1 CNY → this many units of target” (same as open.er-api.com base CNY). */

export const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", label: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", locale: "zh-CN" },
  { code: "VND", label: "Vietnamese Dong", symbol: "₫", locale: "vi-VN" },
  { code: "KRW", label: "South Korean Won", symbol: "₩", locale: "ko-KR" },
  { code: "THB", label: "Thai Baht", symbol: "฿", locale: "th-TH" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", locale: "ms-MY" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID" },
  { code: "PHP", label: "Philippine Peso", symbol: "₱", locale: "en-PH" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", locale: "zh-HK" },
  { code: "TWD", label: "Taiwan Dollar", symbol: "NT$", locale: "zh-TW" },
  { code: "INR", label: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  { code: "SEK", label: "Swedish Krona", symbol: "kr", locale: "sv-SE" },
  { code: "NOK", label: "Norwegian Krone", symbol: "kr", locale: "nb-NO" },
  { code: "DKK", label: "Danish Krone", symbol: "kr", locale: "da-DK" },
  { code: "PLN", label: "Polish Zloty", symbol: "zł", locale: "pl-PL" },
  { code: "CZK", label: "Czech Koruna", symbol: "Kč", locale: "cs-CZ" },
  { code: "HUF", label: "Hungarian Forint", symbol: "Ft", locale: "hu-HU" },
  { code: "RUB", label: "Russian Ruble", symbol: "₽", locale: "ru-RU" },
  { code: "UAH", label: "Ukrainian Hryvnia", symbol: "₴", locale: "uk-UA" },
  { code: "TRY", label: "Turkish Lira", symbol: "₺", locale: "tr-TR" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
  { code: "MXN", label: "Mexican Peso", symbol: "MX$", locale: "es-MX" },
  { code: "ARS", label: "Argentine Peso", symbol: "AR$", locale: "es-AR" },
  { code: "CLP", label: "Chilean Peso", symbol: "CL$", locale: "es-CL" },
  { code: "COP", label: "Colombian Peso", symbol: "COL$", locale: "es-CO" },
  { code: "ZAR", label: "South African Rand", symbol: "R", locale: "en-ZA" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ", locale: "ar-AE" },
  { code: "SAR", label: "Saudi Riyal", symbol: "﷼", locale: "ar-SA" },
  { code: "ILS", label: "Israeli Shekel", symbol: "₪", locale: "he-IL" },
  { code: "EGP", label: "Egyptian Pound", symbol: "E£", locale: "ar-EG" },
  { code: "PKR", label: "Pakistani Rupee", symbol: "₨", locale: "en-PK" },
  { code: "BDT", label: "Bangladeshi Taka", symbol: "৳", locale: "bn-BD" },
  { code: "LKR", label: "Sri Lankan Rupee", symbol: "Rs", locale: "si-LK" },
  { code: "NPR", label: "Nepalese Rupee", symbol: "रू", locale: "ne-NP" },
  { code: "MMK", label: "Myanmar Kyat", symbol: "K", locale: "my-MM" },
  { code: "KHR", label: "Cambodian Riel", symbol: "៛", locale: "km-KH" },
  { code: "LAK", label: "Lao Kip", symbol: "₭", locale: "lo-LA" },
  { code: "BND", label: "Brunei Dollar", symbol: "B$", locale: "ms-BN" },
  { code: "KZT", label: "Kazakhstani Tenge", symbol: "₸", locale: "kk-KZ" }
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["code"];

const OPTION_BY_CODE = new Map(CURRENCY_OPTIONS.map((o) => [o.code, o] as const));

export function isCurrencyCode(value: string): value is CurrencyCode {
  return OPTION_BY_CODE.has(value as CurrencyCode);
}

export function getCurrencyOption(code: string) {
  return OPTION_BY_CODE.get(code as CurrencyCode);
}

/** ISO 4217 minor units for money display (converted amounts on page). */
const ZERO_DECIMAL_MONEY = new Set<string>([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
  "IDR",
  "HUF",
  "TWD"
]);

export type ExchangeRates = {
  /** 1 CNY → this many units of `code` */
  values: Record<string, number>;
  updatedAt: string | null;
  source: string;
};

export type SettingsPayload = {
  currency: CurrencyCode;
  rates: ExchangeRates;
};

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const STORAGE_KEYS = {
  currency: "tbccTargetCurrency",
  rates: "tbccExchangeRates",
  autoUpdate: "tbccAutoUpdate"
} as const;

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

export const RATE_API_URL = "https://open.er-api.com/v6/latest/CNY";

export function normalizeExchangeRates(raw: unknown): ExchangeRates {
  const base: ExchangeRates = {
    values: { ...FALLBACK_RATES.values },
    updatedAt: FALLBACK_RATES.updatedAt,
    source: FALLBACK_RATES.source
  };

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const o = raw as Record<string, unknown>;

  if (o.values && typeof o.values === "object" && !Array.isArray(o.values)) {
    const next: Record<string, number> = { ...base.values };
    for (const [k, v] of Object.entries(o.values as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) {
        next[k] = n;
      }
    }
    return {
      values: next,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : o.updatedAt === null ? null : base.updatedAt,
      source: typeof o.source === "string" ? o.source : base.source ?? "stored"
    };
  }

  const legacy: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "updatedAt" || k === "source") continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      legacy[k] = v;
    }
  }

  return {
    values: { ...base.values, ...legacy },
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : o.updatedAt === null ? null : base.updatedAt,
    source: typeof o.source === "string" ? o.source : "migrated"
  };
}

export function getRate(rates: ExchangeRates, code: string): number {
  const v = rates.values[code];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  const fb = FALLBACK_RATES.values[code];
  if (typeof fb === "number" && Number.isFinite(fb)) {
    return fb;
  }
  return FALLBACK_RATES.values.USD;
}

export function moneyFractionDigits(code: string): { minimumFractionDigits: number; maximumFractionDigits: number } {
  if (ZERO_DECIMAL_MONEY.has(code)) {
    return { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  }
  return { minimumFractionDigits: 2, maximumFractionDigits: 2 };
}

export function formatConvertedMoney(cnyAmount: number, targetCode: string, rates: ExchangeRates): string {
  const opt = getCurrencyOption(targetCode);
  const locale = opt?.locale ?? "en-US";
  const code = (opt?.code ?? targetCode) as string;
  const value = cnyAmount * getRate(rates, code);
  const frac = moneyFractionDigits(code);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      ...frac
    }).format(value);
  } catch {
    return `${value.toFixed(frac.maximumFractionDigits)} ${code}`;
  }
}

/** Display multiplier “1 CNY → X TARGET” in the popup. */
export function formatExchangeRateDisplay(code: string, value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const opt = getCurrencyOption(code);
  const locale = opt?.locale ?? "en-US";
  if (value >= 500) {
    return Math.round(value).toLocaleString(locale);
  }
  if (value >= 50) {
    return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function sanitizeCurrencyPreference(stored: unknown): CurrencyCode {
  if (typeof stored === "string" && isCurrencyCode(stored)) {
    return stored;
  }
  return DEFAULT_CURRENCY;
}
