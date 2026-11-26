import { expect } from '@playwright/test'

import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import { runApprovalAsk } from '@e2e/fixtures/data/agent/agentAskFrames'
import {
  DESCRIBED_API_NODE,
  OSS_NODE,
  PER_TOKEN_API_NODE,
  PRICED_API_NODE,
  atLeastCredits,
  runCostNodeDefs
} from '@e2e/fixtures/data/agent/agentRunCostNodeDefs'
import { addCanvasNodes } from '@e2e/fixtures/utils/agentCanvasNodes'

test.describe(
  'Agent run approval cost estimate',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('the card shows a floor for the api nodes the run would charge for', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: runCostNodeDefs
      })
      const cost = panel.getByTestId('run-approval-cost')

      await test.step('two $0.05 api nodes read as 21.1 credits, converted once from the summed dollars rather than per node', async () => {
        await addCanvasNodes(page, [PRICED_API_NODE, PRICED_API_NODE])
        send(runApprovalAsk())
        await expect(
          panel.getByText(enMessages.agent.runApproval.leadBound)
        ).toBeVisible()
        await expect(cost).toHaveText(atLeastCredits('21.1'))
      })

      await test.step('a per-token node is excluded, never summed as zero', async () => {
        await addCanvasNodes(page, [PER_TOKEN_API_NODE])
        await expect(cost).toHaveText(atLeastCredits('21.1'))
      })

      await test.step('an unpriceable api node does not reduce the floor', async () => {
        await addCanvasNodes(page, [DESCRIBED_API_NODE])
        await expect(cost).toHaveText(atLeastCredits('21.1'))
      })

      await test.step('the run is still gated on the user, estimate or not', async () => {
        await expect(
          panel.getByRole('button', {
            name: enMessages.agent.runApproval.run,
            exact: true
          })
        ).toBeEnabled()
      })
    })

    test('a graph whose api nodes cannot be priced shows no cost line', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: runCostNodeDefs
      })

      await addCanvasNodes(page, [DESCRIBED_API_NODE])
      send(runApprovalAsk())
      await expect(
        panel.getByText(enMessages.agent.runApproval.leadBound)
      ).toBeVisible()
      await expect(panel.getByTestId('run-approval-cost')).toHaveCount(0)
    })

    test('an OSS-only graph claims no figure, because GPU time is unpriced', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: runCostNodeDefs
      })

      await addCanvasNodes(page, [OSS_NODE])
      send(runApprovalAsk())
      await expect(
        panel.getByText(enMessages.agent.runApproval.leadBound)
      ).toBeVisible()
      await expect(panel.getByTestId('run-approval-cost')).toHaveCount(0)
    })

    test('a muted api node is left out of the floor the user approves against', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: runCostNodeDefs
      })
      await addCanvasNodes(page, [PRICED_API_NODE, PRICED_API_NODE])
      await page.evaluate(
        ([nodeType, mutedMode]) => {
          const priced = window
            .app!.graph.nodes.filter((node) => node.type === nodeType)
            .at(-1)
          if (!priced) throw new Error(`${nodeType} is not on the canvas`)
          priced.mode = mutedMode
        },
        [PRICED_API_NODE, LGraphEventMode.NEVER] as const
      )
      send(runApprovalAsk())

      await expect(panel.getByTestId('run-approval-cost')).toHaveText(
        atLeastCredits('10.6')
      )
    })
  }
)
