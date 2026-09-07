import type { IFileUploadWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for handling file uploads
 * This is a widget that only has a Vue widgets implementation
 */
export class FileUploadWidget
  extends BaseWidget<IFileUploadWidget>
  implements IFileUploadWidget
{
  override type = 'fileupload' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Fileupload')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
