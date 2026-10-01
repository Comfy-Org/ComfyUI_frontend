import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const FLAG = 'agent-free-use-message-placement'
const NOTICE_COPY = 'Prompts and workflow runs are FREE during BETA.'

type Placement = 'top-banner' | 'near-composer' | 'above-input' | 'inside-input'

const test = mergeTests(agentTest, hostTelemetryFixture)

// Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/19712
test.describe(
  'Agent free-use placement experiment',
  {
    tag: ['@cloud', '@agent', '@ui']
  },
  () => {
    for (const placement of [
      'top-banner',
      'near-composer',
      'above-input',
      'inside-input'
    ] satisfies Placement[]) {
      test.describe(placement, () => {
        test(`shows the notice in the ${placement} region and records panel exposure`, async ({
          hostTelemetry,
          page
        }) => {
          await bootAgentApp(page, true, {
            features: { [FLAG]: placement, enable_telemetry: true }
          })
          const agentPanel = new AgentPanel(page)

          await agentPanel.open()

          const notice = agentPanel.root.getByRole('note', {
            name: 'Free use notice'
          })
          await expect(notice).toBeVisible()
          await expect(notice).toHaveAttribute('data-placement', placement)
          await expect(notice).toContainText(NOTICE_COPY)
          await expect(
            notice.getByRole('link', { name: 'Learn more' })
          ).toHaveAttribute('target', '_blank')
          await expect(notice).toHaveCount(1)

          const composer = agentPanel.root.getByTestId('agent-composer')
          const inputBox = composer.getByTestId('composer-input-box')

          if (placement === 'top-banner') {
            expect(
              await notice.evaluate((element) => element.closest('footer'))
            ).toBeNull()
          } else if (placement === 'near-composer') {
            expect(
              await notice.evaluate((element) =>
                element.closest('#agent-composer')
              )
            ).toBeNull()
            expect(
              await notice.evaluate((element) => element.closest('footer'))
            ).not.toBeNull()
            const [noticeBox, composerBox] = await Promise.all([
              notice.boundingBox(),
              composer.boundingBox()
            ])
            expect(noticeBox).not.toBeNull()
            expect(composerBox).not.toBeNull()
            expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(
              composerBox!.y
            )
          } else if (placement === 'above-input') {
            expect(
              await notice.evaluate((element) => element.parentElement?.id)
            ).toBe('agent-composer')
            const [noticeBox, inputBoxBounds] = await Promise.all([
              notice.boundingBox(),
              inputBox.boundingBox()
            ])
            expect(noticeBox).not.toBeNull()
            expect(inputBoxBounds).not.toBeNull()
            expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(
              inputBoxBounds!.y + 1
            )
          } else {
            expect(
              await notice.evaluate((element) =>
                element
                  .closest('[data-testid="composer-input-box"]')
                  ?.getAttribute('data-testid')
              )
            ).toBe('composer-input-box')
          }

          await expect
            .poll(() =>
              hostTelemetry.find(
                ({ event }) => event === 'app:agent_free_use_exposure'
              )
            )
            .toEqual({
              event: 'app:agent_free_use_exposure',
              properties: {
                [`$feature/${FLAG}`]: placement,
                placement
              }
            })
        })
      })
    }
  }
)
