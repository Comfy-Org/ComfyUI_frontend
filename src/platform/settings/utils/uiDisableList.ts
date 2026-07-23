import { useSettingStore } from '@/platform/settings/settingStore'

const DISABLED_COMMANDS_SETTING_ID = 'Comfy.UI.DisabledCommands'

export function getDisabledCommands(): string[] {
  return useSettingStore().get(DISABLED_COMMANDS_SETTING_ID) ?? []
}

export function isCommandDisabled(commandId: string): boolean {
  return getDisabledCommands().includes(commandId)
}
