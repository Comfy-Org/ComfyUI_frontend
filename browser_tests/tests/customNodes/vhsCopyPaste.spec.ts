import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import { customNodeSuiteSettings } from '@e2e/fixtures/utils/customNodeSuite'

test.use({
  initialSettings: {
    ...customNodeSuiteSettings,
    'Comfy.VueNodes.Enabled': true
  }
})

test.describe('VHS copy and paste', { tag: '@custom-nodes' }, () => {
  test('pasting a connected Load Video (Upload) restores its widgets and links', async ({
    comfyPage
  }) => {
    // oxlint-disable-next-line playwright/no-skipped-test -- pack availability differs by manifest shard
    test.skip(
      !loadManifest().some(({ pack }) =>
        ['ComfyUI-VideoHelperSuite', 'comfyui-videohelpersuite'].includes(pack)
      ),
      'Video Helper Suite is not installed in this manifest shard'
    )
    test.setTimeout(60_000)
    await comfyPage.nodeOps.clearGraph()

    const original = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const batch = window.LiteGraph!.createNode('VHS_BatchManager')
      const load = window.LiteGraph!.createNode('VHS_LoadVideo')
      const sampler = window.LiteGraph!.createNode('KSampler')
      if (!batch || !load || !sampler)
        throw new Error(
          'VHS_BatchManager, VHS_LoadVideo or KSampler is missing'
        )
      batch.pos = [50, 200]
      load.pos = [400, 200]
      sampler.pos = [850, 200]
      graph.add(batch)
      graph.add(load)
      graph.add(sampler)

      const metaBatch = load.inputs.findIndex(
        ({ name }) => name === 'meta_batch'
      )
      const frameCount = load.outputs.findIndex(
        ({ name }) => name === 'frame_count'
      )
      const seed = sampler.inputs.findIndex(({ name }) => name === 'seed')
      if (metaBatch < 0 || frameCount < 0 || seed < 0)
        throw new Error('Expected VHS / KSampler slots are missing')
      batch.connect(0, load, metaBatch)
      load.connect(frameCount, sampler, seed)

      const forceRate = load.widgets?.find(({ name }) => name === 'force_rate')
      if (!forceRate) throw new Error('force_rate widget is missing')
      forceRate.value = 12

      window.app!.canvas.selectItems([batch, load, sampler])
      return {
        loadIds: [load.id],
        widgets: Object.fromEntries(
          (load.widgets ?? [])
            .filter(({ name }) => name !== 'videopreview')
            .map(({ name, value }) => [name, value])
        )
      }
    })
    expect(original.widgets.force_rate).toBe(12)

    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            window.app!.graph.nodes.filter(
              ({ type }) => type === 'VHS_LoadVideo'
            ).length
        )
      )
      .toBe(2)

    await expect(
      comfyPage.page.locator('.comfy-modal-content', {
        hasText: 'Failed to restore node'
      })
    ).toBeHidden()

    const pasted = await comfyPage.page.evaluate((originalIds) => {
      const graph = window.app!.graph
      const load = graph.nodes.find(
        ({ id, type }) => type === 'VHS_LoadVideo' && !originalIds.includes(id)
      )
      if (!load) throw new Error('Pasted VHS_LoadVideo is missing')
      const metaBatch = load.inputs.find(({ name }) => name === 'meta_batch')
      const frameCount = load.outputs.find(({ name }) => name === 'frame_count')
      return {
        bgcolor: load.bgcolor ?? null,
        widgets: Object.fromEntries(
          (load.widgets ?? [])
            .filter(({ name }) => name !== 'videopreview')
            .map(({ name, value }) => [name, value])
        ),
        metaBatchLinked: metaBatch?.link != null,
        frameCountLinks: frameCount?.links?.length ?? 0
      }
    }, original.loadIds)

    expect(pasted).toEqual({
      bgcolor: null,
      widgets: original.widgets,
      metaBatchLinked: true,
      frameCountLinks: 1
    })
  })
})
