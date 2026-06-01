export interface WidgetState<
  TValue = unknown,
  TType extends string = string,
  TOptions extends object = object
> {
  value?: TValue
  label?: string
  disabled?: boolean
  type: TType
  options: TOptions
  /**
   * Whether the widget value is persisted in the workflow JSON
   * (`widgets_values`). Distinct from `IWidgetOptions.serialize`, which
   * controls whether the value is included in the API prompt sent for
   * execution. See `src/lib/litegraph/docs/WIDGET_SERIALIZATION.md`.
   * @default true
   */
  serialize?: boolean
}
