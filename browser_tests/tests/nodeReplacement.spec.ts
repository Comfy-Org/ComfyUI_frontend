import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  mockNodeReplacements,
  mockNodeReplacementsSingle
} from '@e2e/fixtures/data/nodeReplacements'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  getSwapNodesGroup,
  setupNodeReplacement
} from '@e2e/fixtures/helpers/NodeReplacementHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const renderModes = [
  { name: 'vue nodes', vueNodesEnabled: true },
  { name: 'litegraph', vueNodesEnabled: false }
] as const

test.describe('Node replacement', { tag: ['@node', '@ui'] }, () => {
  for (const mode of renderModes) {
    test.describe(`(${mode.name})`, () => {
      test.describe('Single replacement', () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            mode.vueNodesEnabled
          )
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
            swapGroup.getByRole('button', { name: 'Replace All', exact: true })
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

          await comfyPage.canvasOps.pan({ x: -800, y: -800 })
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
          await swapGroup.getByRole('button', { name: /replace node/i }).click()
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
        })

        test('Success toast is shown after replacement', async ({
          comfyPage
        }) => {
          await getSwapNodesGroup(comfyPage.page)
            .getByRole('button', { name: /replace node/i })
            .click()

          await expect(comfyPage.visibleToasts.first()).toContainText(
            /replaced|swapped/i
          )
        })
      })

      test.describe('Same-type replacement group', () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            mode.vueNodesEnabled
          )
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
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            mode.vueNodesEnabled
          )
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
            () =>
              window.app!.graph!.getNodeById(2)?.outputs[0]?.links?.length ?? 0
          )
          expect(
            replacedNodeOutputLinkCount,
            'Replaced upscaler should still drive its downstream consumer'
          ).toBeGreaterThan(0)
        })
      })
    })
  }
})
