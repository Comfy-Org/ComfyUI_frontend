import type { IGalleriaWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for displaying image galleries
 * This is a widget that only has a Vue widgets implementation
 */
export class GalleriaWidget
  extends VueOnlyWidget<IGalleriaWidget>
  implements IGalleriaWidget
{
  protected get vueOnlyLabel(): string {
    return 'Galleria'
  }
}
