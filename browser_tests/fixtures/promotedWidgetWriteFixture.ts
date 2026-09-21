import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { PromotedWidgetWriteData } from '@e2e/fixtures/data/agent/promotedWidgetWrite'
import { createPromotedWidgetWriteData } from '@e2e/fixtures/data/agent/promotedWidgetWrite'

export const promotedWidgetWriteFixture = base.extend<{
  promotedWidgetWriteData: PromotedWidgetWriteData
}>({
  promotedWidgetWriteData: async ({}, use) => {
    await use(createPromotedWidgetWriteData())
  }
})
