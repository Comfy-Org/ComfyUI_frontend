import {
  comfyPageFixture as baseTest,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { zComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { z } from 'zod'

const zPromptRequestBody = z.object({ prompt: zComfyApiWorkflow })

const branchNodeDef: ComfyNodeDef = {
  name: 'TestBranchNode',
  display_name: 'Test Branch Node',
  description: '',
  category: 'logic',
  python_module: 'comfy_extras.nodes_logic',
  output_node: false,
  experimental: true,
  input: {
    required: {
      autogrow: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              optional: {
                branch: [
                  'COMFY_MATCHTYPE_V3',
                  {
                    lazy: true,
                    template: { template_id: 'switch', allowed_types: '*' }
                  }
                ]
              }
            },
            prefix: 'branch',
            min: 1,
            max: 10
          }
        }
      ],
      branch: ['STRING', { widgetType: 'COMFY_BRANCH_SELECTOR' }],
      branch_names: [
        'ARRAY',
        { widgetType: 'COMFY_BRANCH_INPUT_NAMES', socketless: true }
      ]
    }
  },
  output: ['COMFY_MATCHTYPE_V3'],
  output_is_list: [false],
  output_name: ['output'],
  output_matchtypes: ['switch']
}

const test = baseTest.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        objectInfo[branchNodeDef.name] = branchNodeDef
      }
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test('Branch Node', { tag: '@vue-nodes' }, async ({ comfyPage }) => {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.searchBoxV2.addNode('Test Branch Node', {
    position: { x: 700, y: 200 }
  })
  const branchNode = await comfyPage.vueNodes.getFixtureByTitle('Branch')

  const choiceWidget = branchNode.root.getByRole('combobox')
  const choiceMenu = comfyPage.page.getByTestId(
    'widget-select-default-viewport'
  )
  const options = choiceMenu.getByRole('option')
  async function withComboOptions(cb: () => Promise<void>) {
    await choiceWidget.click()
    await expect(choiceMenu).toBeVisible()

    await cb()

    await comfyPage.keyboard.press('Escape')
    await expect(choiceMenu).toBeHidden()
  }
  await withComboOptions(
    async () => await expect(options, 'nothing connected').toBeHidden()
  )

  await test.step('Connect inputs', async () => {
    await comfyPage.searchBoxV2.addNode('Load Checkpoint')
    const loadNode = await comfyPage.vueNodes.getFixtureByTitle('Load Check')
    const loadSlot = loadNode.getSlot('MODEL')
    await expect(loadSlot).toBeVisible()
    for (let i = 0; i < 3; i++)
      await loadSlot.dragTo(branchNode.getSlot(`branch${i}`))
    await withComboOptions(
      async () => await expect(options, '3 branches added').toHaveCount(3)
    )
  })

  await test.step('Rename input', async () => {
    await branchNode.root.getByText('branch0').first().dblclick()
    await branchNode.root.locator('.editable-text input').fill('H3')
    await branchNode.root.locator('.editable-text input').press('Enter')
    await withComboOptions(
      async () => await expect(options.getByText('H3')).toBeVisible()
    )
  })

  await test.step('Prompt serialization', async () => {
    await withComboOptions(async () => await options.getByText('H3').click())

    let requestBody: unknown
    await new ExecutionHelper(comfyPage).run({
      onPromptRequest: (body) => {
        requestBody = body
      }
    })
    const { prompt } = zPromptRequestBody.parse(requestBody)
    expect(Object.values(prompt)).toContainEqual(
      expect.objectContaining({
        class_type: branchNodeDef.name,
        inputs: expect.objectContaining({
          branch: 'H3',
          branch_names: { __value__: ['H3', 'branch1', 'branch2'] }
        })
      })
    )
  })

  await test.step('Remove selected input', async () => {
    await withComboOptions(
      async () => await expect(options.getByText('branch2')).toBeVisible()
    )
    const branchSlot = branchNode.getSlot(`branch2`).first()
    await branchSlot.click({ modifiers: ['Alt', 'Control'] })
    await withComboOptions(
      async () => await expect(options.getByText('branch2')).toBeHidden()
    )
  })
})
