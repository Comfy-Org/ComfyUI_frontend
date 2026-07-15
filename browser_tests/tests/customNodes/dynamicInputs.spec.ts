/* oxlint-disable playwright/no-skipped-test -- skips only when the target backend lacks the pack; environment gating, not a disabled test */
import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { isForeignExecutionNoise } from '@e2e/fixtures/customNode/consoleErrorLedger'
import { expectedNodesPresent } from '@e2e/fixtures/customNode/objectInfoValidator'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  loadManifest,
  rendererPassesFor
} from '@e2e/fixtures/customNode/manifest'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog
} from '@e2e/fixtures/utils/customNodeSuite'
import { errorSurfaces } from '@e2e/fixtures/utils/errorSurfaces'

// Dynamic-input (autogrow) tier: packs whose JS adds an input slot when the
// last one is connected and removes trailing empties on disconnect. That
// behavior lives in pack JS (onConnectionsChange overrides), NOT in
// /object_info - the def declares only the initial slot, so the mount and
// connectivity tiers are structurally blind to it. This tier asserts the
// BEHAVIOR: connect -> the node grows; disconnect -> it shrinks back.
//
// Both connect paths run on purpose: the drag path and the programmatic
// path go through different frontend pipelines (pointer -> hit-test ->
// LinkConnector vs a direct node.connect), and Impact's handler inspects
// `new Error().stack` (on its disconnect/removal branch), so the two paths
// can break independently. Both renderers run because a Vue reactivity gap
// can grow the graph-side array without rendering the new slot row.
//
// One curated node per mechanism: every Impact autogrow node shares one
// onConnectionsChange block, so a second node of the same mechanism adds
// runtime, not detection. ImpactMakeImageList is the IMAGE-typed member,
// wireable from the model-free EmptyImage.
//
// Disconnect runs single-path (programmatic disconnectInput) on purpose: the
// pack contract under test fires on the disconnect EVENT regardless of how
// the link was severed, and the suite has no generic drag-detach vocabulary
// (drag-detach pointer mechanics are core-interaction territory).
const AUTOGROW_CASES = [
  {
    pack: 'ComfyUI-Impact-Pack',
    consumerType: 'ImpactMakeImageList',
    producerType: 'EmptyImage',
    producerSlot: 'IMAGE'
  }
]

const target = new LocalDesktopTarget()

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

async function consumerShape(
  page: Page,
  consumerId: string
): Promise<{ inputCount: number; domSlotDots: number }> {
  return await page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      (candidate) => String(candidate.id) === id
    )
    const root = document.querySelector(`[data-node-id="${id}"]`)
    return {
      inputCount: node?.inputs?.length ?? -1,
      domSlotDots:
        root?.querySelectorAll('[data-testid="slot-connection-dot"]').length ??
        -1
    }
  }, consumerId)
}

