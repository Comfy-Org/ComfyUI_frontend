export type DefaultField = 'Workflow' | 'Logs' | 'SystemStats' | 'Settings'

export interface ReportField {
  /**
   * The label of the field, shown next to the checkbox if the field is opt-in.
   */
  label: string

  /**
   * A unique identifier for the field, used internally as the key for this field's value.
   */
  value: string

  /**
   * The data associated with this field, sent as part of the report.
   */
  data: Record<string, unknown>

  /**
   * Indicates whether the field requires explicit opt-in from the user
   * before its data is included in the report.
   */
  optIn: boolean
}
