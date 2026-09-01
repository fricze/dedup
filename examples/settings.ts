// near-duplicates: same 4 fields but one extra/renamed field each -> ~70-85% similar, not identical
export interface UserSettings {
  theme: string;
  language: string;
  notifications: boolean;
  timezone: string;
}

export interface AppSettings {
  theme: string;
  language: string;
  notifications: boolean;
  autoSave: boolean; // extra field not in UserSettings
}

export interface DisplaySettings {
  theme: string;
  language: string;
  notifications: boolean;
  timezone: string;
  fontSize: number; // superset of UserSettings
}