for (const autogrowCase of AUTOGROW_CASES) {
  test.describe(`dynamic inputs: ${autogrowCase.pack}`, () => {
    test(`${autogrowCase.consumerType} grows on connect and shrinks on disconnect (drag + programmatic, both renderers)`, async ({
      comfyPage
    }) => {
      test.setTimeout(120_000)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      expect(
        Object.keys(objectInfo).length,
        'object_info sanity floor'
      ).toBeGreaterThan(50)
      const { missing } = expectedNodesPresent(objectInfo, [
        autogrowCase.consumerType,
        autogrowCase.producerType
      ])
      test.skip(
        missing.length > 0,
        `${autogrowCase.pack} not installed on this backend (missing: ${missing.join(', ')})`
      )
      // The pack row owns renderer compatibility (vueNodesCompatible), so a
      // pack that ever declares itself Vue-incompatible keeps its canvas
      // coverage here instead of failing the Vue pass. Also validates the
      // curated pack label against the manifest.
      const manifestEntry = loadManifest().find(
        (entry) => entry.pack === autogrowCase.pack
      )
      expect(
        manifestEntry,
        `${autogrowCase.pack} is not a manifest pack - fix AUTOGROW_CASES`
      ).toBeDefined()

      for (const vueNodesEnabled of rendererPassesFor(manifestEntry!)) {
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )

        for (const connectPath of ['drag', 'programmatic'] as const) {
          const context = `${autogrowCase.consumerType} via ${connectPath} with VueNodes=${vueNodesEnabled}`
          await comfyPage.nodeOps.clearGraph()
          const producer = await comfyPage.nodeOps.addNode(
            autogrowCase.producerType,
            undefined,
            { x: 150, y: 200 }
          )
          const consumer = await comfyPage.nodeOps.addNode(
            autogrowCase.consumerType,
            undefined,
            { x: 700, y: 200 }
          )
          await comfyPage.nextFrame()
          const consumerId = String(consumer.id)

          // The DOM baseline below is a one-shot census, so the Vue nodes
          // must be MOUNTED first or it captures a mid-mount undercount and
          // the +1 growth poll chases a wrong absolute target.
          if (vueNodesEnabled) {
            await comfyPage.vueNodes.waitForNodes(2)
            // Input 0 exists for every autogrow case; one visible dot proves
            // the slot rows mounted, so the census below reads settled DOM.
            await expect(
              comfyPage.vueNodes.getInputSlotConnectionDot(consumerId, 0),
              `${context}: consumer slot dots mounted before baseline`
            ).toBeVisible()
          }

          const before = await consumerShape(comfyPage.page, consumerId)
          expect(
            before.inputCount,
            `${context}: consumer instantiates with at least one input`
          ).toBeGreaterThan(0)
          const lastIndex = before.inputCount - 1
          const outIndex = await comfyPage.page.evaluate(
            ([producerId, slotName]) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === producerId
              )!
              return node.outputs.findIndex((slot) => slot.name === slotName)
            },
            [String(producer.id), autogrowCase.producerSlot] as const
          )
          expect(
            outIndex,
            `${context}: producer slot on instance`
          ).toBeGreaterThan(-1)

          if (connectPath === 'drag') {
            if (vueNodesEnabled) {
              const outDot = comfyPage.vueNodes.getOutputSlotConnectionDot(
                String(producer.id),
                outIndex
              )
              const inDot = comfyPage.vueNodes.getInputSlotConnectionDot(
                consumerId,
                lastIndex
              )
              await outDot.dragTo(inDot)
            } else {
              await producer.connectOutput(outIndex, consumer, lastIndex)
            }
          } else {
            await comfyPage.page.evaluate(
              ([producerId, consumerId, out, input]) => {
                const byId = (id: string) =>
                  window.app!.graph.nodes.find(
                    (node) => String(node.id) === id
                  )!
                byId(producerId).connect(
                  Number(out),
                  byId(consumerId),
                  Number(input)
                )
              },
              [
                String(producer.id),
                consumerId,
                String(outIndex),
                String(lastIndex)
              ] as const
            )
          }
          await comfyPage.nextFrame()

          // The link itself must land on the LAST input: stricter than the
          // handler needs (it grows on any connect), but a drag that falls
          // back to an earlier slot is a hit-test regression this tier
          // should surface, not silently absorb.
          await expect
            .poll(
              () =>
                comfyPage.page.evaluate(
                  ([id, index]) => {
                    const node = window.app!.graph.nodes.find(
                      (candidate) => String(candidate.id) === id
                    )
                    return node?.inputs?.[Number(index)]?.link != null
                  },
                  [consumerId, String(lastIndex)] as const
                ),
              { message: `${context}: link lands on the last input` }
            )
            .toBe(true)

          // The behavior under test: the pack's JS appends a fresh input.
          await expect
            .poll(
              async () =>
                (await consumerShape(comfyPage.page, consumerId)).inputCount,
              { message: `${context}: input count grows by one on connect` }
            )
            .toBe(before.inputCount + 1)

          // Rendered growth: the new input must also EXIST as a slot row.
          // Graph-side growth without a rendered row is the Vue reactivity
          // gap the CombineRegionalPrompts incident exposed.
          if (vueNodesEnabled)
            await expect
              .poll(
                async () =>
                  (await consumerShape(comfyPage.page, consumerId)).domSlotDots,
                { message: `${context}: grown input renders a slot dot` }
              )
              .toBe(before.domSlotDots + 1)

          await comfyPage.page.evaluate(
            ([id, index]) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === id
              )!
              node.disconnectInput(Number(index))
            },
            [consumerId, String(lastIndex)] as const
          )
          await comfyPage.nextFrame()
          await expect
            .poll(
              async () =>
                (await consumerShape(comfyPage.page, consumerId)).inputCount,
              {
                message: `${context}: trailing empty input removed on disconnect`
              }
            )
            .toBe(before.inputCount)

          // Symmetric rendered-shrink assert: the reactivity gap applies to
          // slot removal too - a stale rendered row after disconnect would
          // otherwise pass.
          if (vueNodesEnabled)
            await expect
              .poll(
                async () =>
                  (await consumerShape(comfyPage.page, consumerId)).domSlotDots,
                { message: `${context}: removed input's slot dot unrenders` }
              )
              .toBe(before.domSlotDots)
        }

        consoleErrors.stop()
        expect(
          consoleErrors.errors.filter(
            (error) => !isForeignExecutionNoise(error)
          ),
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
        for (const [surface, locator] of Object.entries(
          errorSurfaces(comfyPage.page)
        ))
          await expect(
            locator,
            `after VueNodes=${vueNodesEnabled} pass: ${surface}`
          ).toHaveCount(0)
      }
    })
  })
}
