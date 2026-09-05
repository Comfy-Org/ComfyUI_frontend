import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface CloudNodesCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * Calls-to-action for the Cloud Nodes page. There is nothing to install --
 * the nodes arrive with ComfyUI -- so the second action is the docs rather
 * than a download, and "get started" means an account to spend credits from.
 */
export function cloudNodesCtas(locale: Locale): {
  getStarted: CloudNodesCta
  docs: CloudNodesCta
  setup: CloudNodesCta
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
    setup: {
      label: t('cloudNodesLaunch.cta.setup', locale),
      href: '#setup'
    }
  }
}
