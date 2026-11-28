import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const workflow = 'primitive/legacy_primitive_nodes'
const convertOne = 'Convert to Typed Core Primitive'
const convertAll = 'Convert All Primitive Nodes to Typed Core Primitives'

test.describe(
  'Legacy Primitive node conversion',
  { tag: ['@vue-nodes', '@node', '@oss'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(workflow)
    })

    test('Converts one Primitive node from its menu and undoes it', async ({
      comfyPage
    }) => {
      const { links } = await comfyPage.workflow.getExportedWorkflow()
      const seed = comfyPage.vueNodes.getNodeLocator('10')
      await seed.click()
      await comfyPage.contextMenu.openFor(seed)
      await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
      await comfyPage.contextMenu.clickMenuItemExact(convertOne)

      await expect
        .poll(async () => {
          const exported = await comfyPage.workflow.getExportedWorkflow()
          return exported.nodes.find((node) => node.id === 10)
        })
        .toMatchObject({
          type: 'SeedNode',
          widgets_values: [123456, 'randomize']
        })
      const converted = await comfyPage.workflow.getExportedWorkflow()
      expect(converted.links).toEqual(links)

      await comfyPage.keyboard.undo()
      await expect
        .poll(async () => {
          const restored = await comfyPage.workflow.getExportedWorkflow()
          return restored.nodes.find((node) => node.id === 10)?.type
        })
        .toBe('PrimitiveNode')
    })

    test('Converts every eligible Primitive node from the canvas menu in one undo step', async ({
      comfyPage
    }) => {
      const promptValues = () =>
        comfyPage.page.evaluate(async () => {
          const { output } = await window.app!.graphToPrompt()
          const resolve = (value: unknown) => {
            if (!Array.isArray(value)) return value
            const { inputs } = output[String(value[0])]
            return inputs.value ?? inputs.seed
          }
          return Object.fromEntries(
            ['2', '3', '4'].map((id) => [
              id,
              Object.fromEntries(
                Object.entries(output[id].inputs).map(([name, value]) => [
                  name,
                  resolve(value)
                ])
              )
            ])
          )
        })
      const before = await promptValues()
      const { links } = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.canvasOps.rightClick(1150, 250)
      await expect(comfyPage.contextMenu.menuItem('Repair')).toBeVisible()
      await comfyPage.contextMenu.clickLitegraphMenuItem(convertAll)

      await expect(
        comfyPage.toast.withText(
          'Converted 4 Primitive nodes to core primitives'
        )
      ).toBeVisible()
      const converted = await comfyPage.workflow.getExportedWorkflow()
      const byId = Object.fromEntries(
        converted.nodes.map((node) => [
          node.id,
          { type: node.type, widgets_values: node.widgets_values }
        ])
      )
      expect(byId).toMatchObject({
        10: { type: 'SeedNode', widgets_values: [123456, 'randomize'] },
        11: { type: 'PrimitiveInt', widgets_values: [20, 'fixed'] },
        12: { type: 'PrimitiveFloat', widgets_values: [7.5] },
        13: { type: 'PrimitiveNode' },
        14: {
          type: 'PrimitiveStringMultiline',
          widgets_values: ['a red fox in snow']
        },
        15: { type: 'PrimitiveNode' },
        16: { type: 'PrimitiveNode' }
      })
      expect(converted.links).toEqual(links)
      expect(await promptValues()).toEqual(before)

      await comfyPage.keyboard.undo()
      await expect
        .poll(async () => {
          const restored = await comfyPage.workflow.getExportedWorkflow()
          return restored.nodes
            .filter((node) => node.type === 'PrimitiveNode')
            .map((node) => node.id)
            .sort((a, b) => Number(a) - Number(b))
        })
        .toEqual([10, 11, 12, 13, 14, 15, 16])
    })

    for (const title of ['Sampler', 'Denoise', 'Random prompt']) {
      test(`Omits the Repair action for the ${title} Primitive node`, async ({
        comfyPage
      }) => {
        const { header } = await comfyPage.vueNodes.getFixtureByTitle(title)
        await comfyPage.contextMenu.openForVueNode(header)
        await expect(comfyPage.contextMenu.menuItem('Delete')).toBeVisible()
        await expect(comfyPage.contextMenu.menuItem(convertOne)).toBeHidden()
      })
    }
  }
)
