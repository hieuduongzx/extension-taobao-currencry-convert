/** Curated for Taobao shoppers; rates are "1 CNY -> target units" (open.er-api.com base CNY). */
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

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

const OPTION_BY_CODE = new Map(CURRENCY_OPTIONS.map((option) => [option.code, option] as const));

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

export function isCurrencyCode(value: string): value is CurrencyCode {
  return OPTION_BY_CODE.has(value as CurrencyCode);
}

export function getCurrencyOption(code: string) {
  return OPTION_BY_CODE.get(code as CurrencyCode);
}

export function sanitizeCurrencyPreference(stored: unknown): CurrencyCode {
  if (typeof stored === "string" && isCurrencyCode(stored)) {
    return stored;
  }
  return DEFAULT_CURRENCY;
}

export function moneyFractionDigits(code: string): {
  minimumFractionDigits: number;
  maximumFractionDigits: number;
} {
  if (ZERO_DECIMAL_MONEY.has(code)) {
    return { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  }
  return { minimumFractionDigits: 2, maximumFractionDigits: 2 };
}

export function filterCurrencyOptions(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return CURRENCY_OPTIONS;
  }
  return CURRENCY_OPTIONS.filter(
    (item) =>
      item.label.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized) ||
      item.symbol.toLowerCase().includes(normalized)
  );
}
