import type { IMultiSelectWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for selecting multiple options
 * This is a widget that only has a Vue widgets implementation
 */
export class MultiSelectWidget
  extends VueOnlyWidget<IMultiSelectWidget>
  implements IMultiSelectWidget
{
  protected get vueOnlyLabel(): string {
    return 'MultiSelect'
  }
}
