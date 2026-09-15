import type { TemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import { createTemplateHelper } from '@e2e/fixtures/helpers/TemplateHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const templateApiFixture = base.extend<{
  templateApi: TemplateHelper
}>({
  templateApi: async ({ page }, use) => {
    await use(createTemplateHelper(page))
  }
})
