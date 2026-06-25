import { test as base } from '@playwright/test'

import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import { createTemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'

export const templateApiFixture = base.extend<{
  templateApi: TemplateHelper
}>({
  templateApi: async ({ page }, use) => {
    const templateApi = createTemplateHelper(page)

    await use(templateApi)

    await templateApi.clearMocks()
  }
})
