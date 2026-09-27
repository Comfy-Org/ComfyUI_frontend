import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface McpCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * Calls-to-action for the MCP page: view the docs or jump to the on-page
 * setup options. Both the hero and the "how it works" section pair install
 * with docs.
 */
export function mcpCtas(locale: Locale): {
  docs: McpCta
  installMcp: McpCta
} {
  return {
    docs: {
      label: t('mcp.hero.viewDocs', locale),
      href: externalLinks.docsMcp,
      target: '_blank'
    },
    installMcp: {
      label: t('mcp.hero.installMcp', locale),
      href: '#setup'
    }
  }
}
