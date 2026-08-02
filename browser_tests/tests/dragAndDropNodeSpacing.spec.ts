import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

interface NodeBox {
  type: string
  pos: [number, number]
  size: [number, number]
}

function boxesOverlap(a: NodeBox, b: NodeBox): boolean {
  const [ax, ay] = a.pos
  const [aw, ah] = a.size
  const [bx, by] = b.pos
  const [bw, bh] = b.size
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
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
    await test.step('drop 2 images and 1 audio file on the canvas', async () => {
      await comfyPage.dragDrop.dragAndDropFiles(
        ['test_upload_image.png', 'test_upload_image.png', 'test_audio.wav'],
        { dropPosition: { x: 500, y: 300 } }
      )
    })

    // 2x LoadImage + 1x BatchImagesNode + 1x LoadAudio
    await comfyPage.nodeOps.waitForGraphNodes(4)

    const nodes = await comfyPage.page.evaluate<NodeBox[]>(() =>
      window.app!.graph.nodes.map((node) => ({
        type: node.type ?? '',
        pos: [node.pos[0], node.pos[1]],
        size: [node.size[0], node.size[1]]
      }))
    )

    expect(nodes.map((n) => n.type).sort()).toEqual(
      ['BatchImagesNode', 'LoadAudio', 'LoadImage', 'LoadImage'].sort()
    )

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `${nodes[i].type} and ${nodes[j].type} should not overlap`
        ).toBe(false)
      }
    }
  })
})
