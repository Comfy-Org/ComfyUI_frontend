import type { ICompositorWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for the ImageCompositor node preview and editor launcher.
 * This is a widget that only has a Vue widgets implementation.
 */
export class CompositorWidget
  extends VueOnlyWidget<ICompositorWidget>
  implements ICompositorWidget
{
  protected get vueOnlyLabel(): string {
    return 'Compositor'
  }
}
