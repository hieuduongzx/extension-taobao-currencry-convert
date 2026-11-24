import {
  DEFAULT_CURRENCY,
  sanitizeCurrencyPreference,
  type CurrencyCode
} from "./currencies.ts";
import { FALLBACK_RATES, normalizeExchangeRates } from "./rates.ts";
import type { ExchangeRates, ThemeMode } from "./types.ts";

/** Preserved storage keys for 100% backwards compatibility with existing user data. */
export const STORAGE_KEYS = {
  currency: "tbccTargetCurrency",
  rates: "tbccExchangeRates",
  autoUpdate: "tbccAutoUpdate",
  theme: "tbccTheme"
} as const;

export const DEFAULT_THEME: ThemeMode = "system";

export function sanitizeThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return DEFAULT_THEME;
}

export interface StoredSettings {
  currency: CurrencyCode;
  autoUpdate: boolean;
  theme: ThemeMode;
  rates: ExchangeRates;
}

export async function loadStoredRates(): Promise<ExchangeRates> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.rates]);
  return normalizeExchangeRates(data[STORAGE_KEYS.rates]);
}

export async function saveStoredRates(rates: ExchangeRates): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.rates]: rates });
}

export async function loadStoredSettings(): Promise<StoredSettings> {
  const [syncData, rates] = await Promise.all([
    chrome.storage.sync.get([
      STORAGE_KEYS.currency,
      STORAGE_KEYS.autoUpdate,
      STORAGE_KEYS.theme
    ]),
    loadStoredRates()
  ]);

  return {
    currency: sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]),
    autoUpdate: syncData[STORAGE_KEYS.autoUpdate] !== false,
    theme: sanitizeThemeMode(syncData[STORAGE_KEYS.theme]),
    rates
  };
}

export async function ensureStorageDefaults(): Promise<void> {
  const syncData = await chrome.storage.sync.get([
    STORAGE_KEYS.currency,
    STORAGE_KEYS.autoUpdate
  ]);

  const syncPatch: Record<string, unknown> = {};
  if (!syncData[STORAGE_KEYS.currency]) {
    syncPatch[STORAGE_KEYS.currency] = DEFAULT_CURRENCY;
  } else {
    const sanitized = sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]);
    if (sanitized !== syncData[STORAGE_KEYS.currency]) {
      syncPatch[STORAGE_KEYS.currency] = sanitized;
    }
  }
  if (syncData[STORAGE_KEYS.autoUpdate] === undefined) {
    syncPatch[STORAGE_KEYS.autoUpdate] = true;
  }

  if (Object.keys(syncPatch).length > 0) {
    await chrome.storage.sync.set(syncPatch);
  }

  const localData = await chrome.storage.local.get([STORAGE_KEYS.rates]);
  if (!localData[STORAGE_KEYS.rates]) {
    await saveStoredRates(normalizeExchangeRates(FALLBACK_RATES));
  }
}

export async function saveCurrencyPreference(currency: CurrencyCode): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.currency]: currency });
}

export async function saveAutoUpdatePreference(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.autoUpdate]: enabled });
}

export async function saveThemePreference(theme: ThemeMode): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.theme]: theme });
}
