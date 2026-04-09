import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

async function panToNode(comfyPage: ComfyPage, nodeRef: NodeReference) {
  const nodePos = await nodeRef.getPosition()
  await comfyPage.page.evaluate((pos) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
    canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
    canvas.setDirty(true, true)
  }, nodePos)
  await comfyPage.nextFrame()
}

async function selectNodeWithPan(comfyPage: ComfyPage, nodeRef: NodeReference) {
  await panToNode(comfyPage, nodeRef)
  await nodeRef.click('title')
}

async function selectNodesWithPan(comfyPage: ComfyPage, nodeTitles: string[]) {
  // Select nodes using canvas.selectItems() to properly trigger all internal
  // state updates (selectedItems, selected_nodes, onSelectionChange).
  await comfyPage.page.evaluate((titles) => {
    const graph = window.app!.graph
    const canvas = window.app!.canvas
    const nodes = titles
      .map((title) =>
        graph.nodes.find((n: { title: string }) => n.title === title)
      )
      .filter((n): n is NonNullable<typeof n> => n != null)
    canvas.selectItems(nodes)
  }, nodeTitles)
  await comfyPage.nextFrame()

  // Pan to the first node so the toolbox is within the viewport
  const firstNodeRefs = await comfyPage.nodeOps.getNodeRefsByTitle(
    nodeTitles[0]
  )
  if (firstNodeRefs.length > 0) {
    await panToNode(comfyPage, firstNodeRefs[0])
  }
}

// force: true is needed because the canvas overlay (z-999) intercepts pointer events
async function openMoreOptions(comfyPage: ComfyPage) {
  await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click({ force: true })
  await comfyPage.nextFrame()

  // Wait for the context menu to appear by checking for 'Copy', which is
  // always present regardless of single or multi-node selection.
  await expect(comfyPage.page.getByText('Copy', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})

test.describe(
  'Selection Toolbox - Pin, Collapse, Adjust Size',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.nextFrame()
    })

    test('pin and unpin node via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      expect(await nodeRef.isPinned()).toBe(false)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Pin', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Unpin', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(false)
    })

    test('minimize and expand node via More Options menu', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      expect(await nodeRef.isCollapsed()).toBe(false)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Minimize Node', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Expand Node', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(false)
    })

    test('adjust size via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      const initialSize = await nodeRef.getSize()

      // Resize the node manually to be larger
      await comfyPage.page.evaluate(
        ({ id, w, h }) => {
          const node = window.app!.graph.getNodeById(id)!
          node.setSize([w + 200, h + 200])
          window.app!.canvas.setDirty(true, true)
        },
        {
          id: nodeRef.id,
          w: initialSize.width,
          h: initialSize.height
        }
      )
      await comfyPage.nextFrame()

      await expect
        .poll(async () => (await nodeRef.getSize()).width)
        .toBeGreaterThan(initialSize.width)

      const enlargedSize = await nodeRef.getSize()

      // Re-pan to the node after resizing, since the enlarged node
      // may push the toolbox outside the viewport
      await panToNode(comfyPage, nodeRef)
      await nodeRef.click('title')
      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Adjust Size', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect
        .poll(async () => (await nodeRef.getSize()).width)
        .toBeLessThan(enlargedSize.width)
    })

    test('copy via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Copy', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      // Paste the copied node
      await comfyPage.clipboard.paste()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('duplicate via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Duplicate', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('refresh button visibility reflects node refreshable state', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      // The toolbox should be visible after selecting a node
      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      // The refresh button uses v-show, so it exists in the DOM but is
      // only visible when the selected node has refreshable widgets.
      const refreshButton = comfyPage.page.getByTestId('refresh-button')
      await expect(refreshButton).toBeAttached()

      const hasRefreshableWidgets = await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node?.widgets) return false
        return node.widgets.some(
          (w: unknown) =>
            w != null &&
            typeof w === 'object' &&
            'refresh' in w &&
            typeof (w as { refresh: unknown }).refresh === 'function'
        )
      }, nodeRef.id)

      if (hasRefreshableWidgets) {
        await expect(refreshButton).toBeVisible()
      } else {
        await expect(refreshButton).not.toBeVisible()
      }
    })
  }
)

