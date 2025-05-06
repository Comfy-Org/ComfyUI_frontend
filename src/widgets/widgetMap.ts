import type { IBaseWidget, IWidget } from "@/types/widgets"

import { BaseWidget } from "./BaseWidget"
import { BooleanWidget } from "./BooleanWidget"
import { ButtonWidget } from "./ButtonWidget"
import { ComboWidget } from "./ComboWidget"
import { KnobWidget } from "./KnobWidget"
import { NumberWidget } from "./NumberWidget"
import { SliderWidget } from "./SliderWidget"
import { TextWidget } from "./TextWidget"

export function toConcreteWidget(widget: IWidget): BaseWidget | undefined {
  if (widget instanceof BaseWidget) return widget

  switch (widget.type) {
  case "button": return new ButtonWidget(widget)
  case "toggle": return new BooleanWidget(widget)
  case "slider": return new SliderWidget(widget)
  case "knob": return new KnobWidget(widget)
  case "combo": return new ComboWidget(widget)
  case "number": return new NumberWidget(widget)
  case "string": return new TextWidget(widget)
  case "text": return new TextWidget(widget)
  }
}

type WidgetConstructor = {
  new (plain: IBaseWidget): BaseWidget
}

export const WIDGET_TYPE_MAP: Record<string, WidgetConstructor> = {
  // @ts-expect-error https://github.com/Comfy-Org/litegraph.js/issues/616
  button: ButtonWidget,
  // @ts-expect-error #616
  toggle: BooleanWidget,
  // @ts-expect-error #616
  slider: SliderWidget,
  // @ts-expect-error #616
  knob: KnobWidget,
  // @ts-expect-error #616
  combo: ComboWidget,
  // @ts-expect-error #616
  number: NumberWidget,
  // @ts-expect-error #616
  string: TextWidget,
  // @ts-expect-error #616
  text: TextWidget,
}
