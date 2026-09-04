import { useSettingStore } from '@/platform/settings/settingStore'

type MissingWarningKind = 'nodes' | 'models' | 'media'

const MISSING_WARNING_SETTING_IDS = {
  nodes: 'Comfy.Workflow.ShowMissingNodesWarning',
  models: 'Comfy.Workflow.ShowMissingModelsWarning',
  media: 'Comfy.Workflow.ShowMissingMediaWarning'
} as const

/** A per-kind setting that is not registered yet reads as enabled. */
export function isMissingWarningVisible(kind: MissingWarningKind): boolean {
  const value: boolean | undefined = useSettingStore().get(
    MISSING_WARNING_SETTING_IDS[kind]
  )
  return value ?? true
}
