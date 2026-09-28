import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'

export const APP_MODE_TEMPLATE = 'viewport-app-template'

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
    'browser_tests/assets/linear-basic-app-1.json'
  )
}
