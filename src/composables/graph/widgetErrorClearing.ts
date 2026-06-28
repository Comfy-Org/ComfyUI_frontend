import type { NodeExecutionId } from '@/types/nodeIdentification'

interface WidgetErrorRangeOptions {
  min?: number
  max?: number
}

interface WidgetErrorScope {
  executionId: NodeExecutionId
  /** Validation error key matched against `error.extra_info.input_name`. */
  errorInputName?: string
  /** Missing model/media store lookup key. */
  widgetName: string
}

type ClearWidgetRelatedErrors = (
  executionId: NodeExecutionId,
  errorInputName: string,
  widgetName: string,
  newValue: unknown,
  range?: WidgetErrorRangeOptions
) => void

interface ClearWidgetRelatedErrorScopesOptions {
  clearWidgetRelatedErrors: ClearWidgetRelatedErrors
  host: WidgetErrorScope
  source?: WidgetErrorScope
  value: unknown
  range?: WidgetErrorRangeOptions
}

/**
 * Clear the interior promoted-widget source first, then the host widget.
 * The range belongs to the widget surface that emitted the value.
 */
export function clearWidgetRelatedErrorScopes({
  clearWidgetRelatedErrors,
  host,
  source,
  value,
  range
}: ClearWidgetRelatedErrorScopesOptions): void {
  if (source) {
    applyScopeClear(clearWidgetRelatedErrors, source, value, range)
  }

  applyScopeClear(clearWidgetRelatedErrors, host, value, range)
}

function applyScopeClear(
  clearWidgetRelatedErrors: ClearWidgetRelatedErrors,
  scope: WidgetErrorScope,
  value: unknown,
  range?: WidgetErrorRangeOptions
): void {
  clearWidgetRelatedErrors(
    scope.executionId,
    scope.errorInputName ?? scope.widgetName,
    scope.widgetName,
    value,
    range
  )
}
