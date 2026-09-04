import { useSettingStore } from '@/platform/settings/settingStore'

const MISSING_WARNING_SETTING_IDS = {
  nodes: 'Comfy.Workflow.ShowMissingNodesWarning',
  models: 'Comfy.Workflow.ShowMissingModelsWarning',
  media: 'Comfy.Workflow.ShowMissingMediaWarning'
} as const

type MissingWarningKind = keyof typeof MISSING_WARNING_SETTING_IDS

type VisibilitySettingId =
  | 'Comfy.RightSidePanel.ShowErrorsTab'
  | (typeof MISSING_WARNING_SETTING_IDS)[MissingWarningKind]

/** A setting that is not registered yet reads as enabled. */
function isEnabled(id: VisibilitySettingId): boolean {
  const value: boolean | undefined = useSettingStore().get(id)
  return value ?? true
}

export function isIssuesTabEnabled(): boolean {
  return isEnabled('Comfy.RightSidePanel.ShowErrorsTab')
}

export function isMissingWarningVisible(kind: MissingWarningKind): boolean {
  return isEnabled(MISSING_WARNING_SETTING_IDS[kind])
}
