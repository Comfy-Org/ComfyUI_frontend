import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test(
      'PromptChain visible reorder and saved connections survive reload (Vue renderer)',
      { tag: ['@vue-nodes'] },
      async ({ comfyPage, packPersistence, savedWorkflows }) => {
        test.slow()
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await comfyPage.nodeOps.clearGraph()

        const workflowName = `actual-promptchain-vue-${crypto.randomUUID()}`
        savedWorkflows.track(workflowName)
        const ids = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const makeNode = (
            title: string,
            promptValue: string,
            modeValue: string
          ) => {
            const node = window.LiteGraph!.createNode(
              'PromptChain_PromptChain'
            )!
            node.title = title
            graph.add(node)
            node.widgets!.find((widget) => widget.name === 'prompt')!.value =
              promptValue
            node.widgets!.find((widget) => widget.name === 'mode')!.value =
              modeValue
            return node
          }
          const root = makeNode('Chain Root', 'SETUP root prompt', 'combine')
          const children = [
            makeNode('Chain Alpha', 'SETUP alpha prompt', 'switch'),
            makeNode('Chain Beta', 'SETUP beta prompt', 'iterate'),
            makeNode('Chain Gamma', 'SETUP gamma prompt', 'combine')
          ]
          for (const child of children) {
            const targetSlot = root.inputs.findIndex(
              (input) => input.name.includes('in_') && input.link == null
            )
            child.connect(0, root, targetSlot)
          }
          return {
            root: String(root.id),
            children: children.map((node) => String(node.id))
          }
        })

        const inputLinks = () => packPersistence.projectInputLinks(ids.root)
        const initialLinks = [
          [ids.children[0], 0, ids.root, 0],
          [ids.children[1], 0, ids.root, 1],
          [ids.children[2], 0, ids.root, 2]
        ]
        await expect.poll(inputLinks).toEqual(initialLinks)

        const onboardingSkip = comfyPage.page.getByText('Skip', {
          exact: true
        })
        if (await onboardingSkip.isVisible()) await onboardingSkip.click()
        const rootNode = comfyPage.page.locator(`[data-node-id="${ids.root}"]`)
        await rootNode.getByTitle('Fullscreen editor').click()
        const tree = comfyPage.page.locator('.pcr-nettree-items')
        const visibleOrder = () =>
          tree.locator('.pcr-nettree-name').allTextContents()
        await expect
          .poll(visibleOrder)
          .toEqual(['Chain Root', 'Chain Alpha', 'Chain Beta', 'Chain Gamma'])

        const alpha = tree
          .locator('.pcr-nettree-row')
          .filter({ hasText: 'Chain Alpha' })
        const gamma = tree
          .locator('.pcr-nettree-row')
          .filter({ hasText: 'Chain Gamma' })
        await alpha.dragTo(gamma, { targetPosition: { x: 40, y: 24 } })
        await expect
          .poll(visibleOrder)
          .toEqual(['Chain Root', 'Chain Beta', 'Chain Gamma', 'Chain Alpha'])
        await expect.poll(inputLinks).toEqual([
          [ids.children[1], 0, ids.root, 0],
          [ids.children[2], 0, ids.root, 1],
          [ids.children[0], 0, ids.root, 2]
        ])
        await comfyPage.page.getByTitle('Close (Escape)').click()

        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.workflow.reloadAndWaitForApp()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect.poll(inputLinks).toEqual([
          [ids.children[1], 0, ids.root, 0],
          [ids.children[2], 0, ids.root, 1],
          [ids.children[0], 0, ids.root, 2]
        ])
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (nodeIds) => {
                return nodeIds.map((nodeId) => {
                  const node = window.app!.graph.nodes.find(
                    (candidate) => String(candidate.id) === nodeId
                  )!
                  return {
                    title: node.title,
                    type: node.type,
                    widgets: node
                      .widgets!.filter(
                        (widget) =>
                          widget.name === 'prompt' || widget.name === 'mode'
                      )
                      .map((widget) => ({
                        name: widget.name,
                        value: widget.value
                      }))
                  }
                })
              },
              [ids.root, ...ids.children]
            )
          )
          .toEqual([
            {
              title: 'Prompt Chain',
              type: 'PromptChain_PromptChain',
              widgets: [
                { name: 'prompt', value: 'SETUP root prompt' },
                { name: 'mode', value: 'combine' }
              ]
            },
            {
              title: 'Prompt Chain',
              type: 'PromptChain_PromptChain',
              widgets: [
                { name: 'prompt', value: 'SETUP alpha prompt' },
                { name: 'mode', value: 'switch' }
              ]
            },
            {
              title: 'Prompt Chain',
              type: 'PromptChain_PromptChain',
              widgets: [
                { name: 'prompt', value: 'SETUP beta prompt' },
                { name: 'mode', value: 'iterate' }
              ]
            },
            {
              title: 'Prompt Chain',
              type: 'PromptChain_PromptChain',
              widgets: [
                { name: 'prompt', value: 'SETUP gamma prompt' },
                { name: 'mode', value: 'combine' }
              ]
            }
          ])
      }
    )
  }
)
