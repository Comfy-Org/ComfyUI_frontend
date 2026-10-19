export interface WidgetSerializationFormReport {
  nodeId: string
  nodeType: string
}

type WidgetSerializationFormReporter = (
  report: WidgetSerializationFormReport
) => void

let reporter: WidgetSerializationFormReporter | undefined

export function setWidgetSerializationFormReporter(
  nextReporter: WidgetSerializationFormReporter | undefined
): void {
  reporter = nextReporter
}

export function reportMissingWidgetSerializationForm(
  report: WidgetSerializationFormReport
): void {
  reporter?.(report)
}
