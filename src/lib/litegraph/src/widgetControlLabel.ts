import { t } from '@/i18n'

let labelProvider = () => t('g.control_after_generate')

export function registerWidgetControlLabelProvider(
  provider: () => string
): void {
  labelProvider = provider
}

export function widgetControlLabel(): string {
  return labelProvider()
}
