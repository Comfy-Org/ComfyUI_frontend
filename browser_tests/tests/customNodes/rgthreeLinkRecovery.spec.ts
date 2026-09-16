import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { hasInstalledPack } from '@e2e/fixtures/utils/customNodeSuite'

test.describe(
  'rgthree link recovery @custom-nodes',
  { tag: ['@oss', '@canvas', '@node'] },
  () => {
    if (!hasInstalledPack('rgthree-comfy')) return

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    for (const vueNodesEnabled of [false, true]) {
      const renderer = vueNodesEnabled ? 'Vue' : 'legacy'

      test(`Disconnect Links removes an rgthree boundary wire after save and reload (${renderer} renderer)`, async ({
        comfyPage,
        savedWorkflows
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()

        const registration = await comfyPage.page.evaluate(() => ({
          context: Boolean(
            window.LiteGraph!.registered_node_types['Context (rgthree)']
          ),
          contextMerge: Boolean(
            window.LiteGraph!.registered_node_types['Context Merge (rgthree)']
          )
        }))
        expect(registration).toEqual({ context: true, contextMerge: true })

        const nodes = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const source = window.LiteGraph!.createNode('Context (rgthree)')!
          const target = window.LiteGraph!.createNode(
            'Context Merge (rgthree)'
          )!
          graph.add(source)
          graph.add(target)
          source.pos = [200, 300]
          target.pos = [700, 300]
          source.connect(0, target, 0)
          graph.setDirtyCanvas(true, true)
          return { sourceId: String(source.id), targetId: String(target.id) }
        })
        await comfyPage.nextFrame()

        const source = await comfyPage.nodeOps.getNodeRefById(nodes.sourceId)
        const sourceOutput = await source.getOutput(0)
        await sourceOutput.expectLinkCount(1)
        if (vueNodesEnabled) {
          await comfyPage.vueNodes.waitForNodes()
          await comfyPage.vueNodes
            .getOutputSlotConnectionDot(nodes.sourceId, 0)
            .click({ button: 'right' })
        } else {
          const outputPosition = await sourceOutput.getPosition()
          await comfyPage.page.mouse.click(outputPosition.x, outputPosition.y, {
            button: 'right'
          })
        }
        await expect(
          comfyPage.contextMenu.litegraphContextMenu.getByText(
            'Disconnect Links',
            { exact: true }
          )
        )
          .toBeVisible()
          .catch((error: unknown) => {
            expect(error).toMatchObject({
              matcherResult: { name: 'toBeVisible', pass: false }
            })
            test.fail(
              vueNodesEnabled,
              'Vue Nodes opens the node menu instead of the rgthree output-slot menu'
            )
            throw error
          })
        await comfyPage.contextMenu.clickLitegraphMenuItem('Disconnect Links')
        await sourceOutput.expectLinkCount(0)

        const workflowName = `rgthree-disconnect-${renderer.toLowerCase()}`
        savedWorkflows.track(workflowName)
        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.workflow.reloadAndWaitForApp()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect
          .poll(() =>
            comfyPage.page.evaluate((ids) => {
              const graph = window.app!.graph
              const source = graph.nodes.find(
                (node) => String(node.id) === ids.sourceId
              )
              const target = graph.nodes.find(
                (node) => String(node.id) === ids.targetId
              )
              return {
                links: graph.links.size,
                sourceLinks: source?.outputs[0]?.links?.length ?? 0,
                targetLink: target?.inputs[0]?.link ?? null
              }
            }, nodes)
          )
          .toEqual({ links: 0, sourceLinks: 0, targetLink: null })
      })

      test(`Fix in place clears rgthree's corrupt-workflow banner and preserves the valid wire (${renderer} renderer)`, async ({
        comfyPage,
        savedWorkflows
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.loadWorkflow('links/rgthree_corrupt_link')

        const corruptLinkAlert = comfyPage.page.getByText(
          "The workflow you've loaded has corrupt linking data that may be able to be fixed.",
          { exact: true }
        )
        const fixInPlace = comfyPage.page.getByRole('link', {
          name: 'Fix in place',
          exact: true
        })
        await expect(corruptLinkAlert).toBeVisible()
        await expect(fixInPlace).toBeVisible()

        comfyPage.page.on('dialog', async (dialog) => {
          await dialog.accept()
        })
        await fixInPlace.click()
        await expect(corruptLinkAlert).toBeHidden()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const links = [...window.app!.graph.links.values()]
              return {
                rendered: links.every((link) => Boolean(link.path)),
                tuples: links.map((link) => [
                  String(link.origin_id),
                  link.origin_slot,
                  String(link.target_id),
                  link.target_slot
                ])
              }
            })
          )
          .toEqual({ rendered: true, tuples: [['5', 0, '4', 5]] })

        const workflowName = `rgthree-repaired-${renderer.toLowerCase()}`
        savedWorkflows.track(workflowName)
        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.workflow.reloadAndWaitForApp()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect(corruptLinkAlert).toHaveCount(0)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const links = [...window.app!.graph.links.values()]
              return {
                rendered: links.every((link) => Boolean(link.path)),
                tuples: links.map((link) => [
                  String(link.origin_id),
                  link.origin_slot,
                  String(link.target_id),
                  link.target_slot
                ])
              }
            })
          )
          .toEqual({ rendered: true, tuples: [['5', 0, '4', 5]] })
      })
    }
  }
)
