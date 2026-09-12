import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

type GraphSnapshot = {
  nodes: Array<{
    id: string
    position: [number, number]
    widgets: unknown[]
  }>
  links: Array<{
    originId: string
    originSlot: number
    targetId: string
    targetSlot: number
  }>
}

async function getGraphSnapshot(comfyPage: ComfyPage): Promise<GraphSnapshot> {
  return comfyPage.page.evaluate(() => ({
    nodes: window
      .app!.graph.nodes.map((node) => ({
        id: String(node.id),
        position: [node.pos[0], node.pos[1]] as [number, number],
        widgets: (node.widgets ?? []).map((widget) => widget.value)
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    links: [...window.app!.graph.links.values()]
      .map((link) => ({
        originId: String(link.origin_id),
        originSlot: link.origin_slot,
        targetId: String(link.target_id),
        targetSlot: link.target_slot
      }))
      .sort((left, right) =>
        `${left.originId}:${left.originSlot}:${left.targetId}:${left.targetSlot}`.localeCompare(
          `${right.originId}:${right.originSlot}:${right.targetId}:${right.targetSlot}`
        )
      )
  }))
}

async function marqueeNodes(comfyPage: ComfyPage, nodeIds: string[]) {
  const { from, to } = await comfyPage.page.evaluate((ids) => {
    const bounds = ids.map((id) => {
      const node = window.app!.graph.nodes.find(
        (candidate) => String(candidate.id) === id
      )!
      const [x, y, width, height] = node.getBounding()
      const start = window.app!.canvasPosToClientPos([x, y])
      const end = window.app!.canvasPosToClientPos([x + width, y + height])
      return {
        left: Math.min(start[0], end[0]),
        top: Math.min(start[1], end[1]),
        right: Math.max(start[0], end[0]),
        bottom: Math.max(start[1], end[1])
      }
    })
    return {
      from: {
        x: Math.min(...bounds.map(({ left }) => left)) - 20,
        y: Math.min(...bounds.map(({ top }) => top)) - 20
      },
      to: {
        x: Math.max(...bounds.map(({ right }) => right)) + 20,
        y: Math.max(...bounds.map(({ bottom }) => bottom)) + 20
      }
    }
  }, nodeIds)
  await comfyPage.canvasOps.dragAndDrop(from, to)
}

test.describe(
  'ECS migration: history and clipboard regression sanity',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.LeftMouseClickBehavior',
        'select'
      )
      await comfyPage.workflow.loadWorkflow('default')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test('undoes and redoes a move, then deletes only the pasted duplicate', async ({
      comfyPage
    }) => {
      const original = await comfyPage.nodeOps.getNodeRefById(3)
      const initialPosition =
        await original.getProperty<[number, number]>('pos')

      await original.dragBy({ x: 137, y: 83 })
      const movedPosition = await original.getProperty<[number, number]>('pos')
      expect(movedPosition).not.toEqual(initialPosition)

      await comfyPage.keyboard.undo()
      await expect
        .poll(() => original.getProperty<[number, number]>('pos'))
        .toEqual(initialPosition)
      await comfyPage.keyboard.redo()
      await expect
        .poll(() => original.getProperty<[number, number]>('pos'))
        .toEqual(movedPosition)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === '3'
        )!
        window.app!.canvas.selectNodes([node])
      })
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual(['3'])
      await comfyPage.clipboard.copy()
      await comfyPage.page.mouse.move(10, 10)
      await comfyPage.clipboard.paste()

      const pastedIds = await comfyPage.page.evaluate(() =>
        window
          .app!.graph.nodes.filter(
            (node) => node.type === 'KSampler' && String(node.id) !== '3'
          )
          .map((node) => String(node.id))
      )
      expect(pastedIds).toHaveLength(1)
      expect(await comfyPage.nodeOps.getSelectedNodeIds()).toEqual(pastedIds)

      await comfyPage.keyboard.delete()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
      await expect.poll(() => original.exists()).toBe(true)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            (id) =>
              window.app!.graph.nodes.some((node) => String(node.id) === id),
            pastedIds[0]
          )
        )
        .toBe(false)
    })

    test('copies two connected nodes with their internal link and widget values', async ({
      comfyPage
    }) => {
      const sourceIds = ['3', '8']
      const sourceSnapshot = await getGraphSnapshot(comfyPage)
      const sourceNodes = sourceSnapshot.nodes.filter(({ id }) =>
        sourceIds.includes(id)
      )
      const sourceLink = sourceSnapshot.links.find(
        ({ originId, targetId }) => originId === '3' && targetId === '8'
      )
      expect(sourceNodes).toHaveLength(2)
      expect(sourceLink).toEqual({
        originId: '3',
        originSlot: 0,
        targetId: '8',
        targetSlot: 0
      })

      await marqueeNodes(comfyPage, sourceIds)
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual(sourceIds)
      await comfyPage.clipboard.copy()
      await comfyPage.page.mouse.move(350, 650)
      await comfyPage.clipboard.paste()

      const pastedIds = (await comfyPage.nodeOps.getSelectedNodeIds()).map(
        String
      )
      expect(pastedIds).toHaveLength(2)
      expect(pastedIds.every((id) => !sourceIds.includes(id))).toBe(true)
      const pastedSnapshot = await getGraphSnapshot(comfyPage)
      const pastedNodes = pastedSnapshot.nodes.filter(({ id }) =>
        pastedIds.includes(id)
      )
      expect(pastedNodes.map(({ widgets }) => widgets)).toEqual(
        sourceNodes.map(({ widgets }) => widgets)
      )
      expect(
        pastedSnapshot.links.filter(
          ({ originId, targetId }) =>
            pastedIds.includes(originId) && pastedIds.includes(targetId)
        )
      ).toEqual([
        {
          originId: pastedIds[0],
          originSlot: sourceLink!.originSlot,
          targetId: pastedIds[1],
          targetSlot: sourceLink!.targetSlot
        }
      ])
    })

    for (const vueNodesEnabled of [false, true]) {
      test(`box-select drag and delete undo restores three linked nodes (${vueNodesEnabled ? 'Vue' : 'LiteGraph'})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
        const ids = ['3', '8', '9']
        const before = await getGraphSnapshot(comfyPage)
        await marqueeNodes(comfyPage, ids)
        await expect
          .poll(async () =>
            (await comfyPage.nodeOps.getSelectedNodeIds()).map(String).sort()
          )
          .toEqual(ids)

        await (
          await comfyPage.nodeOps.getNodeRefById(3)
        ).dragBy({ x: 91, y: 67 })
        const moved = await getGraphSnapshot(comfyPage)
        const firstInitial = before.nodes.find((node) => node.id === ids[0])!
        const firstTranslated = moved.nodes.find((node) => node.id === ids[0])!
        const translation = [
          firstTranslated.position[0] - firstInitial.position[0],
          firstTranslated.position[1] - firstInitial.position[1]
        ]
        expect(translation[0]).not.toBe(0)
        expect(translation[1]).not.toBe(0)
        for (const id of ids) {
          const initial = before.nodes.find((node) => node.id === id)!
          const translated = moved.nodes.find((node) => node.id === id)!
          expect(translated.position[0] - initial.position[0]).toBeCloseTo(
            translation[0],
            5
          )
          expect(translated.position[1] - initial.position[1]).toBeCloseTo(
            translation[1],
            5
          )
        }

        await comfyPage.keyboard.delete()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(4)
        await comfyPage.keyboard.undo()
        await expect.poll(() => getGraphSnapshot(comfyPage)).toEqual(moved)
        await comfyPage.keyboard.undo()
        await expect.poll(() => getGraphSnapshot(comfyPage)).toEqual(before)
      })
    }
  }
)
