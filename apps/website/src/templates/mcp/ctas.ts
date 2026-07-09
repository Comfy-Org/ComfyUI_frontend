import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export interface McpCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * The two calls-to-action shared by the MCP hero and "how it works" sections:
 * view the docs, or run a workflow in the cloud.
 */
export function mcpCtas(locale: Locale): { docs: McpCta; runWorkflow: McpCta } {
  return {
    docs: {
      label: t('mcp.hero.viewDocs', locale),
      href: externalLinks.docsMcp,
      target: '_blank'
    },
    runWorkflow: {
      label: t('mcp.hero.runWorkflow', locale),
      href: getRoutes(locale).cloud
    }
  }
}
