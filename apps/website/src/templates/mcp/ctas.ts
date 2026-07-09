import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface McpCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * Calls-to-action for the MCP page: view the docs, jump to the on-page setup
 * steps, or run a workflow in the cloud. The hero leads with install + docs;
 * the "how it works" section pairs run-a-workflow with docs.
 */
export function mcpCtas(locale: Locale): {
  docs: McpCta
  installMcp: McpCta
  runWorkflow: McpCta
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
    },
    runWorkflow: {
      label: t('mcp.hero.runWorkflow', locale),
      href: getRoutes(locale).cloud
    }
  }
}
