/**
 * TODO: Migrate scripts/ui/settings.ts here
 *
 * Currently the reactive settings act as a proxy of the legacy settings.
 * Every time a setting is changed, the settingStore dispatch the change to the
 * legacy settings. Every time the legacy settings are changed, the legacy
 * settings directly updates the settingStore.settingValues.
 */

import { app } from "@/scripts/app";
import { ComfySettingsDialog } from "@/scripts/ui/settings";
import { defineStore } from "pinia";

interface State {
  settingValues: Record<string, any>;
}

export const useSettingStore = defineStore("setting", {
  state: (): State => ({
    settingValues: {},
  }),
  actions: {
    addSettings(settings: ComfySettingsDialog) {
      for (const id in settings.settingsLookup) {
        const value = settings.getSettingValue(id);
        this.settingValues[id] = value;
      }
    },

    set(key: string, value: any) {
      this.settingValues[key] = value;
      app.ui.settings.setSettingValue(key, value);
    },

    get(key: string) {
      return (
        this.settingValues[key] ?? app.ui.settings.getSettingDefaultValue(key)
      );
    },
  },
});
