import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IBooleanWidget,
  IButtonWidget,
  IComboWidget,
  ICustomWidget,
  IKnobWidget,
  INumericWidget,
  ISliderWidget,
  IStringWidget,
  IWidget,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'
import { toClass } from '@/lib/litegraph/src/utils/type'

import { BaseWidget } from './BaseWidget'
import { BooleanWidget } from './BooleanWidget'
import { ButtonWidget } from './ButtonWidget'
import { ComboWidget } from './ComboWidget'
import { KnobWidget } from './KnobWidget'
import { LegacyWidget } from './LegacyWidget'
import { NumberWidget } from './NumberWidget'
import { SliderWidget } from './SliderWidget'
import { TextWidget } from './TextWidget'

export type WidgetTypeMap = {
  button: ButtonWidget
  toggle: BooleanWidget
  slider: SliderWidget
  knob: KnobWidget
  combo: ComboWidget
  number: NumberWidget
  string: TextWidget
  text: TextWidget
  custom: LegacyWidget
  [key: string]: BaseWidget
}

/**
 * Convert a widget POJO to a proper widget instance.
 * @param widget The POJO to convert.
 * @param node The node the widget belongs to.
 * @param wrapLegacyWidgets Whether to wrap legacy widgets in a `LegacyWidget` instance.
 * @returns A concrete widget instance.
 */
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets?: true
): WidgetTypeMap[TWidget['type']]
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets: false
): WidgetTypeMap[TWidget['type']] | undefined
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets = true
): WidgetTypeMap[TWidget['type']] | undefined {
  if (widget instanceof BaseWidget) return widget

  // Assertion: TypeScript has no concept of "all strings except X"
  type RemoveBaseWidgetType<T> = T extends { type: TWidgetType } ? T : never
  const narrowedWidget = widget as RemoveBaseWidgetType<TWidget>

  switch (narrowedWidget.type) {
    case 'button':
      return toClass(ButtonWidget, narrowedWidget, node)
    case 'toggle':
      return toClass(BooleanWidget, narrowedWidget, node)
    case 'slider':
      return toClass(SliderWidget, narrowedWidget, node)
    case 'knob':
      return toClass(KnobWidget, narrowedWidget, node)
    case 'combo':
      return toClass(ComboWidget, narrowedWidget, node)
    case 'number':
      return toClass(NumberWidget, narrowedWidget, node)
    case 'string':
      return toClass(TextWidget, narrowedWidget, node)
    case 'text':
      return toClass(TextWidget, narrowedWidget, node)
    default: {
      if (wrapLegacyWidgets) return toClass(LegacyWidget, widget, node)
    }
  }
}

// #region Type Guards

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IButtonWidget}. */
export function isButtonWidget(widget: IBaseWidget): widget is IButtonWidget {
  return widget.type === 'button'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IBooleanWidget}. */
export function isBooleanWidget(widget: IBaseWidget): widget is IBooleanWidget {
  return widget.type === 'toggle'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ISliderWidget}. */
export function isSliderWidget(widget: IBaseWidget): widget is ISliderWidget {
  return widget.type === 'slider'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IKnobWidget}. */
export function isKnobWidget(widget: IBaseWidget): widget is IKnobWidget {
  return widget.type === 'knob'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IComboWidget}. */
export function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link INumericWidget}. */
export function isNumberWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IStringWidget}. */
export function isStringWidget(widget: IBaseWidget): widget is IStringWidget {
  return widget.type === 'string'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ITextWidget}. */
export function isTextWidget(widget: IBaseWidget): widget is IStringWidget {
  return widget.type === 'text'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ICustomWidget}. */
export function isCustomWidget(widget: IBaseWidget): widget is ICustomWidget {
  return widget.type === 'custom'
}

// #endregion Type Guards
