import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'ECS migration: dialogs, locale and export sanity',
  { tag: ['@canvas', '@ui', '@workflow'] },
  () => {
    test.describe.configure({ timeout: 30_000 })

    test.beforeEach(async ({ context }) => {
      await context.route(
        'https://comfyanonymous.github.io/ComfyUI_examples/',
        (route) =>
          route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
      )
    })

    test('API node pricing badge follows its setting', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('partner_api_node')
      await comfyPage.vueNodes.waitForNodes(1)
      const apiNode = await comfyPage.vueNodes.getFixtureByTitle(
        'Flux 1.1 [pro] Ultra Image'
      )

      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.ShowApiPricing',
        true
      )
      await expect(apiNode.priceBadge.required).toBeVisible()

      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.ShowApiPricing',
        false
      )
      await expect(apiNode.priceBadge.required).toBeHidden()
      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.ShowApiPricing',
        true
      )
    })

    test('switches to Chinese without disrupting the graph', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
      await comfyPage.settings.setSetting('Comfy.Locale', 'zh')

      await expect(
        comfyPage.page.getByRole('button', { name: '运行', exact: true })
      ).toBeVisible()
      const nodeTitles = await comfyPage.page.evaluate(() =>
        window.app!.graph.nodes.map((node) => node.title)
      )
      expect(nodeTitles, 'node titles should remain rendered').toHaveLength(1)
      expect(nodeTitles[0]).toBeTruthy()
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)

      await comfyPage.settings.setSetting('Comfy.Locale', 'en')
      await expect(
        comfyPage.page
          .getByTestId('side-toolbar')
          .getByText('Workflows', { exact: true })
      ).toBeVisible()
    })

    test('linking and box selection work at 150 percent browser zoom', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.page.evaluate(() => {
        document.body.style.zoom = '1.5'
      })
      await comfyPage.nextFrame()

      await comfyPage.canvasOps.disconnectEdge()
      await comfyPage.canvasOps.connectEdge()
      const checkpoint = await comfyPage.nodeOps.getNodeRefByType(
        'CheckpointLoaderSimple'
      )
      await (await checkpoint.getOutput(1)).expectLinkCount(2)

      const bounds = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.graph.nodes.filter(
          (node) => node.type === 'CLIPTextEncode'
        )
        const boxes = nodes.map((node) => node.getBounding())
        const start = window.app!.canvasPosToClientPos([
          Math.min(...boxes.map(([x]) => x)) - 20,
          Math.min(...boxes.map(([, y]) => y)) - 20
        ])
        const end = window.app!.canvasPosToClientPos([
          Math.max(...boxes.map(([x, , width]) => x + width)) + 20,
          Math.max(...boxes.map(([, y, , height]) => y + height)) + 20
        ])
        return { start, end }
      })
      await comfyPage.canvasOps.dragAndDrop(
        { x: bounds.start[0] * 1.5, y: bounds.start[1] * 1.5 },
        { x: bounds.end[0] * 1.5, y: bounds.end[1] * 1.5 }
      )
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(1)
    })

    test('exports an API-format node map matching the graph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.settings.setSetting('Comfy.DevMode', true)
      const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()

      const exported = await comfyPage.workflow.getExportedWorkflow({
        api: true
      })
      const nodes = Object.values(exported)

      expect(nodes).toHaveLength(nodeCount)
      for (const node of nodes) {
        expect(node.class_type).toEqual(expect.any(String))
        expect(node.inputs).toEqual(expect.any(Object))
      }
      await comfyPage.settings.setSetting('Comfy.DevMode', false)
    })
  }
)
