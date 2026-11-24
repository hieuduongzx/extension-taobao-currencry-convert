import {
  FALLBACK_RATES,
  RATE_API_URL,
  STORAGE_KEYS,
  ensureStorageDefaults,
  isRatesExpired,
  loadStoredRates,
  loadStoredSettings,
  normalizeExchangeRates,
  sanitizeCurrencyPreference,
  sanitizeThemeMode,
  saveAutoUpdatePreference,
  saveCurrencyPreference,
  saveStoredRates,
  saveThemePreference,
  type ExchangeRates,
  type RuntimeMessage
} from "./shared/index.ts";

const ALARM_NAME = "tbcc-refresh-rates";

async function isAutoUpdateEnabled(): Promise<boolean> {
  const data = await chrome.storage.sync.get([STORAGE_KEYS.autoUpdate]);
  return data[STORAGE_KEYS.autoUpdate] !== false;
}

async function fetchLiveRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch(RATE_API_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (payload.result !== "success" || !payload.rates) {
      throw new Error("Invalid rates payload");
    }

    const values: Record<string, number> = { ...FALLBACK_RATES.values };
    for (const [code, raw] of Object.entries(payload.rates)) {
      const numeric = Number(raw);
      if (Number.isFinite(numeric) && numeric > 0) {
        values[code] = numeric;
      }
    }

    if (!Number.isFinite(values.CNY) || values.CNY <= 0) {
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

async function refreshRates(force = false): Promise<ExchangeRates> {
  const currentRates = await loadStoredRates();

  if (!force) {
    const autoEnabled = await isAutoUpdateEnabled();
    if (!autoEnabled) return currentRates;
    if (!isRatesExpired(currentRates)) return currentRates;
  }

  const latestRates = await fetchLiveRates();
  await saveStoredRates(latestRates);
  return latestRates;
}

function scheduleRateAlarm(): void {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureStorageDefaults();
  await refreshRates(true);
  scheduleRateAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureStorageDefaults();
  await refreshRates(false);
  scheduleRateAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await refreshRates(false);
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  const handleMessage = async () => {
    switch (message.type) {
      case "tbcc:getSettings":
        return loadStoredSettings();

      case "tbcc:setCurrency": {
        const currency = sanitizeCurrencyPreference(message.currency);
        await saveCurrencyPreference(currency);
        return { ok: true };
      }

      case "tbcc:setAutoUpdate":
        await saveAutoUpdatePreference(Boolean(message.enabled));
        return { ok: true };

      case "tbcc:setTheme": {
        const theme = sanitizeThemeMode(message.theme);
        await saveThemePreference(theme);
        return { ok: true };
      }

      case "tbcc:updateRate": {
        const numericRate = Number(message.rate);
        if (!Number.isFinite(numericRate) || numericRate <= 0) {
          return { ok: false };
        }
        const settings = await loadStoredSettings();
        const nextRates: ExchangeRates = {
          ...settings.rates,
          values: {
            ...settings.rates.values,
            [settings.currency]: numericRate
          },
          updatedAt: new Date().toISOString(),
          source: "manual"
        };
        await saveStoredRates(nextRates);
        await saveAutoUpdatePreference(false);
        return { ok: true, rates: nextRates };
      }

      case "tbcc:refreshRates": {
        const rates = await refreshRates(true);
        return { ok: true, rates };
      }

      default:
        return { ok: false };
    }
  };

  handleMessage()
    .then((payload) => sendResponse(payload))
    .catch(() => sendResponse({ ok: false }));

  return true;
});
