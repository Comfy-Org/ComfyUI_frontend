import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

type ComfyPage = Parameters<Parameters<typeof test>[2]>[0]['comfyPage']

async function setVueMode(comfyPage: ComfyPage, enabled: boolean) {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', enabled)
  if (enabled) {
    await comfyPage.vueNodes.waitForNodes()
  }
}

async function addGhostAtCenter(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

  const viewport = comfyPage.page.viewportSize()!
  const centerX = Math.round(viewport.width / 2)
  const centerY = Math.round(viewport.height / 2)

  await comfyPage.page.mouse.move(centerX, centerY)
  await comfyPage.nextFrame()

  const nodeRef = await comfyPage.nodeOps.addNode(
    'VAEDecode',
    { ghost: true },
    { x: centerX, y: centerY }
  )
  await comfyPage.nextFrame()

  return { nodeId: nodeRef.id, centerX, centerY }
}

function getNodeById(comfyPage: ComfyPage, nodeId: number | string) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) return null
    return { ghost: !!node.flags.ghost }
  }, nodeId)
}

for (const mode of ['litegraph', 'vue'] as const) {
  test.describe(`Ghost node placement (${mode} mode)`, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setVueMode(comfyPage, mode === 'vue')
    })

    test('positions ghost node at cursor', async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

      const viewport = comfyPage.page.viewportSize()!
      const centerX = Math.round(viewport.width / 2)
      const centerY = Math.round(viewport.height / 2)

      await comfyPage.page.mouse.move(centerX, centerY)
      await comfyPage.nextFrame()

      const result = await comfyPage.page.evaluate(
        ([clientX, clientY]) => {
          const node = window.LiteGraph!.createNode('VAEDecode')!
          const event = new MouseEvent('click', { clientX, clientY })
          window.app!.graph.add(node, { ghost: true, dragEvent: event })

          const canvas = window.app!.canvas
          const rect = canvas.canvas.getBoundingClientRect()
          const cursorCanvasX =
            (clientX - rect.left) / canvas.ds.scale - canvas.ds.offset[0]
          const cursorCanvasY =
            (clientY - rect.top) / canvas.ds.scale - canvas.ds.offset[1]

          return {
            diffX: node.pos[0] + node.size[0] / 2 - cursorCanvasX,
            diffY: node.pos[1] - 10 - cursorCanvasY
          }
        },
        [centerX, centerY] as const
      )

      expect(Math.abs(result.diffX)).toBeLessThan(5)
      expect(Math.abs(result.diffY)).toBeLessThan(5)
    })

    test('left-click confirms ghost placement', async ({ comfyPage }) => {
      const { nodeId, centerX, centerY } = await addGhostAtCenter(comfyPage)

      const before = await getNodeById(comfyPage, nodeId)
      expect(before).not.toBeNull()
      expect(before!.ghost).toBe(true)

      await comfyPage.page.mouse.click(centerX, centerY)
      await comfyPage.nextFrame()

      const after = await getNodeById(comfyPage, nodeId)
      expect(after).not.toBeNull()
      expect(after!.ghost).toBe(false)
    })

    test('Escape cancels ghost placement', async ({ comfyPage }) => {
      const { nodeId } = await addGhostAtCenter(comfyPage)

      const before = await getNodeById(comfyPage, nodeId)
      expect(before).not.toBeNull()
      expect(before!.ghost).toBe(true)

      await comfyPage.keyboard.press('Escape')

      const after = await getNodeById(comfyPage, nodeId)
      expect(after).toBeNull()
    })

    test('Delete cancels ghost placement', async ({ comfyPage }) => {
      const { nodeId } = await addGhostAtCenter(comfyPage)

      const before = await getNodeById(comfyPage, nodeId)
      expect(before).not.toBeNull()
      expect(before!.ghost).toBe(true)

      await comfyPage.keyboard.press('Delete')

      const after = await getNodeById(comfyPage, nodeId)
      expect(after).toBeNull()
    })

    test('Backspace cancels ghost placement', async ({ comfyPage }) => {
      const { nodeId } = await addGhostAtCenter(comfyPage)

      const before = await getNodeById(comfyPage, nodeId)
      expect(before).not.toBeNull()
      expect(before!.ghost).toBe(true)

      await comfyPage.keyboard.press('Backspace')

      const after = await getNodeById(comfyPage, nodeId)
      expect(after).toBeNull()
    })

    test('right-click cancels ghost placement', async ({ comfyPage }) => {
      const { nodeId, centerX, centerY } = await addGhostAtCenter(comfyPage)

      const before = await getNodeById(comfyPage, nodeId)
      expect(before).not.toBeNull()
      expect(before!.ghost).toBe(true)

      await comfyPage.page.mouse.click(centerX, centerY, { button: 'right' })
      await comfyPage.nextFrame()

      const after = await getNodeById(comfyPage, nodeId)
      expect(after).toBeNull()
    })

    test('moving ghost onto existing node and clicking places correctly', async ({
      comfyPage
    }) => {
      // Get existing KSampler node from the default workflow
      const [ksamplerRef] =
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      const ksamplerPos = await ksamplerRef.getPosition()
      const ksamplerSize = await ksamplerRef.getSize()
      const targetX = Math.round(ksamplerPos.x + ksamplerSize.width / 2)
      const targetY = Math.round(ksamplerPos.y + ksamplerSize.height / 2)

      // Start ghost placement away from the existing node
      const startX = 50
      const startY = 50
      await comfyPage.page.mouse.move(startX, startY, { steps: 20 })
      await comfyPage.nextFrame()

      const ghostRef = await comfyPage.nodeOps.addNode(
        'VAEDecode',
        { ghost: true },
        { x: startX, y: startY }
      )
      await comfyPage.nextFrame()

      // Move ghost onto the existing node
      await comfyPage.page.mouse.move(targetX, targetY, { steps: 20 })
      await comfyPage.nextFrame()

      // Click to finalize — on top of the existing node
      await comfyPage.page.mouse.click(targetX, targetY)
      await comfyPage.nextFrame()

      // Ghost should be placed (no longer ghost)
      const ghostResult = await getNodeById(comfyPage, ghostRef.id)
      expect(ghostResult).not.toBeNull()
      expect(ghostResult!.ghost).toBe(false)

      // Ghost node should have moved from its start position toward where we clicked
      const ghostPos = await ghostRef.getPosition()
      expect(
        Math.abs(ghostPos.x - startX) > 20 || Math.abs(ghostPos.y - startY) > 20
      ).toBe(true)

      // Existing node should NOT be selected
      const selectedIds = await comfyPage.nodeOps.getSelectedNodeIds()
      expect(selectedIds).not.toContain(ksamplerRef.id)
    })

    test(
      'subgraph blueprint added from search box enters ghost mode',
      { tag: ['@subgraph'] },
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting(
          'Comfy.NodeSearchBoxImpl',
          'default'
        )
        await comfyPage.searchBoxV2.reload(comfyPage)

        // Convert a node to a subgraph and publish it as a blueprint
        const nodeRef = await comfyPage.nodeOps.getNodeRefById('3')
        await nodeRef.click('title')
        await comfyPage.nextFrame()
        await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')
        await comfyPage.nextFrame()
        await comfyPage.nextFrame()
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
        expect(subgraphNodes).toHaveLength(1)
        const subgraphNode = subgraphNodes[0]

        const blueprintName = `ghost-test-${Date.now()}`
        await subgraphNode.click('title')
        await comfyPage.command.executeCommand('Comfy.PublishSubgraph', {
          name: blueprintName
        })
        await expect(comfyPage.visibleToasts).toHaveCount(1, { timeout: 5000 })
        await comfyPage.toast.closeToasts(1)

        const nodeCountBefore = await comfyPage.nodeOps.getGraphNodesCount()

        // Open v2 search box and search for the published blueprint
        await comfyPage.canvasOps.doubleClick()
        const { searchBoxV2 } = comfyPage
        await expect(searchBoxV2.input).toBeVisible()

        await searchBoxV2.input.fill(blueprintName)
        await expect(searchBoxV2.results.first()).toBeVisible()

        // Click the result to add the node (v2 search box uses ghost mode)
        await searchBoxV2.results.first().click()
        await comfyPage.nextFrame()

        // A new node should exist on the graph in ghost mode
        const nodeCountAfter = await comfyPage.nodeOps.getGraphNodesCount()
        expect(nodeCountAfter).toBe(nodeCountBefore + 1)

        const ghostNodeId = await comfyPage.page.evaluate(() => {
          return window.app!.canvas.state.ghostNodeId
        })
        expect(ghostNodeId).not.toBeNull()

        const ghostState = await getNodeById(comfyPage, ghostNodeId!)
        expect(ghostState).not.toBeNull()
        expect(ghostState!.ghost).toBe(true)

        // Wait for search box to close, then click to confirm placement
        await expect(searchBoxV2.input).toBeHidden()
        await comfyPage.nextFrame()
        const viewport = comfyPage.page.viewportSize()!
        await comfyPage.page.mouse.click(
          Math.round(viewport.width / 2),
          Math.round(viewport.height / 2)
        )
        await comfyPage.nextFrame()

        const afterPlace = await getNodeById(comfyPage, ghostNodeId!)
        expect(afterPlace).not.toBeNull()
        expect(afterPlace!.ghost).toBe(false)
      }
    )
  })
}
