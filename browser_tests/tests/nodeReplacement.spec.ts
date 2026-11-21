import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  mockDeprecatedNodeReplacements,
  mockDynamicInputReplacements,
  mockNodeReplacements,
  mockNodeReplacementsSingle
} from '@e2e/fixtures/data/nodeReplacements'
import {
  loadWorkflowAndOpenErrorsTab,
  openErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  getDeprecatedNodesGroup,
  getSwapNodesGroup,
  setupNodeReplacement
} from '@e2e/fixtures/helpers/NodeReplacementHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { getInputNames } from '@e2e/fixtures/utils/nodeInputLinks'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

const renderModes = [
  { name: 'vue nodes', vueNodesEnabled: true },
  { name: 'litegraph', vueNodesEnabled: false }
] as const

test.describe('Node replacement', { tag: ['@node', '@ui'] }, () => {
  test.use({
    initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
  })

  test.describe('Core equivalents', { tag: ['@vue-nodes', '@oss'] }, () => {
    const workflow = 'missing/core_equivalents'
    const replaceOne = 'Replace with Core Equivalent'
    const replaceSelection = 'Replace Eligible Selection with Core Nodes'

    test.describe('Installed nodes', () => {
      test.beforeEach(async ({ comfyPage }) => {
        const definitions = [false, true].map((multiline): ComfyNodeDef => {
          const name = multiline ? 'JWStringMultiline' : 'JWString'
          return {
            name,
            display_name: name,
            description: '',
            category: 'utils',
            output_node: false,
            python_module: 'custom_nodes.comfyui-various',
            input: { required: { text: ['STRING', { multiline }] } },
            output: ['STRING']
          }
        })
        await comfyPage.page.evaluate(async (defs) => {
          for (const def of defs)
            await window.app!.registerNodeDef(def.name, def)
        }, definitions)
        await comfyPage.workflow.loadWorkflow(workflow)
      })

      test('Replaces one installed node outside the selection and keeps its text and connection', async ({
        comfyPage
      }) => {
        const { header } =
          await comfyPage.vueNodes.getFixtureByTitle(/^JWString$/)
        await comfyPage.vueNodes.selectNodes(['2', '3'])
        await comfyPage.contextMenu.openFor(header)
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
        await comfyPage.contextMenu.clickMenuItemExact(replaceOne)

        const saved = await comfyPage.workflow.getExportedWorkflow()
        expect(saved.nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              type: 'PrimitiveString',
              widgets_values: ['A quiet forest']
            }),
            expect.objectContaining({ id: 2, type: 'JWString' })
          ])
        )
        expect(saved.links).toEqual([[1, 1, 0, 4, 0, 'STRING']])
      })

      test('Replaces only eligible selected nodes and undoes the batch in one step', async ({
        comfyPage
      }) => {
        const { header } =
          await comfyPage.vueNodes.getFixtureByTitle('Concatenate Text')
        await comfyPage.vueNodes.selectNodes(['1', '2', '4'])
        await comfyPage.contextMenu.openFor(header)
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
        await comfyPage.contextMenu.clickMenuItemExact(replaceSelection)

        const swapped = await comfyPage.workflow.getExportedWorkflow()
        expect(swapped.nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              type: 'PrimitiveString',
              widgets_values: ['A quiet forest']
            }),
            expect.objectContaining({
              id: 2,
              type: 'PrimitiveString',
              widgets_values: ['Warm afternoon light']
            }),
            expect.objectContaining({ id: 3, type: 'JWStringMultiline' }),
            expect.objectContaining({ id: 4, type: 'StringConcatenate' })
          ])
        )

        await comfyPage.keyboard.undo()
        await expect(
          comfyPage.vueNodes.getNodeByTitle(/^JWString$/)
        ).toHaveCount(2)
        await comfyPage.contextMenu.openForVueNode(header)
        await expect(
          comfyPage.contextMenu.menuItem(replaceSelection)
        ).toBeHidden()
        await expect(comfyPage.contextMenu.menuItem(replaceOne)).toBeHidden()
        await expect(comfyPage.contextMenu.menuItem('Repair')).toBeHidden()
      })
    })

    test.describe('Missing nodes', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await loadWorkflowAndOpenErrorsTab(comfyPage, workflow)
      })

      for (const { title, action, remainingType } of [
        {
          title: 'Replaces one missing type without changing the other',
          action: 'Replace Node',
          remainingType: 'JWStringMultiline'
        },
        {
          title: 'Replaces all eligible missing types',
          action: 'Replace All',
          remainingType: 'PrimitiveStringMultiline'
        }
      ]) {
        test(title, async ({ comfyPage }) => {
          const swapGroup = getSwapNodesGroup(comfyPage.page)
          await expect(swapGroup).toContainText('JWStringMultiline')
          await swapGroup
            .getByRole('button', { name: action, exact: true })
            .first()
            .click()

          const saved = await comfyPage.workflow.getExportedWorkflow()
          expect(saved.nodes).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: 1,
                type: 'PrimitiveString',
                widgets_values: ['A quiet forest']
              }),
              expect.objectContaining({
                id: 2,
                type: 'PrimitiveString',
                widgets_values: ['Warm afternoon light']
              }),
              expect.objectContaining({
                id: 3,
                type: remainingType,
                widgets_values: ['Layered hills\nSoft shadows']
              })
            ])
          )
          expect(saved.links).toEqual([[1, 1, 0, 4, 0, 'STRING']])
        })
      }
    })
  })

  test.describe('API workflow replacement', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setupNodeReplacement(comfyPage, mockNodeReplacementsSingle)
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/node_replacement_api'
      )
    })

    test('SaveImage filename substitutions survive replacing an API placeholder', async ({
      comfyPage
    }) => {
      const swapGroup = getSwapNodesGroup(comfyPage.page)
      await swapGroup.getByRole('button', { name: /replace node/i }).click()
      await expect(swapGroup).toBeHidden()

      await expect
        .poll(async () => {
          const prompt = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          return prompt['2'].inputs.filename_prefix
        })
        .toBe('replacement-7')
    })
  })

  test.describe('Dynamic input replacement', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setupNodeReplacement(comfyPage, mockDynamicInputReplacements)
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/node_replacement_dynamic'
      )
    })

    test('Replacing into Autogrow and DynamicCombo inputs keeps links and values', async ({
      comfyPage
    }) => {
      const swapGroup = getSwapNodesGroup(comfyPage.page)
      await swapGroup
        .getByRole('button', { name: 'Replace All', exact: true })
        .click()
      await expect(swapGroup).toBeHidden()

      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['2']).toMatchObject({
        class_type: 'BatchImagesNode',
        inputs: { 'images.image0': ['1', 0], 'images.image1': ['6', 0] }
      })
      await expect
        .poll(() => getInputNames(comfyPage, '2', 'images.'), {
          message: 'Autogrow should offer an empty slot after the moved links'
        })
        .toEqual(['images.image0', 'images.image1', 'images.image2'])
      expect(prompt['3']).toMatchObject({
        class_type: 'ResizeImageMaskNode',
        inputs: {
          input: ['2', 0],
          resize_type: 'scale by multiplier',
          'resize_type.multiplier': 1.5,
          scale_method: 'lanczos'
        }
      })
      expect(prompt['5']).toMatchObject({
        class_type: 'ControlNetLoader',
        inputs: { control_net_name: 't2iadapter_model.safetensors' }
      })
    })
  })

  test.describe('Deprecated node replacement', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setupNodeReplacement(comfyPage, mockDeprecatedNodeReplacements)
      await comfyPage.workflow.loadWorkflow('nodes/deprecated_image_batch')
    })

    test('Offers installed deprecated nodes for replacement without reporting an error', async ({
      comfyPage
    }) => {
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await openErrorsTab(comfyPage)

      const deprecatedGroup = getDeprecatedNodesGroup(comfyPage.page)
      await expect(deprecatedGroup).toContainText('ImageBatch')
      await deprecatedGroup
        .getByRole('button', { name: 'Replace All', exact: true })
        .click()
      await expect(deprecatedGroup).toBeHidden()

      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['2']).toMatchObject({
        class_type: 'BatchImagesNode',
        inputs: { 'images.image0': ['1', 0], 'images.image1': ['6', 0] }
      })
      expect(prompt['4']).toMatchObject({
        class_type: 'SaveImage',
        inputs: { images: ['2', 0] }
      })
    })
  })

  for (const mode of renderModes) {
    test.describe(
      `(${mode.name})`,
      { tag: mode.vueNodesEnabled ? ['@vue-nodes'] : [] },
      () => {
        test.describe('Single replacement', () => {
          test.beforeEach(async ({ comfyPage }) => {
            await setupNodeReplacement(comfyPage, mockNodeReplacementsSingle)
            await loadWorkflowAndOpenErrorsTab(
              comfyPage,
              'missing/node_replacement_simple'
            )
          })

          test('Swap Nodes group appears in errors tab for replaceable nodes', async ({
            comfyPage
          }) => {
            const swapGroup = getSwapNodesGroup(comfyPage.page)
            await expect(swapGroup).toBeVisible()
            await expect(
              swapGroup.getByTestId(TestIds.dialogs.errorGroupDisplayMessage)
            ).toHaveText(/\S/)
            await expect(swapGroup).toContainText('E2E_OldSampler')
            await expect(
              swapGroup.getByRole('button', {
                name: 'Replace All',
                exact: true
              })
            ).toBeVisible()
          })

          test('Shows direct row label and locate action for a single replacement group', async ({
            comfyPage
          }) => {
            const swapGroup = getSwapNodesGroup(comfyPage.page)
            const rowLabel = swapGroup.getByRole('button', {
              name: 'E2E_OldSampler',
              exact: true
            })

            await expect(rowLabel).toBeVisible()
            await expect(
              swapGroup.getByRole('button', {
                name: 'Locate node on canvas',
                exact: true
              })
            ).toBeVisible()
            await expect(
              swapGroup.getByTestId(TestIds.dialogs.swapNodeGroupCount)
            ).toHaveCount(0)

            await comfyPage.canvasOps.pan(
              { x: -800, y: -800 },
              { x: 200, y: 500 }
            )
            const offsetBeforeLocate = await comfyPage.canvasOps.getOffset()

            await rowLabel.click()

            await expect
              .poll(() => comfyPage.canvasOps.getOffset())
              .not.toEqual(offsetBeforeLocate)
          })

          test('Replace Node replaces a single group in-place', async ({
            comfyPage
          }) => {
            const swapGroup = getSwapNodesGroup(comfyPage.page)
            await swapGroup
              .getByRole('button', { name: /replace node/i })
              .click()
            await expect(swapGroup).toBeHidden()

            const workflow = await comfyPage.workflow.getExportedWorkflow()
            expect(
              workflow.nodes,
              'Node count should be unchanged after in-place replacement'
            ).toHaveLength(2)

            const nodeTypes = workflow.nodes.map((n) => n.type)
            expect(nodeTypes).not.toContain('E2E_OldSampler')
            expect(nodeTypes).toContain('KSampler')

            const ksampler = workflow.nodes.find((n) => n.type === 'KSampler')
            expect(
              ksampler?.id,
              'Replaced node should keep the original id'
            ).toBe(1)

            const linkFromReplacedToDecode = workflow.links?.find(
              (l) => l[1] === 1 && l[3] === 2
            )
            expect(
              linkFromReplacedToDecode,
              'Output link from replaced node to VAEDecode should be preserved'
            ).toBeDefined()
          })

          test('Widget values are preserved after replacement', async ({
            comfyPage
          }) => {
            await getSwapNodesGroup(comfyPage.page)
              .getByRole('button', { name: /replace node/i })
              .click()

            const workflow = await comfyPage.workflow.getExportedWorkflow()
            const ksampler = workflow.nodes.find((n) => n.type === 'KSampler')

            expect(ksampler?.widgets_values).toBeDefined()
            const widgetValues = ksampler!.widgets_values as unknown[]
            expect(widgetValues).toEqual([
              42,
              'randomize',
              20,
              7,
              'euler',
              'normal',
              1
            ])

            if (mode.vueNodesEnabled) {
              await expect(
                comfyPage.vueNodes.getWidgetByName('KSampler', 'denoise')
              ).toHaveValue(/^1(?:\.0+)?$/)
            }
          })

          test('Success toast is shown after replacement', async ({
            comfyPage
          }) => {
            await getSwapNodesGroup(comfyPage.page)
              .getByRole('button', { name: /replace node/i })
              .click()

            await expect(comfyPage.toast.visibleToasts.first()).toContainText(
              /replaced|swapped/i
            )
          })
        })

        test.describe('Same-type replacement group', () => {
          test.beforeEach(async ({ comfyPage }) => {
            await setupNodeReplacement(comfyPage, mockNodeReplacementsSingle)
            await loadWorkflowAndOpenErrorsTab(
              comfyPage,
              'missing/node_replacement_same_type'
            )
          })

          test('Groups same-type replacement rows behind the title disclosure', async ({
            comfyPage
          }) => {
            const swapGroup = getSwapNodesGroup(comfyPage.page)
            const countBadge = swapGroup.getByTestId(
              TestIds.dialogs.swapNodeGroupCount
            )
            const childRows = swapGroup.getByRole('listitem')
            const expandButton = swapGroup.getByRole('button', {
              name: 'Expand E2E_OldSampler',
              exact: true
            })

            await expect(expandButton).toBeVisible()
            await expect(countBadge).toHaveText('2')
            await expect(childRows).toHaveCount(0)

            await expandButton.click()
            await expect(childRows).toHaveCount(2)
            await expect(
              swapGroup.getByRole('button', {
                name: 'E2E_OldSampler',
                exact: true
              })
            ).toHaveCount(2)

            await swapGroup
              .getByRole('button', {
                name: 'Collapse E2E_OldSampler',
                exact: true
              })
              .click()
            await expect(childRows).toHaveCount(0)
          })
        })

        test.describe('Multi-type replacement', () => {
          test.beforeEach(async ({ comfyPage }) => {
            await setupNodeReplacement(comfyPage, mockNodeReplacements)
            await loadWorkflowAndOpenErrorsTab(
              comfyPage,
              'missing/node_replacement_multi'
            )
          })

          test('Replace All replaces all groups across multiple types', async ({
            comfyPage
          }) => {
            const swapGroup = getSwapNodesGroup(comfyPage.page)
            await expect(swapGroup).toBeVisible()
            await expect(swapGroup).toContainText('E2E_OldSampler')
            await expect(swapGroup).toContainText('E2E_OldUpscaler')

            await swapGroup
              .getByRole('button', { name: 'Replace All', exact: true })
              .click()
            await expect(swapGroup).toBeHidden()

            const workflow = await comfyPage.workflow.getExportedWorkflow()
            const nodeTypes = workflow.nodes.map((n) => n.type)
            expect(nodeTypes).not.toContain('E2E_OldSampler')
            expect(nodeTypes).not.toContain('E2E_OldUpscaler')
            expect(nodeTypes).toContain('KSampler')
            expect(nodeTypes).toContain('ImageScaleBy')
          })

          test('Output connections are preserved across replacement with output mapping', async ({
            comfyPage
          }) => {
            await getSwapNodesGroup(comfyPage.page)
              .getByRole('button', { name: 'Replace All', exact: true })
              .click()

            const replacedNodeOutputLinkCount = await comfyPage.page.evaluate(
              (nodeId) =>
                window.app!.graph.getNodeById(nodeId)?.outputs[0]?.links
                  ?.length ?? 0,
              toNodeId(2)
            )
            expect(
              replacedNodeOutputLinkCount,
              'Replaced upscaler should still drive its downstream consumer'
            ).toBeGreaterThan(0)
          })
        })
      }
    )
  }

  test(
    'Replacement keeps its position when enabling Vue Nodes',
    { tag: ['@vue-nodes'] },
    async ({ comfyPage }) => {
      test.slow()
      await setupNodeReplacement(comfyPage, mockNodeReplacementsSingle)
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/node_replacement_simple'
      )
      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await comfyPage.nextFrame()

      await getSwapNodesGroup(comfyPage.page)
        .getByRole('button', { name: /replace node/i })
        .click()

      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      await ksampler.dragBy({ x: 120, y: 90 })
      await comfyPage.nextFrame()
      const draggedTitlePosition = await ksampler.getTitlePosition()

      await comfyPage.menu.topbar.setVueNodesEnabled(true)

      const { header } = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await expect
        .poll(async () => {
          const box = await header.boundingBox()
          if (!box) return Number.POSITIVE_INFINITY
          return Math.max(
            Math.abs(box.x + box.width / 2 - draggedTitlePosition.x),
            Math.abs(box.y + box.height / 2 - draggedTitlePosition.y)
          )
        })
        .toBeLessThanOrEqual(2)
    }
  )
})
