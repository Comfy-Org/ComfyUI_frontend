import { expect } from '@playwright/test'

import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { UsageLogsTable } from '@e2e/fixtures/components/UsageLogsTable'
import {
  AGENT_USAGE_CUSTOMER_EVENTS,
  AGENT_USAGE_EVENT_TYPE,
  PARTNER_NODE_USAGE_EVENT_TYPE
} from '@e2e/fixtures/data/customerEvents'
import { localAuthFixture as test } from '@e2e/fixtures/localAuthFixture'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Activity tab charge tooltip',
  { tag: ['@screenshot', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/customers/events**', (route) =>
        route.fulfill({ json: AGENT_USAGE_CUSTOMER_EVENTS })
      )
      await new UsageLogsTable(comfyPage.settingDialog).open()
    })

    test('shows charge_micro_usd as whole credits', async ({ comfyPage }) => {
      const table = new UsageLogsTable(comfyPage.settingDialog)
      const tooltip = new Tooltip(comfyPage.page)

      await table.additionalInfoButton(AGENT_USAGE_EVENT_TYPE).hover()

      await expect(tooltip.open).toContainText('Charge: 7 Credits')
      await expect(tooltip.open).not.toContainText('Charge Micro Usd')
      await expect(tooltip.open).toContainText('Input Tokens: 12,480')
      await expect(tooltip.open).toContainText('Output Tokens: 1,536')
      await expectElementScreenshot(
        tooltip.surface(tooltip.open),
        'activity-charge-tooltip-credits.png'
      )
    })

    test('passes a non-numeric charge through unchanged', async ({
      comfyPage
    }) => {
      const table = new UsageLogsTable(comfyPage.settingDialog)
      const tooltip = new Tooltip(comfyPage.page)

      await table.additionalInfoButton(PARTNER_NODE_USAGE_EVENT_TYPE).hover()

      await expect(tooltip.open).toContainText('Charge Micro Usd: pending')
      await expect(tooltip.open).not.toContainText('Credits')
      await expect(tooltip.open).toContainText('Input Tokens: 320')
      await expectElementScreenshot(
        tooltip.surface(tooltip.open),
        'activity-charge-tooltip-passthrough.png'
      )
    })
  }
)
