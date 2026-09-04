import { useSettingStore } from '@/platform/settings/settingStore'

export type MissingWarningKind = 'nodes' | 'models' | 'media'

const MISSING_WARNING_SETTING_IDS = {
  nodes: 'Comfy.Workflow.ShowMissingNodesWarning',
  models: 'Comfy.Workflow.ShowMissingModelsWarning',
  media: 'Comfy.Workflow.ShowMissingMediaWarning'
} as const

/**
 * A missing-resource warning is shown while the Issues tab is enabled and
 * its own per-kind setting is not switched off.
 */
export function isMissingWarningVisible(kind: MissingWarningKind): boolean {
  const settingStore = useSettingStore()
  return (
    settingStore.get('Comfy.RightSidePanel.ShowErrorsTab') !== false &&
    settingStore.get(MISSING_WARNING_SETTING_IDS[kind]) !== false
  )
}
