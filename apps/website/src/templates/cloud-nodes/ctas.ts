import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

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
  const { t } = translationsFor(locale)
  return {
    getStarted: {
      label: t('cloudNodesLaunch.cta.getStarted'),
      href: getRoutes(locale).download
    },
    docs: {
      label: t('cloudNodesLaunch.cta.docs'),
      href: externalLinks.docsCloudNodes,
      target: '_blank'
    },
    update: {
      label: t('cloudNodesLaunch.cta.update'),
      href: externalLinks.docsUpdateComfyUI,
      target: '_blank'
    }
  }
}
