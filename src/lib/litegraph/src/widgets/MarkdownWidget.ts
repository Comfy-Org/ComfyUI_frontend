import type { IMarkdownWidget } from '../types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for displaying markdown formatted text
 * This is a widget that only has a Vue widgets implementation
 */
export class MarkdownWidget
  extends VueOnlyWidget<IMarkdownWidget>
  implements IMarkdownWidget
{
  protected get vueOnlyLabel(): string {
    return 'Markdown'
  }
}
