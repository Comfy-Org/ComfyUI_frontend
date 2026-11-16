import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const DEFINITION_ORDER = [
  'text',
  'clip',
  'model',
  'positive',
  'negative',
  'latent_image'
]
const REORDERED = [
  'clip',
  'text',
  'model',
  'positive',
  'negative',
  'latent_image'
]

test.describe('Subgraph IO reorder', { tag: '@subgraph' }, () => {
  test('dragging an input handle reorders the definition and every instance', async ({
    comfyPage
  }) => {
    const orders = () =>
      comfyPage.page.evaluate(() => {
        const root = window.app?.rootGraph
        const definition = root?.subgraphs.values().next().value
        if (!root || !definition) throw new Error('Expected a subgraph')
        return {
          definition: definition.inputs.map(({ name }) => name),
          hosts: root.nodes.map((node) => node.inputs.map(({ name }) => name))
        }
      })
    const portOrder = () =>
      comfyPage.subgraph.inputPorts.evaluateAll((ports) =>
        ports.map((port) => port.getAttribute('aria-label'))
      )
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/shared-definition-two-hosts-promoted-text'
    )
    const hostOrder = (await orders()).hosts[0]
    const { inputPanel } = comfyPage.subgraph
    const handle = (name: string) =>
      inputPanel.getByRole('button', { name: `Reorder ${name}`, exact: true })

    await test.step('Enter the shared definition', async () => {
      await (
        await comfyPage.nodeOps.getNodeRefById('11')
      ).navigateIntoSubgraph()
      await expect.poll(portOrder).toEqual(DEFINITION_ORDER)
    })

    await test.step('Drag the first input below the second', async () => {
      await handle('text').hover()
      const clip = await handle('clip').boundingBox()
      if (!clip) throw new Error('Expected the clip handle to have layout')
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        clip.x + clip.width / 2,
        clip.y + clip.height,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()

      await expect.poll(portOrder).toEqual(REORDERED)
      const moved = hostOrder.map((name) =>
        name === 'clip' ? 'text' : name === 'text' ? 'clip' : name
      )
      expect(await orders()).toEqual({
        definition: REORDERED,
        hosts: [moved, moved]
      })
    })

    await test.step('Undo restores the original order', async () => {
      await comfyPage.keyboard.undo()
      await expect.poll(portOrder).toEqual(DEFINITION_ORDER)
    })
  })
})
