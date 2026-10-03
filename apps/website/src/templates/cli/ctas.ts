import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

export interface CliCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * Calls-to-action for the CLI page: view the docs or jump to the on-page
 * setup options. Both the hero and the "how it works" section pair install
 * with docs, mirroring the MCP page.
 */
export function cliCtas(locale: Locale): {
  docs: CliCta
  installCli: CliCta
} {
  const { t } = translationsFor(locale)
  return {
    docs: {
      label: t('cli.hero.viewDocs'),
      href: externalLinks.docsCli,
      target: '_blank'
    },
    installCli: {
      label: t('cli.hero.installCli'),
      href: '#setup'
    }
  }
}
