import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import { runApprovalAsk } from '@e2e/fixtures/data/agent/agentAskFrames'

// BE-1359, user report case #1: "i would be more likely do an agentic
// workflow run from graph build to finish and let it cook if agent could
// estimate costs for me, even a ball park $5 vs $10 vs $50". The run approval
// card is where that user commits to the spend, and it used to say nothing
// about cost — so the answer to "do you approve?" was uninformed.
//
// What this suite pins is the honesty of the figure, not its presence:
// a per-run price is summed, a priced-per-token node never reads as zero,
// an api node with no usable price never reads as free, and an OSS-only graph
// gets no figure at all rather than a "0 credits" that cloud GPU time would
// make false.

const PRICED_TYPE = 'TestPricedApiNode'
const PER_TOKEN_TYPE = 'TestPerTokenApiNode'
const DESCRIBED_TYPE = 'TestDescribedApiNode'
const OSS_TYPE = 'TestOssNode'

/** 1 USD is 211 credits, so $0.05 shows as 10.6 and $0.10 as 21.1. */
const PRICE_USD = 0.05

function apiNodeDef(name: string, expr: string | null): ComfyNodeDef {
  return {
    name,
    display_name: name,
    description: '',
    category: 'api node/test',
    python_module: 'comfy_api_nodes.nodes_test',
    output_node: false,
    api_node: true,
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    input: { required: {} },
    input_order: { required: [] },
    ...(expr && {
      price_badge: {
        engine: 'jsonata' as const,
        expr,
        depends_on: { widgets: [], inputs: [], input_groups: [] }
      }
    })
  }
}

const nodeDefs: Record<string, ComfyNodeDef> = {
  [PRICED_TYPE]: apiNodeDef(PRICED_TYPE, `{"type":"usd","usd":${PRICE_USD}}`),
  // The shape 34 of core's 286 published prices use: a real figure the user
  // is charged per 1K tokens, which no per-run total may absorb.
  [PER_TOKEN_TYPE]: apiNodeDef(
    PER_TOKEN_TYPE,
    '{"type":"usd","usd":0.002,"format":{"suffix":" per 1K tokens"}}'
  ),
  // The shape core uses for token-based LLM nodes: prose, no figure.
  [DESCRIBED_TYPE]: apiNodeDef(
    DESCRIBED_TYPE,
    '{"type":"text","text":"Priced per token"}'
  ),
  [OSS_TYPE]: {
    ...apiNodeDef(OSS_TYPE, null),
    api_node: false,
    category: 'test',
    python_module: 'nodes'
  }
}

const atLeast = (credits: string) =>
  enMessages.agent.runApproval.estimateAtLeast.replace('{credits}', credits)

test.describe(
  'Agent run approval cost estimate',
  { tag: ['@cloud', '@agent'] },
  () => {
    async function addNodes(page: Page, types: string[]): Promise<void> {
      await page.evaluate((nodeTypes) => {
        nodeTypes.forEach((nodeType, index) => {
          const node = window.LiteGraph!.createNode(nodeType)
          if (!node)
            throw new Error(`${nodeType} is not a registered node type`)
          node.pos = [120 + index * 240, 160]
          window.app!.graph.add(node)
        })
      }, types)
    }

    test('the card shows a floor for the api nodes the run would charge for', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: nodeDefs
      })
      const cost = panel.getByTestId('run-approval-cost')

      await test.step('two $0.05 api nodes read as one $0.10 charge', async () => {
        await addNodes(page, [PRICED_TYPE, PRICED_TYPE])
        send(runApprovalAsk())
        await expect(
          panel.getByText(enMessages.agent.runApproval.leadBound)
        ).toBeVisible()
        // 21.1, not 21.2: credits are converted once from the summed dollars,
        // so the per-node label's rounding is not accumulated.
        await expect(cost).toHaveText(atLeast('21.1'))
      })

      await test.step('a per-token node is excluded, never summed as zero', async () => {
        await addNodes(page, [PER_TOKEN_TYPE])
        await expect(cost).toHaveText(atLeast('21.1'))
      })

      await test.step('an unpriceable api node does not reduce the floor', async () => {
        await addNodes(page, [DESCRIBED_TYPE])
        await expect(cost).toHaveText(atLeast('21.1'))
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

    test('a graph whose api nodes cannot be priced says so instead of implying free', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: nodeDefs
      })

      await addNodes(page, [DESCRIBED_TYPE])
      send(runApprovalAsk())
      await expect(
        panel.getByText(enMessages.agent.runApproval.leadBound)
      ).toBeVisible()
      await expect(panel.getByTestId('run-approval-cost')).toHaveText(
        enMessages.agent.runApproval.estimateUnavailable
      )
    })

    test('an OSS-only graph claims no figure, because GPU time is unpriced', async ({
      page,
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send } = await startAskTurn('Run it.', 'ask_approval', {
        objectInfo: nodeDefs
      })

      await addNodes(page, [OSS_TYPE])
      send(runApprovalAsk())
      await expect(
        panel.getByText(enMessages.agent.runApproval.leadBound)
      ).toBeVisible()
      await expect(panel.getByTestId('run-approval-cost')).toHaveCount(0)
    })
  }
)