test.describe(
  'Selection Toolbox - Align and Distribute',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
    })

    test('align selected nodes to top via More Options menu', async ({
      comfyPage
    }) => {
      await selectNodesWithPan(comfyPage, ['KSampler', 'Empty Latent Image'])

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]

      const ksamplerPosBefore = await ksampler.getPosition()
      const emptyLatentPosBefore = await emptyLatent.getPosition()

      // Verify nodes start at different Y positions
      expect(ksamplerPosBefore.y).not.toBe(emptyLatentPosBefore.y)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Align Selected To', { exact: true })
        .hover()
      await expect(
        comfyPage.page.getByText('Top', { exact: true })
      ).toBeVisible()
      await comfyPage.page
        .getByText('Top', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      const ksamplerPosAfter = await ksampler.getPosition()
      const emptyLatentPosAfter = await emptyLatent.getPosition()

      // After top alignment, both nodes should share the same Y position
      expect(ksamplerPosAfter.y).toBe(emptyLatentPosAfter.y)
    })

    test('align selected nodes to left via More Options menu', async ({
      comfyPage
    }) => {
      await selectNodesWithPan(comfyPage, ['KSampler', 'Empty Latent Image'])

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]

      const ksamplerPosBefore = await ksampler.getPosition()
      const emptyLatentPosBefore = await emptyLatent.getPosition()

      expect(ksamplerPosBefore.x).not.toBe(emptyLatentPosBefore.x)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Align Selected To', { exact: true })
        .hover()
      await expect(
        comfyPage.page.getByText('Left', { exact: true })
      ).toBeVisible()
      await comfyPage.page
        .getByText('Left', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      const ksamplerPosAfter = await ksampler.getPosition()
      const emptyLatentPosAfter = await emptyLatent.getPosition()

      expect(ksamplerPosAfter.x).toBe(emptyLatentPosAfter.x)
    })

    test('distribute nodes horizontally via More Options menu', async ({
      comfyPage
    }) => {
      // Select 3 nodes for meaningful distribution
      await selectNodesWithPan(comfyPage, [
        'KSampler',
        'Empty Latent Image',
        'VAE Decode'
      ])

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]
      const vaeDecode = (
        await comfyPage.nodeOps.getNodeRefsByTitle('VAE Decode')
      )[0]

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Distribute Nodes', { exact: true })
        .hover()
      await expect(
        comfyPage.page.getByText('Horizontal', { exact: true })
      ).toBeVisible()
      await comfyPage.page
        .getByText('Horizontal', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      const posAfter = {
        ksampler: await ksampler.getPosition(),
        emptyLatent: await emptyLatent.getPosition(),
        vaeDecode: await vaeDecode.getPosition()
      }

      // After horizontal distribution, the middle node's X should be
      // between the leftmost and rightmost nodes
      const xValues = [
        posAfter.ksampler.x,
        posAfter.emptyLatent.x,
        posAfter.vaeDecode.x
      ].sort((a, b) => a - b)
      expect(xValues[1]).toBeGreaterThanOrEqual(xValues[0])
      expect(xValues[1]).toBeLessThanOrEqual(xValues[2])
    })

    test('distribute nodes vertically via More Options menu', async ({
      comfyPage
    }) => {
      await selectNodesWithPan(comfyPage, [
        'KSampler',
        'Empty Latent Image',
        'VAE Decode'
      ])

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]
      const vaeDecode = (
        await comfyPage.nodeOps.getNodeRefsByTitle('VAE Decode')
      )[0]

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Distribute Nodes', { exact: true })
        .hover()
      await expect(
        comfyPage.page.getByText('Vertical', { exact: true })
      ).toBeVisible()
      await comfyPage.page
        .getByText('Vertical', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      const posAfter = {
        ksampler: await ksampler.getPosition(),
        emptyLatent: await emptyLatent.getPosition(),
        vaeDecode: await vaeDecode.getPosition()
      }

      // After vertical distribution, the middle node's Y should be
      // between the topmost and bottommost nodes
      const yValues = [
        posAfter.ksampler.y,
        posAfter.emptyLatent.y,
        posAfter.vaeDecode.y
      ].sort((a, b) => a - b)
      expect(yValues[1]).toBeGreaterThanOrEqual(yValues[0])
      expect(yValues[1]).toBeLessThanOrEqual(yValues[2])
    })

    test('alignment options not shown for single node selection', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      await openMoreOptions(comfyPage)

      // Align and Distribute should not appear for single-node selection
      await expect(
        comfyPage.page.getByText('Align Selected To', { exact: true })
      ).not.toBeVisible()
      await expect(
        comfyPage.page.getByText('Distribute Nodes', { exact: true })
      ).not.toBeVisible()
    })
  }
)

test.describe(
  'Selection Toolbox - Bypass with Multiple Nodes',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
    })

    test('bypass button toggles bypass on multiple selected nodes', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
      await comfyPage.nextFrame()

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]

      expect(await ksampler.isBypassed()).toBe(false)
      expect(await emptyLatent.isBypassed()).toBe(false)

      const bypassButton = comfyPage.page.getByTestId('bypass-button')
      await expect(bypassButton).toBeVisible()
      await bypassButton.click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => ksampler.isBypassed()).toBe(true)
      await expect.poll(() => emptyLatent.isBypassed()).toBe(true)

      // Toggle back
      await bypassButton.click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => ksampler.isBypassed()).toBe(false)
      await expect.poll(() => emptyLatent.isBypassed()).toBe(false)
    })
  }
)
