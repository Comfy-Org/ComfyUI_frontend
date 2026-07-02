import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import type {
  ConnectivityOutcome,
  PlannedPair,
  RawNodeDef
} from '@e2e/fixtures/customNode/typePairing'
import {
  normalizeNodeDefs,
  planPairs
} from '@e2e/fixtures/customNode/typePairing'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { errorSurfaces } from '@e2e/fixtures/utils/errorSurfaces'

const CORE_PROOF_NODE_COUNT = 16
// A node may legitimately veto a wiring via onConnectInput; committed
// entries here must name the veto. Green means actual rejections are a
// subset of this list.
const CONNECT_REJECTED_ALLOWLIST: string[] = []
// The drag tier targets pure-socket link types; widget-backed primitive
// sockets render as widget rows, not slot dots, so they are covered by the
// model-level breadth sweep instead.
const WIDGET_PRIMITIVE_TYPES = new Set([
  'INT',
  'FLOAT',
  'STRING',
  'BOOLEAN',
  'COMBO'
])

test.use({
  initialSettings: {
    'Comfy.TutorialCompleted': false,
    'Comfy.userId': 'default',
    'Comfy.RightSidePanel.ShowErrorsTab': true
  }
})

test.beforeEach(async ({ comfyPage }) => {
  const templates = comfyPage.page.getByTestId('template-workflows-content')
  await templates.waitFor({ state: 'visible' })
  await comfyPage.page.keyboard.press('Escape')
  await templates.waitFor({ state: 'hidden' })
})

async function expectNoVisibleErrors(
  page: Page,
  context: string
): Promise<void> {
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    await expect(locator, `${context}: ${surface}`).toHaveCount(0)
}

function concrete(slot: { type: string }): boolean {
  return slot.type !== '' && slot.type !== '*'
}

const connectivityEntries = loadManifest().filter((entry) =>
  entry.tiers.includes('connectivity')
)

test('T-conn breadth: type-paired links survive model, serialize, and prompt round-trips', async ({
  comfyPage
}) => {
  test.setTimeout(120_000)
  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const nodes = normalizeNodeDefs(defs)

  const packTypes = connectivityEntries.flatMap((entry) => entry.expectedNodes)
  const coreProof = nodes
    .filter(
      (node) =>
        node.pack === 'core' &&
        node.inputs.some(concrete) &&
        node.outputs.some(concrete)
    )
    .map((node) => node.type)
    .sort()
    .slice(0, CORE_PROOF_NODE_COUNT)
  const plan = planPairs(nodes, [...packTypes, ...coreProof])

  expect(plan.pairs.length, 'pairing produced no edges').toBeGreaterThan(0)
  console.log(
    `T-conn plan: ${plan.pairs.length} pairs, ${plan.orphans.length} orphan slots, ${plan.wildcards.length} wildcard slots (excluded by design)`
  )

  const consoleErrors = collectConsoleErrors(comfyPage.page)
  const results = await comfyPage.page.evaluate(async (pairs) => {
    const graph = window.app!.graph
    const report: Array<{
      key: string
      outcome: string
      detail?: string
    }> = []
    for (const pair of pairs) {
      const key = `${pair.producer.nodeType}.${pair.producer.slotName} -> ${pair.consumer.nodeType}.${pair.consumer.slotName}`
      try {
        graph.clear()
        const producer = window.LiteGraph!.createNode(pair.producer.nodeType)
        const consumer = window.LiteGraph!.createNode(pair.consumer.nodeType)
        if (!producer || !consumer) {
          report.push({
            key,
            outcome: 'SLOT_CONTRACT_MISMATCH',
            detail: 'createNode returned null for a registered type'
          })
          continue
        }
        graph.add(producer)
        graph.add(consumer)
        const outIndex = producer.outputs.findIndex(
          (slot) => slot.name === pair.producer.slotName
        )
        const inIndex = consumer.inputs.findIndex(
          (slot) => slot.name === pair.consumer.slotName
        )
        if (outIndex < 0 || inIndex < 0) {
          report.push({
            key,
            outcome: 'SLOT_CONTRACT_MISMATCH',
            detail: `declared slot missing on instance (out=${outIndex}, in=${inIndex})`
          })
          continue
        }
        const link = producer.connect(outIndex, consumer, inIndex)
        if (!link || consumer.inputs[inIndex]?.link == null) {
          report.push({ key, outcome: 'CONNECT_REJECTED' })
          continue
        }
        const serialized = graph.serialize()
        graph.configure(serialized)
        const restored = graph.getNodeById(consumer.id)
        if (restored?.inputs?.[inIndex]?.link == null) {
          report.push({
            key,
            outcome: 'ROUNDTRIP_LOST',
            detail: 'serialize/configure dropped the link'
          })
          continue
        }
        const prompt = (await window.app!.graphToPrompt()) as {
          output?: Record<string, { inputs?: Record<string, unknown> }>
        }
        const promptInput =
          prompt.output?.[String(consumer.id)]?.inputs?.[pair.consumer.slotName]
        if (!Array.isArray(promptInput)) {
          report.push({
            key,
            outcome: 'ROUNDTRIP_LOST',
            detail: 'link missing from graphToPrompt output'
          })
          continue
        }
        report.push({ key, outcome: 'PASS' })
      } catch (error) {
        report.push({
          key,
          outcome: 'SLOT_CONTRACT_MISMATCH',
          detail: `threw: ${String(error)}`
        })
      }
    }
    graph.clear()
    return report
  }, plan.pairs)
  consoleErrors.stop()

  const failures = results.filter(
    (result) =>
      result.outcome !== ('PASS' satisfies ConnectivityOutcome) &&
      !(
        result.outcome === ('CONNECT_REJECTED' satisfies ConnectivityOutcome) &&
        CONNECT_REJECTED_ALLOWLIST.includes(result.key)
      )
  )
  const passed = results.filter((result) => result.outcome === 'PASS').length
  console.log(`T-conn sweep: ${passed}/${results.length} pairs PASS`)
  expect(failures, JSON.stringify(failures, null, 1)).toEqual([])
  expect(passed).toBeGreaterThan(0)
  await expectNoVisibleErrors(comfyPage.page, 'after breadth sweep')
})

