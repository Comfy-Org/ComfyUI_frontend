export type DefaultField = 'Workflow' | 'Logs' | 'SystemStats' | 'Settings'

export interface ReportField {
  /** The label of the field, shown next to the checkbox if the field is opt-in */
  label: string
  value: string
  data: Record<string, unknown>
  optIn: boolean
}
