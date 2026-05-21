import {
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  RATE_API_URL,
  STORAGE_KEYS,
  normalizeExchangeRates,
  sanitizeCurrencyPreference,
  type CurrencyCode,
  type ExchangeRates
} from "./shared";

const ALARM_NAME = "tbcc-refresh-rates";
const RATE_TTL_MS = 12 * 60 * 60 * 1000;

type RuntimeMessage =
  | { type: "tbcc:getSettings" }
  | { type: "tbcc:setCurrency"; currency: CurrencyCode }
  | { type: "tbcc:updateRate"; rate: number }
  | { type: "tbcc:setAutoUpdate"; enabled: boolean }
  | { type: "tbcc:refreshRates" };

async function isAutoUpdateEnabled(): Promise<boolean> {
  const data = await chrome.storage.sync.get([STORAGE_KEYS.autoUpdate]);
  return data[STORAGE_KEYS.autoUpdate] !== false;
}

async function fetchRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch(RATE_API_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { result?: string; rates?: Record<string, number> };
    if (payload.result !== "success" || !payload.rates) {
      throw new Error("Invalid rates payload");
    }

    const values: Record<string, number> = { ...FALLBACK_RATES.values };
    for (const [code, raw] of Object.entries(payload.rates)) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        values[code] = n;
      }
    }

    if (!Number.isFinite(values.CNY)) {
      values.CNY = 1;
    }

    return {
      values,
      updatedAt: new Date().toISOString(),
      source: "open.er-api.com"
    };
  } catch {
    return normalizeExchangeRates(FALLBACK_RATES);
  }
}

function isRatesExpired(rates: ExchangeRates): boolean {
  if (!rates.updatedAt) {
    return true;
  }

  const timestamp = new Date(rates.updatedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return true;
  }

  return Date.now() - timestamp > RATE_TTL_MS;
}

async function getStoredRates(): Promise<ExchangeRates> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.rates]);
  return normalizeExchangeRates(data[STORAGE_KEYS.rates]);
}

async function refreshRates(force = false): Promise<ExchangeRates> {
  const currentRates = await getStoredRates();

  if (!force) {
    const autoEnabled = await isAutoUpdateEnabled();
    if (!autoEnabled) return currentRates;
    if (!isRatesExpired(currentRates)) return currentRates;
  }

  const latestRates = await fetchRates();
  await chrome.storage.local.set({ [STORAGE_KEYS.rates]: latestRates });
  return latestRates;
}

async function ensureDefaults() {
  const syncData = await chrome.storage.sync.get([STORAGE_KEYS.currency, STORAGE_KEYS.autoUpdate]);
  if (!syncData[STORAGE_KEYS.currency]) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.currency]: DEFAULT_CURRENCY });
  } else {
    const cur = sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]);
    if (cur !== syncData[STORAGE_KEYS.currency]) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.currency]: cur });
    }
  }
  if (syncData[STORAGE_KEYS.autoUpdate] === undefined) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.autoUpdate]: true });
  }

  const localData = await chrome.storage.local.get([STORAGE_KEYS.rates]);
  if (!localData[STORAGE_KEYS.rates]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.rates]: normalizeExchangeRates(FALLBACK_RATES) });
  }
}

async function getSettings() {
  const [syncData, rates] = await Promise.all([
    chrome.storage.sync.get([STORAGE_KEYS.currency, STORAGE_KEYS.autoUpdate]),
    getStoredRates()
  ]);

  return {
    currency: sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]),
    autoUpdate: syncData[STORAGE_KEYS.autoUpdate] !== false,
    rates
  };
}

function scheduleRateAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await refreshRates(true);
  scheduleRateAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await refreshRates(false);
  scheduleRateAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await refreshRates(false);
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  const handler = async () => {
    if (message.type === "tbcc:getSettings") {
      return getSettings();
    }

    if (message.type === "tbcc:setCurrency") {
      await chrome.storage.sync.set({ [STORAGE_KEYS.currency]: message.currency });
      return { ok: true };
    }

    if (message.type === "tbcc:setAutoUpdate") {
      await chrome.storage.sync.set({ [STORAGE_KEYS.autoUpdate]: message.enabled });
      return { ok: true };
    }

    if (message.type === "tbcc:updateRate") {
      const settings = await getSettings();
      const newRates: ExchangeRates = {
        ...settings.rates,
        values: {
          ...settings.rates.values,
          [settings.currency]: message.rate
        },
        updatedAt: new Date().toISOString()
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.rates]: newRates });
      await chrome.storage.sync.set({ [STORAGE_KEYS.autoUpdate]: false });
      return { ok: true, rates: newRates };
    }

    if (message.type === "tbcc:refreshRates") {
      const rates = await refreshRates(true);
      return { ok: true, rates };
    }

    return { ok: false };
  };

  handler()
    .then((payload) => sendResponse(payload))
    .catch(() => sendResponse({ ok: false }));

  return true;
});
