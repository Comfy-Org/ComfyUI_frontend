import type { IChartWidget } from '@/lib/litegraph/src/types/widgets'
import { VueOnlyWidget } from './VueOnlyWidget'

/**
 * Widget for displaying charts and data visualizations
 * This is a widget that only has a Vue widgets implementation
 */
export class ChartWidget
  extends VueOnlyWidget<IChartWidget>
  implements IChartWidget
{
  protected get vueOnlyLabel(): string {
    return 'Chart'
  }
}
