import type { IBaseWidget } from "@/types/widgets"

import { BaseWidget } from "./BaseWidget"
import { BooleanWidget } from "./BooleanWidget"
import { ButtonWidget } from "./ButtonWidget"
import { ComboWidget } from "./ComboWidget"
import { KnobWidget } from "./KnobWidget"
import { NumberWidget } from "./NumberWidget"
import { SliderWidget } from "./SliderWidget"
import { TextWidget } from "./TextWidget"

type WidgetConstructor = {
  new (plain: IBaseWidget): BaseWidget
}

export const WIDGET_TYPE_MAP: Record<string, WidgetConstructor> = {
  // @ts-ignore https://github.com/Comfy-Org/litegraph.js/issues/616
  button: ButtonWidget,
  // @ts-ignore #616
  toggle: BooleanWidget,
  // @ts-ignore #616
  slider: SliderWidget,
  // @ts-ignore #616
  knob: KnobWidget,
  // @ts-ignore #616
  combo: ComboWidget,
  // @ts-ignore #616
  number: NumberWidget,
  // @ts-ignore #616
  string: TextWidget,
  // @ts-ignore #616
  text: TextWidget,
}
