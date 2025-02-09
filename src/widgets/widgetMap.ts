// @ts-strict-ignore
import type { IBaseWidget } from "@/types/widgets"
import { BooleanWidget } from "./BooleanWidget"
import { ButtonWidget } from "./ButtonWidget"
import { ComboWidget } from "./ComboWidget"
import { NumberWidget } from "./NumberWidget"
import { SliderWidget } from "./SliderWidget"
import { TextWidget } from "./TextWidget"
import { BaseWidget } from "./BaseWidget"

type WidgetConstructor = {
  new (plain: IBaseWidget): BaseWidget
}

export const WIDGET_TYPE_MAP: Record<string, WidgetConstructor> = {
  button: ButtonWidget,
  toggle: BooleanWidget,
  slider: SliderWidget,
  combo: ComboWidget,
  number: NumberWidget,
  string: TextWidget,
  text: TextWidget,
}
