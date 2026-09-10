import type { ISelectButtonWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for selecting from a group of buttons
 * This is a widget that only has a Vue widgets implementation
 */
export class SelectButtonWidget
  extends VueOnlyWidget<ISelectButtonWidget>
  implements ISelectButtonWidget
{
  protected get vueOnlyLabel(): string {
    return 'SelectButton'
  }
}
