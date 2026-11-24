import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_THEME,
  FALLBACK_RATES,
  STORAGE_KEYS,
  filterCurrencyOptions,
  formatConvertedMoney,
  formatExchangeRateDisplay,
  formatUpdatedLabel,
  getCurrencyOption,
  getRate,
  loadStoredSettings,
  normalizeExchangeRates,
  parseManualRateInput,
  parseQuickAmountInput,
  sanitizeCurrencyPreference,
  sanitizeThemeMode,
  type CurrencyCode,
  type ExchangeRates,
  type RuntimeMessage,
  type ThemeMode
} from "../shared/index.ts";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  MonitorIcon,
  MoonIcon,
  PencilIcon,
  RefreshIcon,
  SearchIcon,
  SunIcon,
  XIcon
} from "./Icons.tsx";
import { Switch } from "./Switch.tsx";
import { useApplyTheme } from "./useApplyTheme.ts";

interface SettingsResponse {
  currency?: string;
  rates?: ExchangeRates;
  autoUpdate?: boolean;
  theme?: ThemeMode;
}

interface StatusToast {
  text: string;
  tone: "ok" | "error";
}

const QUICK_PRESETS = ["50", "100", "500", "1000"] as const;

const THEME_CYCLE: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system"
};

const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Theme: System (click for Light)",
  light: "Theme: Light (click for Dark)",
  dark: "Theme: Dark (click for System)"
};

