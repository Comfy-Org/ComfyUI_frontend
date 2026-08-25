import { expect } from '@playwright/test'

import { boxesOverlap } from '@/utils/boxesOverlap'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

interface NodeBox {
  type: string
  pos: [number, number]
  size: [number, number]
}

test.describe('Drag and drop node spacing', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(0)
  })

  test('spaces every node created from a mixed image + audio drop batch apart, regardless of file type', async ({
    comfyPage
  }) => {
    // FE-1482: dropping several files of different types in one batch used
    // to stack every created node on top of the drop point, since spacing
    // only considered nodes of the same type. Two images (which also create
    // a BatchImagesNode) plus one audio file must all land clear of each
    // other.
    const dropPosition = { x: 500, y: 300 }
    await comfyPage.dragDrop.dragAndDropFiles(
      ['test_upload_image.png', 'test_upload_image.png', 'test_audio.wav'],
      { dropPosition }
    )

    // 2x LoadImage + 1x BatchImagesNode + 1x LoadAudio
    await comfyPage.nodeOps.waitForGraphNodes(4)

    // LoadImage nodes grow once their preview image loads, and that growth
    // reaches the graph via a further DOM-measured layout sync (a
    // microtask/rAF after the image finishes loading). `toPass()` below
    // retries the geometry snapshot, but retrying alone doesn't guarantee
    // any given attempt runs after that growth has actually landed - a fast
    // first attempt can read the pre-growth ~102px height, report no
    // overlap, and pass. Wait for the real readiness boundary first: every
    // LoadImage preview has decoded, and its node height has stopped
    // changing across consecutive samples.
    let previousHeights: number[] | null = null
    await expect
      .poll(
        async () => {
          const state = await comfyPage.page.evaluate(() =>
            window
              .app!.graph.nodes.filter((node) => node.type === 'LoadImage')
              .map((node) => {
                const img = node.imgs?.[0]
                return {
                  loaded: !!img && img.complete && img.naturalWidth > 0,
                  height: node.size[1]
                }
              })
          )

          const heights = state.map((s) => s.height)
          const heightsSettled =
            previousHeights !== null &&
            heights.length === previousHeights.length &&
            heights.every((h, i) => h === previousHeights![i])
          previousHeights = heights

          return state.every((s) => s.loaded) && heightsSettled
        },
        { timeout: 10_000 }
      )
      .toBe(true)

    // Node geometry is read twice below (once for the type-set check, once
    // for pairwise overlap) and both must agree on a single, settled
    // snapshot. Wrap the snapshot and the assertions in `toPass()` so it
    // retries if anything else nudges geometry after the readiness wait
    // above.
    await expect(async () => {
      const nodes = await comfyPage.page.evaluate<NodeBox[]>(() =>
        window.app!.graph.nodes.map((node) => ({
          type: node.type ?? '',
          pos: [node.pos[0], node.pos[1]],
          size: [node.size[0], node.size[1]]
        }))
      )

      expect(nodes.map((n) => n.type).sort()).toEqual([
        'BatchImagesNode',
        'LoadAudio',
        'LoadImage',
        'LoadImage'
      ])

      // Anchor every node to the drop point, not just to each other. Every
      // node in this batch is created at the same canvas.graph_mouse
      // position (the drop point's x, in graph space) and the positioning
      // code is only ever supposed to move nodes vertically from there -
      // except BatchImagesNode, which is deliberately placed to the right
      // of the images. A pairwise-overlap-only check can't catch a node
      // that got teleported away from the drop point (e.g. to x=0): a
      // node far from everyone else overlaps nothing. Use the first
      // LoadImage as the reference since image nodes are always processed
      // first and are unaffected by the stale/zeroed-boundingRect anchor
      // bug this spec guards against.
      const dropPointX = nodes.find((n) => n.type === 'LoadImage')!.pos[0]
      for (const node of nodes) {
        if (node.type === 'BatchImagesNode') continue
        expect(
          node.pos[0],
          `${node.type} at x=${node.pos[0]} drifted away from the drop point's x=${dropPointX}`
        ).toBe(dropPointX)
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          expect(
            boxesOverlap(nodes[i], nodes[j]),
            `${nodes[i].type} and ${nodes[j].type} should not overlap`
          ).toBe(false)
        }
      }
    }).toPass({ timeout: 5000 })
  })
})
