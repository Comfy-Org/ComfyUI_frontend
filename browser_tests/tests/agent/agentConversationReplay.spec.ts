import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import { toNodeId } from '@/types/nodeId'
import { assetPath } from '@e2e/fixtures/utils/paths'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'
const WIDGET_CASE = 'agent-rec-set-widget-existing'

// Synthesized (not a cloud capture, see the fixture's `source.note`), so it
// lives under conversations/repro/ rather than conversations/ and is
// deliberately absent from listRecordedConversations() below.
const ASSET_GRID_CASE = 'repro/pm-1135-asset-grid-fragmentation'

test.describe(
  'Agent conversation replay',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.describe('wire evidence', () => {
      test.use({ conversationCase: WIRING_CASE })

      // The second turn's only edit is a connect, so what the canvas shows after
      // it is the wire itself: the app's own render loop paints it, and the
      // expectation is the picture, not a reconstruction of the renderer.
      test('paints the wire the second turn connects @screenshot', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        await expect(page.locator('#graph-canvas')).toHaveScreenshot(
          'two-turn-dependent-edit-wired.png',
          { mask: [agentConversation.panel] }
        )
      })
    })

    // PM-1135 / PM-1313: agentEventTransport.ts closes the open TextPart
    // (closeOpenText) on every agent_thinking / agent_tool_call /
    // agent_active_tab / agent_ask event, so a batch of assets separated by any
    // of those lands as N separate one-asset TextParts. AgentMessage.vue's
    // `groups` computed now folds those TextParts back together (only a
    // user-facing interruption — a tab link, a run approval, a paywall, a
    // notice — starts a new text group), and MarkdownStream aggregates every
    // asset in a merged group into one trailing grid regardless of the prose
    // between them, so the two assets render through one ReplyAssetGroup
    // instead of one each. This replays a turn shaped exactly like that (two
    // generate_image tool calls, one per asset, each with its own caption)
    // through the real chat panel and checks the two assets land in a single
    // grid, not two stacked single-item ones.
    test.describe(`recorded ${ASSET_GRID_CASE}`, () => {
      test.use({ conversationCase: ASSET_GRID_CASE })

      test(
        'PM-1135: a batch reply renders every generated asset in one grid, even when a tool call splits it across two message deltas, see linear.app/comfyorg/issue/PM-1135',
        { tag: ['@screenshot'] },
        async ({ agentConversation, page }) => {
          test.setTimeout(90_000)
          await page.route(
            'https://assets.example/outputs/render_a.png',
            (route) =>
              route.fulfill({ path: assetPath('agent/asset-grid-repro-a.png') })
          )
          await page.route(
            'https://assets.example/outputs/render_b.png',
            (route) =>
              route.fulfill({ path: assetPath('agent/asset-grid-repro-b.png') })
          )

          await agentConversation.runTurns()

          const images = agentConversation.panel.getByRole('img', {
            name: /^render_[ab]\.png$/
          })
          await expect(images).toHaveCount(2)

          // Visual proof of the fix: the two assets now land in a single grid
          // instead of separate fullwidth blocks stacked in one column.
          // Elapsed-time text ("Worked for 1.8 seconds", the per-step "1.3s")
          // is wall-clock and drifts under SLOW_MO, so it is masked out.
          const stepDurations = agentConversation.panel.getByText(
            /^(\d+(\.\d+)?s|\d+m \d+s)$/
          )
          await expect(agentConversation.panel).toHaveScreenshot(
            'asset-grid-fragmentation.png',
            { mask: [agentConversation.summaries, stepDurations] }
          )

          // Both assets should land inside the SAME grid container.
          const gridCount = await agentConversation.panel.evaluate((panel) => {
            const imgs = [...panel.querySelectorAll('img[alt^="render_"]')]
            const grids = new Set(
              imgs.map((img) => img.closest('[class*="grid-cols-"]'))
            )
            return grids.size
          })
          expect(gridCount).toBe(1)
        }
      )
    })

    test.describe('live widget effects', () => {
      test.use({ conversationCase: WIDGET_CASE })

      test('refreshes dependent combo options after an agent widget edit', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns(() =>
          page.evaluate((nodeId) => {
            const node = window.app!.graph.getNodeById(nodeId)
            const steps = node?.widgets?.find(
              (widget) => widget.name === 'steps'
            )
            if (!steps) throw new Error('KSampler steps widget not found')
            steps.callback = (_value, _canvas, owner) => {
              const sampler = owner?.widgets?.find(
                (widget) => widget.name === 'sampler_name'
              )
              if (!sampler) throw new Error('KSampler sampler widget not found')
              sampler.options.values = ['euler', 'heun']
            }
          }, toNodeId(3))
        )

        const sampler = agentConversation.vueNodes
          .getNodeLocator('3')
          .getByRole('combobox', { name: 'sampler_name', exact: true })
        await sampler.click()
        await expect(page.getByRole('option', { name: 'heun' })).toBeVisible()
        await expect(sampler).not.toHaveAttribute('aria-invalid')
      })
    })

    for (const conversationCase of listRecordedConversations()) {
      test.describe(`recorded ${conversationCase}`, () => {
        test.use({ conversationCase })

        test('replays every recorded turn onto the panel and the canvas', async ({
          agentConversation
        }) => {
          test.setTimeout(90_000)
          await agentConversation.runTurns()

          await expect(
            agentConversation.panel.getByRole('button', {
              name: `Open ${agentConversation.conversation.workflow.name}`
            })
          ).toBeVisible()
        })
      })
    }
  }
)