export function App() {
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<ExchangeRates>(() => normalizeExchangeRates(FALLBACK_RATES));
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [status, setStatus] = useState<StatusToast | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState("100");
  const [copied, setCopied] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useApplyTheme(theme);

  const flashStatus = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setStatus({ text, tone });
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatus(null);
      statusTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const filteredCurrencies = useMemo(() => filterCurrencyOptions(currencyQuery), [currencyQuery]);
  const selectedOption = useMemo(
    () => getCurrencyOption(currency) ?? CURRENCY_OPTIONS[0],
    [currency]
  );

  const currentRateValue = getRate(rates, currency);
  const formattedRate = useMemo(
    () => formatExchangeRateDisplay(currency, currentRateValue),
    [currency, currentRateValue]
  );

  const updatedLabel = useMemo(
    () => formatUpdatedLabel(rates.updatedAt, rates.source),
    [rates.updatedAt, rates.source]
  );

  const quickConvertedText = useMemo(() => {
    const parsed = parseQuickAmountInput(quickAmount);
    if (parsed === null) {
      return "—";
    }
    return formatConvertedMoney(parsed, currency, rates);
  }, [quickAmount, currency, rates]);

  const statusDotClass = useMemo(() => {
    if (!autoUpdate || rates.source === "manual") return "is-manual";
    if (!rates.updatedAt || rates.source === "fallback") return "is-fallback";
    return "is-live";
  }, [autoUpdate, rates.source, rates.updatedAt]);

  const headerSubtitle = useMemo(() => {
    const modeLabel = !autoUpdate || rates.source === "manual" ? "Manual" : "Live";
    return `${modeLabel} · 1 CNY = ${formattedRate} ${currency}`;
  }, [autoUpdate, rates.source, formattedRate, currency]);

  const logoSrc = useMemo(() => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL("public/icons/icon-128.png");
      }
    } catch {
      // Fallback for non-extension preview
    }
    return "/icons/icon-128.png";
  }, []);

  useEffect(() => {
    let disposed = false;

    const loadSettings = async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: "tbcc:getSettings"
        } satisfies RuntimeMessage)) as SettingsResponse | undefined;

        if (disposed || !response) return;
        setCurrency(sanitizeCurrencyPreference(response.currency));
        setRates(normalizeExchangeRates(response.rates ?? FALLBACK_RATES));
        setAutoUpdate(response.autoUpdate !== false);
        setTheme(sanitizeThemeMode(response.theme));
      } catch {
        const stored = await loadStoredSettings();
        if (disposed) return;
        setCurrency(stored.currency);
        setRates(stored.rates);
        setAutoUpdate(stored.autoUpdate);
        setTheme(stored.theme);
      }
    };

    void loadSettings();

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "sync") {
        if (changes[STORAGE_KEYS.currency]) {
          setCurrency(sanitizeCurrencyPreference(changes[STORAGE_KEYS.currency].newValue));
        }
        if (changes[STORAGE_KEYS.autoUpdate]) {
          setAutoUpdate(changes[STORAGE_KEYS.autoUpdate].newValue !== false);
        }
        if (changes[STORAGE_KEYS.theme]) {
          setTheme(sanitizeThemeMode(changes[STORAGE_KEYS.theme].newValue));
        }
      } else if (area === "local" && changes[STORAGE_KEYS.rates]) {
        setRates(normalizeExchangeRates(changes[STORAGE_KEYS.rates].newValue));
      }
    };

    chrome.storage?.onChanged?.addListener(onStorageChange);
    return () => {
      disposed = true;
      chrome.storage?.onChanged?.removeListener(onStorageChange);
    };
  }, []);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  // Focus search input and highlight selected currency when dropdown opens
  useEffect(() => {
    if (!dropdownOpen) return;
    const selectedIdx = filteredCurrencies.findIndex((item) => item.code === currency);
    setHighlightIndex(selectedIdx >= 0 ? selectedIdx : 0);
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 25);
    return () => window.clearTimeout(id);
  }, [dropdownOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (highlightIndex >= filteredCurrencies.length) {
      setHighlightIndex(0);
    }
  }, [filteredCurrencies, highlightIndex]);

  useEffect(() => {
    if (!dropdownOpen || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlightIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, dropdownOpen]);

  const handleCurrencyChange = async (nextCurrency: CurrencyCode) => {
    setCurrency(nextCurrency);
    setEditingRate(null);
    setDropdownOpen(false);
    setCurrencyQuery("");
    try {
      await chrome.runtime.sendMessage({
        type: "tbcc:setCurrency",
        currency: nextCurrency
      } satisfies RuntimeMessage);
      flashStatus(`Switched to ${nextCurrency}`);
    } catch {
      flashStatus("Failed to save currency", "error");
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((idx) => Math.min(idx + 1, filteredCurrencies.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = filteredCurrencies[highlightIndex];
      if (target) {
        void handleCurrencyChange(target.code as CurrencyCode);
      }
    }
  };

  const handleToggleAutoUpdate = async (enabled: boolean) => {
    setAutoUpdate(enabled);
    try {
      await chrome.runtime.sendMessage({
        type: "tbcc:setAutoUpdate",
        enabled
      } satisfies RuntimeMessage);
      flashStatus(enabled ? "Auto-update enabled" : "Auto-update paused");
    } catch {
      flashStatus("Failed to update setting", "error");
    }
  };

  const handleCycleTheme = async () => {
    const nextTheme = THEME_CYCLE[theme];
    setTheme(nextTheme);
    try {
      await chrome.runtime.sendMessage({
        type: "tbcc:setTheme",
        theme: nextTheme
      } satisfies RuntimeMessage);
      const name = nextTheme === "system" ? "System" : nextTheme === "light" ? "Light" : "Dark";
      flashStatus(`Theme: ${name}`);
    } catch {
      flashStatus("Failed to save theme", "error");
    }
  };

  const handleRateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingRate === null) return;

    const parsed = parseManualRateInput(editingRate);
    if (parsed === null) {
      flashStatus("Enter a valid positive rate", "error");
      return;
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: "tbcc:updateRate",
        rate: parsed
      } satisfies RuntimeMessage)) as { ok?: boolean; rates?: ExchangeRates } | undefined;

      if (response?.ok && response.rates) {
        setRates(normalizeExchangeRates(response.rates));
        setAutoUpdate(false);
        setEditingRate(null);
        flashStatus("Manual rate saved");
      } else {
        flashStatus("Save failed", "error");
      }
    } catch {
      flashStatus("Save failed", "error");
    }
  };

  const handleRefreshRates = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "tbcc:refreshRates"
      } satisfies RuntimeMessage)) as { ok?: boolean; rates?: ExchangeRates } | undefined;

      if (response?.ok && response.rates) {
        setRates(normalizeExchangeRates(response.rates));
        flashStatus("Exchange rates updated");
      } else {
        flashStatus("Refresh failed", "error");
      }
    } catch {
      flashStatus("Connection error", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyConverted = async () => {
    if (quickConvertedText === "—") return;
    try {
      await navigator.clipboard.writeText(quickConvertedText);
      setCopied(true);
      flashStatus(`Copied ${quickConvertedText}`);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      flashStatus("Copy unavailable", "error");
    }
  };

  const renderThemeIcon = () => {
    if (theme === "light") return <SunIcon size={15} />;
    if (theme === "dark") return <MoonIcon size={15} />;
    return <MonitorIcon size={15} />;
  };

  return (
    <div className="popup-shell">
      {/* 1. Fixed 1-line Header (TubeDeck2k standard) */}
      <header className="popup-header">
        <div className="popup-brand">
          <img src={logoSrc} alt="Taobao Convert" className="popup-logo" />
          <div className="popup-brand-info">
            <div className="popup-title-row">
              <span className="popup-title">Taobao Convert</span>
              <span
                className={`popup-status-dot ${statusDotClass}`}
                title={
                  statusDotClass === "is-live"
                    ? "Live exchange rates active"
                    : statusDotClass === "is-manual"
                      ? "Manual exchange rate"
                      : "Using offline fallback rates"
                }
              />
            </div>
            <div className="popup-subtitle">{headerSubtitle}</div>
          </div>
        </div>

        <div className="popup-header-actions">
          <button
            type="button"
            className="popup-icon-btn"
            onClick={() => void handleCycleTheme()}
            title={THEME_LABELS[theme]}
            aria-label={THEME_LABELS[theme]}
          >
            {renderThemeIcon()}
          </button>
          <button
            type="button"
            className="popup-icon-btn"
            onClick={() => void handleRefreshRates()}
            disabled={isRefreshing}
            title="Refresh live exchange rates"
            aria-label="Refresh live exchange rates"
          >
            <RefreshIcon size={15} className={isRefreshing ? "spin" : undefined} />
          </button>
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="popup-body">
        {/* Card 1: Target Currency & Exchange Rate */}
        <section className="popup-card" aria-label="Currency and exchange rate">
          <div className="popup-section-head">
            <span className="popup-section-title">Target Currency</span>
            <div className="popup-inline-toggle">
              <span className="popup-toggle-label">Auto-update</span>
              <Switch
                checked={autoUpdate}
                onChange={(enabled) => void handleToggleAutoUpdate(enabled)}
                ariaLabel="Toggle automatic exchange rate updates"
              />
            </div>
          </div>

          <div ref={dropdownRef} className="popup-picker">
            <button
              type="button"
              onClick={() => setDropdownOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              className={`popup-picker-trigger ${dropdownOpen ? "is-open" : ""}`}
            >
              <span className="popup-symbol-badge">{selectedOption.symbol}</span>
              <span className="popup-picker-text">
                <span className="popup-picker-code">{selectedOption.code}</span>
                <span className="popup-picker-name">{selectedOption.label}</span>
              </span>
              <span className={`popup-chevron ${dropdownOpen ? "is-open" : ""}`}>
                <ChevronDownIcon size={15} />
              </span>
            </button>

            {dropdownOpen && (
              <div className="popup-dropdown" role="listbox" aria-label="Select target currency">
                <div className="popup-search-wrap">
                  <span className="popup-search-ic">
                    <SearchIcon size={13} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search code or currency..."
                    value={currencyQuery}
                    onChange={(event) => setCurrencyQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="popup-search-input"
                    autoComplete="off"
                    aria-label="Search currency"
                  />
                  {currencyQuery && (
                    <button
                      type="button"
                      className="popup-search-clear"
                      onClick={() => setCurrencyQuery("")}
                      aria-label="Clear search"
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                </div>

                <div ref={listRef} className="popup-dropdown-list">
                  {filteredCurrencies.length === 0 ? (
                    <p className="popup-dropdown-empty">No matching currency.</p>
                  ) : (
                    filteredCurrencies.map((item, idx) => {
                      const isSelected = currency === item.code;
                      const isHighlighted = idx === highlightIndex;
                      return (
                        <button
                          type="button"
                          key={item.code}
                          role="option"
                          aria-selected={isSelected}
                          data-idx={idx}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          onClick={() => void handleCurrencyChange(item.code as CurrencyCode)}
                          className={`popup-option ${
                            isSelected ? "is-selected" : isHighlighted ? "is-highlighted" : ""
                          }`}
                        >
                          <span className="popup-option-sym">{item.symbol}</span>
                          <span className="popup-option-info">
                            <span className="popup-option-code">{item.code}</span>
                            <span className="popup-option-label">{item.label}</span>
                          </span>
                          {isSelected && (
                            <span className="popup-option-check">
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="popup-divider" />

          <div className="popup-rate-row">
            {editingRate !== null ? (
              <form
                onSubmit={(event) => void handleRateSubmit(event)}
                className="popup-rate-form"
              >
                <span className="popup-rate-base">1 CNY =</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={editingRate}
                  onChange={(event) => setEditingRate(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setEditingRate(null);
                    }
                  }}
                  className="ui-input"
                  aria-label="Custom exchange rate"
                />
                <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm">
                  Save
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  onClick={() => setEditingRate(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="popup-rate-display">
                  <span className="popup-rate-base">1 CNY</span>
                  <span className="popup-rate-arrow">
                    <ArrowRightIcon size={13} />
                  </span>
                  <span className="popup-rate-value">{formattedRate}</span>
                  <span className="popup-rate-code">{currency}</span>
                </div>
                <button
                  type="button"
                  className="popup-rate-edit-btn"
                  onClick={() => setEditingRate(currentRateValue.toString())}
                  title="Set a custom exchange rate"
                >
                  <PencilIcon size={11} />
                  <span>Edit</span>
                </button>
              </>
            )}
          </div>

          <div className="popup-rate-meta">
            <span>{updatedLabel}</span>
            <span
              className={`popup-mode-pill ${
                statusDotClass === "is-live"
                  ? "is-live"
                  : statusDotClass === "is-manual"
                    ? "is-manual"
                    : ""
              }`}
            >
              {statusDotClass === "is-live"
                ? "Live"
                : statusDotClass === "is-manual"
                  ? "Manual"
                  : "Fallback"}
            </span>
          </div>
        </section>

        {/* Card 2: Quick Converter */}
        <section className="popup-card" aria-label="Quick price converter">
          <div className="popup-section-head">
            <span className="popup-section-title">Quick Convert</span>
            <span className="popup-toggle-label">CNY → {currency}</span>
          </div>

          <div className="popup-calc-row">
            <div className="popup-calc-input-wrap">
              <span className="popup-calc-prefix">¥</span>
              <input
                type="text"
                inputMode="decimal"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                placeholder="100"
                className="popup-calc-input"
                aria-label="Amount in Chinese Yuan"
              />
            </div>

            <span className="popup-rate-arrow">
              <ArrowRightIcon size={13} />
            </span>

            <div className="popup-calc-output">
              <span className="popup-calc-result" title={quickConvertedText}>
                {quickConvertedText}
              </span>
              <button
                type="button"
                className="popup-copy-btn"
                onClick={() => void handleCopyConverted()}
                title="Copy converted amount"
                aria-label="Copy converted amount"
              >
                {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
            </div>
          </div>

          <div className="popup-presets" role="group" aria-label="Quick CNY presets">
            {QUICK_PRESETS.map((preset) => {
              const isActive = quickAmount.trim() === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  className={`popup-preset-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setQuickAmount(preset)}
                >
                  ¥{Number(preset).toLocaleString("en-US")}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* 3. Clean 1-row Footer (zero line-wrapping) */}
      <footer className="popup-footer">
        <span
          className={`popup-footer-status ${
            status ? (status.tone === "error" ? "is-error" : "is-accent") : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {status ? status.text : `${CURRENCY_OPTIONS.length} currencies · open.er-api`}
        </span>
        <button
          type="button"
          className="popup-footer-btn"
          onClick={() => void handleRefreshRates()}
          disabled={isRefreshing}
        >
          <RefreshIcon size={13} className={isRefreshing ? "spin" : undefined} />
          <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
        </button>
      </footer>
    </div>
  );
}
