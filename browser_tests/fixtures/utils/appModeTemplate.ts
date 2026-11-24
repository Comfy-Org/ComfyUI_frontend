import { omit } from 'es-toolkit'

import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import defaultWorkflow from '@e2e/assets/default.json' with { type: 'json' }

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
  const workflow = structuredClone(defaultWorkflow)
  const appModeWorkflow = {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      properties: omit(node.properties, ['models'])
    })),
    extra: { ...workflow.extra, linearMode: true }
  }
  await templates.mockWorkflowData(APP_MODE_TEMPLATE, appModeWorkflow)
}
