import { getControlProjections } from '@/core/graph/widgets/control/controlProjection'
import { registerWidgetControlFromConfig } from '@/core/graph/widgets/control/widgetControl'
import { isValueControlMode } from '@/core/graph/widgets/control/valueControl'
import type { ValueControlMode } from '@/core/graph/widgets/control/valueControl'
import { t } from '@/i18n'
import { isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@comfyorg/graph-model/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { InputSpec } from '@comfyorg/object-info-parser'

function toControlMode(value: string | undefined): ValueControlMode {
  return isValueControlMode(value) ? value : value ? 'fixed' : 'randomize'
}

interface ValueControlOptions extends Record<string, unknown> {
  addFilterList?: boolean
  controlAfterGenerateName?: string
  controlFilterListName?: string
}

function configureValueControl(
  targetWidget: IBaseWidget,
  defaultValue: string | undefined,
  addFilterList: boolean
): void {
  targetWidget.controlConfig = {
    mode: toControlMode(defaultValue),
    hasFilter: isComboWidget(targetWidget) && addFilterList
  }
  registerWidgetControlFromConfig(targetWidget)
}

function resolveControlTarget(
  nodeOrTarget: LGraphNode | IBaseWidget,
  legacyTarget: IBaseWidget | undefined
): IBaseWidget {
  if (legacyTarget) return legacyTarget
  if ('options' in nodeOrTarget) return nodeOrTarget
  throw new TypeError('Value control target widget is required')
}

function configuredControlProjections(
  targetWidget: IBaseWidget
): [IComboWidget, ...IStringWidget[]] | undefined {
  const [mode, ...filters] = getControlProjections(targetWidget)
  return mode ? [mode, ...filters] : undefined
}

function legacyControlName(
  defaultName: string,
  optionName: keyof ValueControlOptions,
  options: ValueControlOptions,
  inputData: InputSpec | undefined
): string {
  const inputName = inputData?.[1]?.[defaultName]
  const override = [
    options[optionName],
    defaultName === 'control_after_generate' && isValueControlMode(inputName)
      ? undefined
      : inputName
  ].find((name): name is string => typeof name === 'string' && !!name.trim())
  if (override) return override
  const prefix = inputData?.[1]?.control_prefix
  return prefix ? `${prefix} ${defaultName}` : defaultName
}

export function addValueControlWidget(
  targetWidget: IBaseWidget,
  defaultValue?: string
): void
export function addValueControlWidget(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  values?: unknown,
  widgetName?: string,
  inputData?: InputSpec
): IComboWidget
export function addValueControlWidget(
  nodeOrTarget: LGraphNode | IBaseWidget,
  targetOrDefault?: IBaseWidget | string,
  legacyDefault?: string,
  _legacyValues?: unknown,
  legacyWidgetName?: string,
  legacyInputData?: InputSpec
): void | IComboWidget {
  const legacyTarget =
    typeof targetOrDefault === 'object' ? targetOrDefault : undefined
  const targetWidget = resolveControlTarget(nodeOrTarget, legacyTarget)
  const defaultValue = legacyTarget
    ? legacyDefault
    : typeof targetOrDefault === 'string'
      ? targetOrDefault
      : undefined
  configureValueControl(
    targetWidget,
    defaultValue === legacyInputData?.[1]?.control_after_generate &&
      !isValueControlMode(defaultValue)
      ? undefined
      : defaultValue,
    false
  )
  if (!legacyTarget) return

  const projections = getControlProjections(targetWidget, [targetWidget])
  const [mode] = projections
  if (!mode) return
  mode.name = legacyControlName(
    'control_after_generate',
    'controlAfterGenerateName',
    { controlAfterGenerateName: legacyWidgetName },
    legacyInputData
  )
  return configuredControlProjections(targetWidget)?.[0]
}

export function addValueControlWidgets(
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options?: ValueControlOptions
): void
export function addValueControlWidgets(
  node: LGraphNode,
  targetWidget: IBaseWidget,
  defaultValue?: string,
  options?: ValueControlOptions,
  inputData?: InputSpec
): [IComboWidget, ...IStringWidget[]]
export function addValueControlWidgets(
  nodeOrTarget: LGraphNode | IBaseWidget,
  targetOrDefault?: IBaseWidget | string,
  defaultOrOptions?: string | ValueControlOptions,
  legacyOptions: ValueControlOptions = {},
  legacyInputData?: InputSpec
): void | [IComboWidget, ...IStringWidget[]] {
  const legacyTarget =
    typeof targetOrDefault === 'object' ? targetOrDefault : undefined
  const targetWidget = resolveControlTarget(nodeOrTarget, legacyTarget)
  const defaultValue = legacyTarget
    ? typeof defaultOrOptions === 'string'
      ? defaultOrOptions
      : undefined
    : typeof targetOrDefault === 'string'
      ? targetOrDefault
      : undefined
  const options = legacyTarget
    ? legacyOptions
    : typeof defaultOrOptions === 'object'
      ? defaultOrOptions
      : {}
  configureValueControl(
    targetWidget,
    defaultValue === legacyInputData?.[1]?.control_after_generate &&
      !isValueControlMode(defaultValue)
      ? undefined
      : defaultValue,
    options.addFilterList !== false
  )
  if (!legacyTarget) return

  const projections = getControlProjections(targetWidget, [targetWidget])
  const [mode] = projections
  if (!mode) return
  mode.name = legacyControlName(
    'control_after_generate',
    'controlAfterGenerateName',
    options,
    legacyInputData
  )
  const filter = projections.at(1)
  if (filter) {
    filter.name = legacyControlName(
      'control_filter_list',
      'controlFilterListName',
      options,
      legacyInputData
    )
  }
  return configuredControlProjections(targetWidget)
}

export function updateControlWidgetLabel(widget: IBaseWidget): void {
  widget.label =
    useSettingStore().get('Comfy.WidgetControlMode') === 'before'
      ? t('g.control_before_generate')
      : t('g.control_after_generate')
}
