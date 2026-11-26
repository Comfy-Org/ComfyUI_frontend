import type { IImageCompareWidget } from '@comfyorg/graph-model/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for comparing two images side by side
 * This is a widget that only has a Vue widgets implementation
 */
export class ImageCompareWidget
  extends VueOnlyWidget<IImageCompareWidget>
  implements IImageCompareWidget
{
  protected get vueOnlyLabel(): string {
    return 'ImageCompare'
  }
}
