import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface CloudNodesCta {
  label: string
  href: string
  target?: '_blank'
}

export function cloudNodesCtas(locale: Locale): {
  getStarted: CloudNodesCta
  docs: CloudNodesCta
  update: CloudNodesCta
} {
  return {
    getStarted: {
      label: t('cloudNodesLaunch.cta.getStarted', locale),
      href: externalLinks.cloud,
      target: '_blank'
    },
    docs: {
      label: t('cloudNodesLaunch.cta.docs', locale),
      href: externalLinks.docsCloudNodes,
      target: '_blank'
    },
    update: {
      label: t('cloudNodesLaunch.cta.update', locale),
      href: externalLinks.docsUpdateComfyUI,
      target: '_blank'
    }
  }
}
