import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import linearBasicApp from '@e2e/assets/linear-basic-app-1.json' with { type: 'json' }

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
  const appModeWorkflow = {
    ...structuredClone(linearBasicApp),
    extra: { ...linearBasicApp.extra, linearMode: true }
  }
  await templates.mockWorkflowData(APP_MODE_TEMPLATE, appModeWorkflow)
}