test('T-conn fidelity: curated slot drags connect under both renderers', async ({
  comfyPage
}) => {
  test.setTimeout(120_000)
  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const nodes = normalizeNodeDefs(defs)

  // Native anchor pair plus one in-pack, link-typed pair per connectivity
  // pack (derived from the same generator the breadth sweep uses).
  const dragEdges: PlannedPair[] = [
    {
      producer: {
        nodeType: 'EmptyLatentImage',
        pack: 'core',
        slotName: 'LATENT',
        slotType: 'LATENT'
      },
      consumer: {
        nodeType: 'KSampler',
        pack: 'core',
        slotName: 'latent_image',
        slotType: 'LATENT'
      }
    }
  ]
  for (const entry of connectivityEntries) {
    const packPlan = planPairs(nodes, entry.expectedNodes)
    const inPack = packPlan.pairs.find(
      (pair) =>
        pair.producer.pack === entry.pack &&
        pair.consumer.pack === entry.pack &&
        !WIDGET_PRIMITIVE_TYPES.has(pair.producer.slotType.toUpperCase())
    )
    if (inPack) dragEdges.push(inPack)
    else
      console.log(
        `T-conn drag: ${entry.pack} has no in-pack link-typed pair; covered by the breadth sweep only`
      )
  }

  for (const vueNodesEnabled of [false, true]) {
    const consoleErrors = collectConsoleErrors(comfyPage.page)
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.Enabled',
      vueNodesEnabled
    )

    for (const edge of dragEdges) {
      await comfyPage.nodeOps.clearGraph()
      const producer = await comfyPage.nodeOps.addNode(
        edge.producer.nodeType,
        undefined,
        { x: 150, y: 200 }
      )
      const consumer = await comfyPage.nodeOps.addNode(
        edge.consumer.nodeType,
        undefined,
        { x: 700, y: 200 }
      )
      await comfyPage.nextFrame()

      const [outIndex, inIndex] = await comfyPage.page.evaluate(
        ([producerId, consumerId, outName, inName]) => {
          const byId = (id: string) =>
            window.app!.graph.nodes.find((node) => String(node.id) === id)!
          const src = byId(producerId)
          const dst = byId(consumerId)
          return [
            src.outputs.findIndex((slot) => slot.name === outName),
            dst.inputs.findIndex((slot) => slot.name === inName)
          ]
        },
        [
          String(producer.id),
          String(consumer.id),
          edge.producer.slotName,
          edge.consumer.slotName
        ] as const
      )
      const key = `${edge.producer.nodeType}.${edge.producer.slotName} -> ${edge.consumer.nodeType}.${edge.consumer.slotName}`
      expect(outIndex, `${key}: producer slot on instance`).toBeGreaterThan(-1)
      expect(inIndex, `${key}: consumer slot on instance`).toBeGreaterThan(-1)

      if (vueNodesEnabled) {
        await comfyPage.vueNodes.waitForNodes(2)
        // Output-side mirror of getInputSlotConnectionDot, addressed by
        // data-slot-key so shared-label ambiguity cannot misfire the drag.
        const outDot = comfyPage.page
          .locator(`[data-node-id="${String(producer.id)}"]`)
          .locator('.lg-slot--output')
          .filter({
            has: comfyPage.page.locator(
              `[data-slot-key="${String(producer.id)}-out-${outIndex}"]`
            )
          })
          .getByTestId('slot-connection-dot')
        const inDot = comfyPage.vueNodes.getInputSlotConnectionDot(
          String(consumer.id),
          inIndex
        )
        await outDot.dragTo(inDot)
      } else {
        await producer.connectOutput(outIndex, consumer, inIndex)
      }

      const linked = await comfyPage.page.evaluate(
        ([consumerId, index]) => {
          const node = window.app!.graph.nodes.find(
            (candidate) => String(candidate.id) === consumerId
          )
          return node?.inputs?.[Number(index)]?.link != null
        },
        [String(consumer.id), String(inIndex)] as const
      )
      expect(linked, `${key} with VueNodes=${vueNodesEnabled}`).toBe(true)
    }

    consoleErrors.stop()
    expect(
      consoleErrors.errors,
      `console errors with VueNodes=${vueNodesEnabled}`
    ).toEqual([])
    await expectNoVisibleErrors(
      comfyPage.page,
      `after drag pass VueNodes=${vueNodesEnabled}`
    )
  }
})
