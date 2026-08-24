import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeId } from '@/types/nodeId'

const WORKFLOW = 'subgraphs/subgraph-with-promoted-text-widget'
const PROBE_VALUE = 'soak-s3-probe-value'

type ReplacementResult = {
  originalWidgetId: string
  replacementWidgetId: string | undefined
  replacementValue: unknown
  serializedWidgetsValues: unknown
}

/**
 * Removes the promoted-widget host SubgraphNode and re-adds one with the same
 * id from its own serialization — a node-level partial replacement. Measured
 * 2026-08-24: full-graph rebuilds (delete + Ctrl+Z, workflow reload) re-run
 * the whole configure pipeline and keep the widgetId intact on BOTH refs, so
 * they are NOT the trigger; the exposure is node-level replacement flows
 * (extension code, missing-node replacement variants). Returns the promoted
 * input's widgetId wiring on both sides.
 */
async function replaceHostInPlace(
  comfyPage: ComfyPage
): Promise<ReplacementResult> {
  const result = await comfyPage.page.evaluate(async (probeValue) => {
    const graph = window.app!.graph
    const host = graph.nodes.find((n) => n.isSubgraphNode())
    if (!host) throw new Error('Fixture must contain a SubgraphNode host')

    const promotedInput = host.inputs.find((input) => input.widgetId != null)
    if (!promotedInput?.widgetId) {
      throw new Error('Host must expose one promoted widget input')
    }
    const originalWidgetId = String(promotedInput.widgetId)

    const promotedWidget = host.widgets?.[0]
    if (!promotedWidget) throw new Error('Host must carry a promoted widget')
    promotedWidget.value = probeValue

    const data = host.serialize()
    graph.remove(host)
    await Promise.resolve()

    const replacement = window.LiteGraph!.createNode(data.type)
    if (!replacement) throw new Error(`createNode(${data.type}) returned null`)
    // Compile-time brand only: toNodeId is not available inside the
    // browser evaluate context, and String() is its exact runtime behavior.
    replacement.id = String(data.id) as NodeId
    graph.add(replacement)
    replacement.configure(data)
    await Promise.resolve()

    if (String(replacement.id) !== String(data.id)) {
      throw new Error(
        `Replacement did not keep the id: ${replacement.id} vs ${data.id}`
      )
    }

    const replacedInput = replacement.inputs.find(
      (input) => input.widgetId != null
    )
    const serialized = replacement.serialize()
    return {
      originalWidgetId,
      replacementWidgetId: replacedInput?.widgetId
        ? String(replacedInput.widgetId)
        : undefined,
      replacementValue: replacement.widgets?.[0]?.value,
      serializedWidgetsValues: serialized.widgets_values ?? null
    }
  }, PROBE_VALUE)
  await comfyPage.nextFrame()
  return result
}

async function verifyPromotedWidgetSurvivesReplacement(
  comfyPage: ComfyPage
): Promise<void> {
  await comfyPage.workflow.loadWorkflow(WORKFLOW)
  const result = await replaceHostInPlace(comfyPage)

  // Armed only after setup succeeded: an early test.fail() would record
  // fixture/setup errors as the expected failure and stop pinning #15665.
  test.fail()
  expect(
    result.replacementWidgetId,
    `same-id replacement must keep the promoted input's widgetId (was ${result.originalWidgetId})`
  ).toBe(result.originalWidgetId)
  expect(
    result.serializedWidgetsValues,
    'the promoted value must survive into widgets_values on the next save'
  ).toEqual([PROBE_VALUE])
}

test.describe(
  'Promoted widget after same-id SubgraphNode replacement',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    // Soak S3 / #15665: on feature/ecs-migration the replacement's promoted
    // input comes back with widgetId undefined, so serialize() drops the
    // entire widgets_values key (invariant I1). These pin the WANTED
    // behaviour; they flip to unexpected-pass when #15665 is fixed and must
    // then be promoted by removing test.fail().
    test('classic: same-id host replacement keeps promoted widgetId and value', async ({
      comfyPage
    }) => {
      await verifyPromotedWidgetSurvivesReplacement(comfyPage)
    })

    test(
      'vue nodes: same-id host replacement keeps promoted widgetId and value',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        await verifyPromotedWidgetSurvivesReplacement(comfyPage)
      }
    )
  }
)
