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
  getData: () => unknown

  /**
   * Indicates whether the field requires explicit opt-in from the user
   * before its data is included in the report.
   */
  optIn: boolean
}

export interface IssueReportPanelProps {
  /**
   * The type of error being reported. This is used to categorize the error.
   */
  errorType: string

  /**
   * Which of the default fields to include in the report.
   */
  defaultFields?: DefaultField[]

  /**
   * Additional fields to include in the report.
   */
  extraFields?: ReportField[]

  /**
   * Tags that will be added to the report. Tags are used to further categorize the error.
   */
  tags?: Record<string, string>

  /**
   * The title displayed in the dialog.
   */
  title?: string
}
