import type { IFileUploadWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for handling file uploads
 * This is a widget that only has a Vue widgets implementation
 */
export class FileUploadWidget
  extends VueOnlyWidget<IFileUploadWidget>
  implements IFileUploadWidget
{
  protected get vueOnlyLabel(): string {
    return 'Fileupload'
  }
}
