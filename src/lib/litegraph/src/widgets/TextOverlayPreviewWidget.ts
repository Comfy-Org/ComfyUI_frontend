import type { ITextOverlayPreviewWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

export class TextOverlayPreviewWidget
  extends VueOnlyWidget<ITextOverlayPreviewWidget>
  implements ITextOverlayPreviewWidget
{
  protected get vueOnlyLabel(): string {
    return 'TextOverlayPreview'
  }
}
