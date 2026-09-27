import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import { toNodeId } from '@/types/nodeId'

import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import { imageLayoutNodeDefinitions } from '@e2e/fixtures/data/agent/imageLayoutNodeDefinitions'
import { referenceGraphOps } from '@e2e/fixtures/data/minimaxAutogrowReload'
import { wireAndReopen } from '@e2e/fixtures/utils/minimaxAutogrowReload'
import {
  nodesWithoutGeometry,
  overlappingNodePairs
} from '@e2e/fixtures/utils/nodeLayoutGeometry'
import { nextFrame } from '@e2e/fixtures/utils/timing'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'
const WIDGET_CASE = 'agent-rec-set-widget-existing'
const LOAD_IMAGE_SETTLE_TIMEOUT = 10_000

test.describe(
  'Agent populated LoadImage layout',
  { tag: ['@cloud', '@vue-nodes', '@screenshot', '@node'] },
  () => {
    test.describe.configure({ timeout: 90_000 })
    test.use({
      conversationCase: 'agent-load-image-layout',
      extraNodeDefs: imageLayoutNodeDefinitions,
      previewImageAsset: 'image32x32.webp'
    })

    test('keeps Vue node previews from overlapping', async ({
      agentConversation,
      page
    }) => {
      await agentConversation.runTurns()

      const loaders = agentConversation.vueNodes.nodes.filter({
        has: page.getByTestId('node-title').filter({ hasText: 'Load Image' })
      })
      await expect(loaders).toHaveCount(5)
      const previews = page.locator('.image-preview img')
      await expect(previews).toHaveCount(5)
      await expect
        .poll(
          () =>
            previews.evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            ),
          { timeout: LOAD_IMAGE_SETTLE_TIMEOUT }
        )
        .toBe(true)
      await expect
        .poll(() => nodesWithoutGeometry(loaders), {
          timeout: LOAD_IMAGE_SETTLE_TIMEOUT
        })
        .toEqual([])
      await expect
        .poll(() => overlappingNodePairs(loaders), {
          timeout: LOAD_IMAGE_SETTLE_TIMEOUT
        })
        .toEqual([])

      await page.getByRole('button', { name: 'Fit View (.)' }).click()
      await nextFrame(page)
      await expect(page.locator('#graph-canvas')).toHaveScreenshot(
        'agent-load-image-layout.png',
        { mask: [agentConversation.panel] }
      )
    })
  }
)

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

    test.describe('remote apply acceptance', () => {
      test.describe('manual title', () => {
        test.use({ conversationCase: 'agent-rec-clarifying-question' })

        test('keeps a manual rename across an unrelated agent widget update', async ({
          agentConversation
        }) => {
          test.setTimeout(90_000)
          const customTitle = 'My renamed sampler'

          await agentConversation.sendPrompt(0)
          await agentConversation.replayResponse(0)
          await agentConversation.waitForTurnComplete()
          const sampler =
            await agentConversation.vueNodes.getFixtureByTitle('KSampler')
          await sampler.setTitle(customTitle)
          await expect(sampler.title).toHaveText(customTitle)

          await agentConversation.sendPrompt(1)
          await agentConversation.replayResponse(1)
          await agentConversation.waitForTurnComplete()

          await expect(sampler.title).toHaveText(customTitle)
        })
      })

      test.describe('active widget edit', () => {
        test.use({
          conversationCase: 'agent-rec-replace-prompt-encoder',
          humanOpsHost: 'apply'
        })

        test('keeps prompt keystrokes when a doc frame resyncs the widget', async ({
          agentConversation
        }) => {
          test.setTimeout(60_000)
          const nodeId = '4181654812796082'
          const appended = ' at sunset, golden hour, cinematic lighting'
          await agentConversation.runTurns()
          await expect(
            agentConversation.resyncWidget(nodeId, 'missing-widget')
          ).rejects.toThrow(
            `Host widget ${nodeId}.missing-widget does not exist`
          )

          const field = agentConversation.vueNodes
            .getNodeLocator(nodeId)
            .getByLabel('text', { exact: true })
          await expect(field).toHaveValue('a photo of a pier')
          await field.click()
          await field.press('End')
          await field.pressSequentially(appended.slice(0, 5), { delay: 20 })

          const typing = field.pressSequentially(appended.slice(5), {
            delay: 20
          })
          const resync = agentConversation.resyncWidget(nodeId, 'text')
          await typing
          await resync

          // PM-1191/PM-1697: the resync's whole-value set_widget is stale by
          // however many keystrokes were in flight when the host built it.
          // The local-dirty guard on the incremental setWidget path
          // (graphMutations.ts) now skips it, so the typed text survives
          // regardless of where the resync interleaves with the keystrokes.
          await expect(field).toHaveValue(`a photo of a pier${appended}`)
        })
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

test.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud', '@vue-nodes'] },
  () => {
    // The reference node is not in the recorded core subset, so its definition
    // is served through the conversation fixture's own /object_info payload.
    // Routing it separately is shadowed by that route and the node lands
    // unregistered, which silently disarms this regression.
    test.use({
      conversationCase: WIRING_CASE,
      extraNodeDefs: {
        [BYTEDANCE_REFERENCE_NODE_TYPE]: byteDanceReferenceNodeDef
      }
    })

    // PM-993: the saved document addresses inputs by index, so growing the
    // next reference image on reopen used to re-target every wire below it.
    test('keeps widget links after a reference input grows', async ({
      agentConversation,
      page
    }) => {
      await test.step('Establish the agent conversation', async () => {
        await agentConversation.runTurns()
      })

      await test.step('Materialize the reference node and its sources', async () => {
        await agentConversation.applyGraphOps(referenceGraphOps)
      })

      await test.step('Connect and reopen without changing named wire targets', async () => {
        const wiring = await wireAndReopen(page)

        expect(wiring).toEqual({
          hasNextReference: true,
          referenceLinked: true,
          seedLinkBefore: expect.any(Number),
          seedLinkAfter: wiring.seedLinkBefore
        })
      })
    })
  }
)
