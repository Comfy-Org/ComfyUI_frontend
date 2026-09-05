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
function enabledByDefault(value: boolean | undefined): boolean {
  return value ?? true
}

function isEnabled(id: VisibilitySettingId): boolean {
  return enabledByDefault(useSettingStore().get(id))
}

export function isIssuesTabEnabled(): boolean {
  return isEnabled('Comfy.RightSidePanel.ShowErrorsTab')
}

export function isMissingWarningVisible(kind: MissingWarningKind): boolean {
  return isEnabled(MISSING_WARNING_SETTING_IDS[kind])
}
