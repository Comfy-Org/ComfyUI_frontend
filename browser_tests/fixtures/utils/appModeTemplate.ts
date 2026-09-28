import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'

/** Name of the App Mode template registered by {@link mockAppModeTemplate}. */
export const APP_MODE_TEMPLATE = 'pm-1733-app-template'

/**
 * Registers a template whose workflow carries `extra.linearMode`, so loading
 * it keeps App Mode active and the graph canvas hidden.
 */
export async function mockAppModeTemplate(
  templates: TemplateHelper
): Promise<void> {
  templates.configure(
    withTemplates([
      makeTemplate({ name: APP_MODE_TEMPLATE, title: 'App Template' })
    ])
  )
  await templates.mock()
  await templates.mockWorkflow(
    APP_MODE_TEMPLATE,
    'browser_tests/assets/linear-basic-app-template.json'
  )
}
