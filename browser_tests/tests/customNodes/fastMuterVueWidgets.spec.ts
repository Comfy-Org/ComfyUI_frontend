import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

const SOURCE_TYPE = 'PrimitiveStringMultiline'
const MUTER_TYPE = 'Fast Muter (rgthree)'

type MuterModel = {
  widgetCount: number
  widgetNames: string[]
  linkedTitle: string
}

/**
 * Builds source → Fast Muter and waits for rgthree's periodic
 * handleLinkedNodesStabilization to mint and rename the toggle widget
 * (`widget.name = \`Enable ${linkedNode.title}\`` — the unenforced rename
 * that soak S6 / #15600 probes).
 */
async function skipUnlessMuterRegistered(comfyPage: ComfyPage): Promise<void> {
  const registered = await comfyPage.page.evaluate(
    (type) => Boolean(window.LiteGraph!.registered_node_types[type]),
    MUTER_TYPE
  )
  // oxlint-disable-next-line playwright/no-skipped-test -- conditional environment guard: rgthree-comfy absent
  test.skip(
    !registered,
    `${MUTER_TYPE} is not registered — rgthree-comfy is not installed in this environment`
  )
}

async function buildMuterPair(comfyPage: ComfyPage): Promise<MuterModel> {
  await comfyPage.nodeOps.clearGraph()
  const source = await comfyPage.nodeOps.addNode(SOURCE_TYPE, undefined, {
    x: 150,
    y: 200
  })
  const muter = await comfyPage.nodeOps.addNode(MUTER_TYPE, undefined, {
    x: 650,
    y: 200
  })
  await comfyPage.nextFrame()

  await source.connectOutput(0, muter, 0)
  await comfyPage.nextFrame()
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(
          ({ srcId, muterId }) =>
            [...window.app!.graph.links.values()].some(
              (l) =>
                String(l.origin_id) === srcId &&
                String(l.target_id) === muterId &&
                Number(l.target_slot) === 0
            ),
          { srcId: String(source.id), muterId: String(muter.id) }
        ),
      { message: 'source output connected into the muter input' }
    )
    .toBe(true)

  return expectMuterWidgetInModel(
    comfyPage,
    String(muter.id),
    String(source.id)
  )
}

async function expectMuterWidgetInModel(
  comfyPage: ComfyPage,
  muterId: string,
  sourceId: string
): Promise<MuterModel> {
  let last: MuterModel = { widgetCount: 0, widgetNames: [], linkedTitle: '' }
  await expect(async () => {
    last = await comfyPage.page.evaluate(
      ({ id, srcId }) => {
        const graph = window.app!.graph
        const muter = graph.getNodeById(id)
        if (!muter) throw new Error(`Muter ${id} not found`)
        const source = graph.getNodeById(srcId)
        return {
          widgetCount: muter.widgets?.length ?? 0,
          widgetNames: (muter.widgets ?? []).map((w) => String(w.name)),
          linkedTitle: source ? String(source.title) : ''
        }
      },
      { id: toNodeId(muterId), srcId: toNodeId(sourceId) }
    )
    expect(
      last.widgetCount,
      `muter must mint one toggle per linked node — got ${JSON.stringify(last)}`
    ).toBe(1)
    expect(last.widgetNames[0]).toBe(`Enable ${last.linkedTitle}`)
  }).toPass({ timeout: 10_000 })
  return last
}

// Soak S6 / #15600: rgthree renames its toggle widgets after creation
// (base_node_mode_changer.js: `widget.name = \`Enable ${title}\``). The store
// key was minted from the original name, so on feature/ecs-migration the Vue
// renderer drops the row silently while the model still carries it. Classic
// canvas draws from node.widgets and is the unaffected control arm.
test.describe(
  'rgthree Fast Muter widgets',
  { tag: ['@custom-nodes', '@widget'] },
  () => {
    test('classic: renamed toggle widget exists in the model and renders', async ({
      comfyPage
    }) => {
      test.slow()
      await skipUnlessMuterRegistered(comfyPage)
      const model = await buildMuterPair(comfyPage)
      expect(model.widgetNames[0]).toContain('Enable')
    })

    // WANTED behaviour, pinned while #15600 is open: the Vue node must render
    // the renamed toggle row. Flips to unexpected-pass when fixed.
    // Deliberately NOT @vue-nodes: the tag makes fixture setup wait for Vue
    // nodes on this worker's empty startup graph and times out. The setting
    // is toggled at runtime instead, before any node exists.
    test('vue nodes: renamed toggle widget renders a visible row', async ({
      comfyPage
    }) => {
      test.slow()
      await skipUnlessMuterRegistered(comfyPage)
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      const model = await buildMuterPair(comfyPage)
      await comfyPage.vueNodes.waitForNodes(2)

      const muterFixture =
        await comfyPage.vueNodes.getFixtureByTitle(/Fast Muter/)
      // Armed only now, with a bounded timeout: the pin must fail on THIS
      // assertion — an early test.fail() would let setup errors or the test
      // deadline satisfy it.
      test.fail()
      await expect(
        muterFixture.widgets.filter({
          hasText: `Enable ${model.linkedTitle}`
        }),
        'the renamed toggle must be visible on the Vue node'
      ).toHaveCount(1, { timeout: 5000 })
    })
  }
)
