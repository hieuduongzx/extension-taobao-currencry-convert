export interface CurrencyOption {
  readonly code: string;
  readonly label: string;
  readonly symbol: string;
  readonly locale: string;
}

export type ThemeMode = "system" | "light" | "dark";

export interface ExchangeRates {
  /** Multiplier: 1 CNY -> this many units of `code` */
  values: Record<string, number>;
  updatedAt: string | null;
  source: string;
}

export interface ExtensionSettings {
  currency: string;
  autoUpdate: boolean;
  theme: ThemeMode;
  rates: ExchangeRates;
}

export type RuntimeMessage =
  | { type: "tbcc:getSettings" }
  | { type: "tbcc:setCurrency"; currency: string }
  | { type: "tbcc:updateRate"; rate: number }
  | { type: "tbcc:setAutoUpdate"; enabled: boolean }
  | { type: "tbcc:setTheme"; theme: ThemeMode }
  | { type: "tbcc:refreshRates" };
