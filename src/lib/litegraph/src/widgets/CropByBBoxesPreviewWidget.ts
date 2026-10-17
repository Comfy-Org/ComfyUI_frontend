import type { ICropByBBoxesPreviewWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

export class CropByBBoxesPreviewWidget
  extends VueOnlyWidget<ICropByBBoxesPreviewWidget>
  implements ICropByBBoxesPreviewWidget
{
  protected get vueOnlyLabel(): string {
    return 'CropByBBoxesPreview'
  }
}
