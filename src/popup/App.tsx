import { useEffect, useMemo, useState } from "react";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  STORAGE_KEYS,
  formatExchangeRateDisplay,
  getRate,
  normalizeExchangeRates,
  sanitizeCurrencyPreference,
  type CurrencyCode,
  type ExchangeRates
} from "../shared";

type SettingsResponse = {
  currency?: CurrencyCode;
  rates?: ExchangeRates;
  autoUpdate?: boolean;
};

const IconArrowRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const IconRefresh = ({ className }: { className?: string }) => (
  <svg className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const IconCurrency = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export function App() {
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<ExchangeRates>(() => normalizeExchangeRates(FALLBACK_RATES));
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [status, setStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [currencyQuery, setCurrencyQuery] = useState("");

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    if (!q) {
      return CURRENCY_OPTIONS;
    }
    return CURRENCY_OPTIONS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    );
  }, [currencyQuery]);

  const updatedLabel = useMemo(() => {
    if (!rates.updatedAt) {
      return "Using fallback rates";
    }
    const date = new Date(rates.updatedAt);
    return `Updated: ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} Today`;
  }, [rates.updatedAt]);

  useEffect(() => {
    let disposed = false;

    const loadSettings = async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: "tbcc:getSettings"
        })) as SettingsResponse;

        if (disposed) return;
        setCurrency(sanitizeCurrencyPreference(response.currency));
        setRates(normalizeExchangeRates(response.rates ?? FALLBACK_RATES));
        setAutoUpdate(response.autoUpdate !== false);
      } catch {
        const [syncData, localData] = await Promise.all([
          chrome.storage.sync.get([STORAGE_KEYS.currency, STORAGE_KEYS.autoUpdate]),
          chrome.storage.local.get([STORAGE_KEYS.rates])
        ]);

        if (disposed) return;
        setCurrency(sanitizeCurrencyPreference(syncData[STORAGE_KEYS.currency]));
        setRates(normalizeExchangeRates(localData[STORAGE_KEYS.rates]));
        setAutoUpdate(syncData[STORAGE_KEYS.autoUpdate] !== false);
      }
    };

    loadSettings();
    return () => {
      disposed = true;
    };
  }, []);

  const onCurrencyChange = async (nextCurrency: CurrencyCode) => {
    setCurrency(nextCurrency);
    await chrome.runtime.sendMessage({
      type: "tbcc:setCurrency",
      currency: nextCurrency
    });
    setEditingRate(null);
    setStatus(`Switched to ${nextCurrency}`);
    setTimeout(() => setStatus(""), 2000);
  };

  const onToggleAutoUpdate = async (enabled: boolean) => {
    setAutoUpdate(enabled);
    await chrome.runtime.sendMessage({
      type: "tbcc:setAutoUpdate",
      enabled
    });
    setStatus(enabled ? "Auto-update enabled" : "Auto-update disabled");
    setTimeout(() => setStatus(""), 2000);
  };

  const onRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRate === null) return;

    const cleanValue = editingRate.replace(/,/g, "");
    const newRate = parseFloat(cleanValue);

    if (isNaN(newRate) || newRate <= 0) {
      setStatus("Invalid rate");
      return;
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: "tbcc:updateRate",
        rate: newRate
      })) as { ok: boolean; rates: ExchangeRates };

      if (response.ok) {
        setRates(normalizeExchangeRates(response.rates));
        setAutoUpdate(false);
        setEditingRate(null);
        setStatus("Rate saved manually");
      }
    } catch {
      setStatus("Save failed");
    } finally {
      setTimeout(() => setStatus(""), 2000);
    }
  };

  const onRefreshRate = async () => {
    setIsRefreshing(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "tbcc:refreshRates"
      })) as { ok?: boolean; rates?: ExchangeRates };

      if (response?.ok && response.rates) {
        setRates(normalizeExchangeRates(response.rates));
        setStatus("Exchange rates updated");
      } else {
        setStatus("Refresh failed");
      }
    } catch {
      setStatus("Error connection");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setStatus(""), 2000);
    }
  };

  const currentRateValue = getRate(rates, currency);

  return (
    <div className="w-[360px] bg-zinc-950 text-zinc-50 font-sans selection:bg-orange-500/30 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-orange-500/8 via-amber-500/4 to-transparent pointer-events-none" />
      <div className="absolute top-[-60px] left-[-40px] w-36 h-36 bg-orange-600/15 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute top-[-30px] right-[-30px] w-28 h-28 bg-amber-500/10 blur-[60px] rounded-full pointer-events-none" />

      <div className="relative px-5 pt-5 pb-4 flex flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25 border border-white/10 shrink-0">
                <IconCurrency />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950"
                  style={{ backgroundColor: autoUpdate ? "#10b981" : "#f59e0b" }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold tracking-tight text-white leading-tight">Taobao Convert</span>
                <span className="text-[11px] font-medium text-zinc-500">40+ currencies · live rates</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-300 ${
                  autoUpdate
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${autoUpdate ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {autoUpdate ? "LIVE" : "MANUAL"}
              </div>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        </header>

        <div className="flex flex-col gap-3.5">
          <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 shrink-0">Currency</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-zinc-500">Auto</span>
                <button
                  type="button"
                  onClick={() => onToggleAutoUpdate(!autoUpdate)}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                    autoUpdate ? "bg-orange-500" : "bg-zinc-800 border-white/8"
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                      autoUpdate ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <input
              type="search"
              placeholder="Search code or name…"
              value={currencyQuery}
              onChange={(e) => setCurrencyQuery(e.target.value)}
              className="w-full h-9 rounded-lg bg-zinc-950/80 border border-white/8 px-3 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              autoComplete="off"
            />

            <div className="tbcc-scrollbar max-h-[200px] overflow-y-auto pl-0.5 pr-2 grid grid-cols-2 gap-1.5">
              {filteredCurrencies.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => onCurrencyChange(item.code)}
                  className={`flex flex-col items-start justify-center rounded-xl border p-2.5 transition-all text-left min-h-[52px] ${
                    currency === item.code
                      ? "border-orange-500/50 bg-orange-500/10 text-white shadow-sm shadow-orange-500/10"
                      : "border-white/5 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-900/60 hover:border-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1 mb-0.5">
                    <span className="text-[13px] font-bold leading-tight">{item.code}</span>
                    <span className={`text-[14px] font-bold shrink-0 ${currency === item.code ? "text-orange-400" : "text-zinc-500"}`}>
                      {item.symbol}
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-zinc-500 line-clamp-2 leading-snug">{item.label}</span>
                </button>
              ))}
            </div>
            {filteredCurrencies.length === 0 && (
              <p className="text-[11px] text-zinc-500 text-center py-2">No currency matches.</p>
            )}
          </div>

          <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 transition-all duration-200 hover:bg-zinc-900/60 hover:border-white/8">
            <div className="flex flex-col p-3.5 relative z-10 w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Exchange Rate</span>
                {autoUpdate && (
                  <button
                    type="button"
                    onClick={onRefreshRate}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-all disabled:opacity-50"
                  >
                    <IconRefresh className={isRefreshing ? "animate-spin w-3 h-3" : "w-3 h-3"} />
                    {isRefreshing ? "Updating..." : "Refresh"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[16px] font-bold text-white leading-none">1</span>
                <span className="text-[11px] font-medium text-zinc-500">CNY</span>
                <div className="mx-1 text-zinc-600">
                  <IconArrowRight />
                </div>

                {editingRate !== null ? (
                  <form onSubmit={onRateSubmit} className="flex flex-1 items-center gap-2 min-w-[200px]">
                    <input
                      autoFocus
                      type="text"
                      value={editingRate}
                      onChange={(e) => setEditingRate(e.target.value)}
                      className="w-full h-8 rounded-lg bg-zinc-950/80 border border-white/8 px-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:bg-zinc-950 transition-all duration-200 font-mono"
                    />
                    <button
                      type="submit"
                      className="h-8 flex items-center justify-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 rounded-md border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      SAVE
                    </button>
                  </form>
                ) : (
                  <div
                    className="group flex flex-1 items-baseline gap-1.5 cursor-pointer relative min-w-0"
                    onClick={() => setEditingRate(currentRateValue.toString())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditingRate(currentRateValue.toString());
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="text-[22px] sm:text-[26px] font-black text-orange-400 tracking-tight leading-none break-all">
                      {formatExchangeRateDisplay(currency, currentRateValue)}
                    </span>
                    <span className="text-[11px] font-bold text-orange-500/60 uppercase shrink-0">{currency}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-zinc-500 ml-2 transition-opacity">
                      Edit
                    </span>
                  </div>
                )}
              </div>

              <div className="h-px bg-white/5 w-full mb-3" />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-500 font-medium">{updatedLabel}</span>
                <span className="text-[10px] text-zinc-600 italic shrink-0">via OpenRate</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-1 mt-2 min-h-[16px]">
          {status && (
            <p className="text-[11px] font-medium text-emerald-400 animate-in fade-in slide-in-from-bottom-1 max-w-[280px] truncate">
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
