import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

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

function inputOrders(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const root = window.app?.rootGraph
    const definition = root?.subgraphs.values().next().value
    if (!root || !definition) throw new Error('Expected a subgraph')
    return {
      definition: definition.inputs.map(({ name }) => name),
      hosts: root.nodes
        .filter((node) => node.isSubgraphNode())
        .map((node) => node.inputs.map(({ name }) => name))
    }
  })
}

function promotedValues(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() =>
    (window.app?.rootGraph.nodes ?? [])
      .filter((node) => node.isSubgraphNode())
      .map((node) =>
        node.widgets.map((widget) => `${widget.name}=${widget.value}`)
      )
  )
}

function portLabels(ports: Locator) {
  return ports.evaluateAll((elements) =>
    elements.map((port) => port.getAttribute('aria-label'))
  )
}

async function dragHandle(
  comfyPage: ComfyPage,
  handle: Locator,
  target: Locator
) {
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Expected both handles to have layout')
  const below = to.y > from.y
  await handle.hover()
  await comfyPage.page.mouse.down()
  await comfyPage.page.mouse.move(
    to.x + to.width / 2,
    below ? to.y + to.height : to.y,
    { steps: 10 }
  )
  await comfyPage.page.mouse.up()
}

function promotedLabels(labels: Locator) {
  return labels.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent.trim())
      .filter((label) => label.startsWith('text'))
  )
}

test.describe('Subgraph IO reorder', { tag: '@subgraph' }, () => {
  test('dragging an input handle reorders the definition and every instance', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/shared-definition-two-hosts-promoted-text'
    )
    const hostOrder = (await inputOrders(comfyPage)).hosts[0]
    const { inputPanel, inputPorts } = comfyPage.subgraph
    const handle = (name: string) =>
      inputPanel.getByRole('button', { name: `Reorder ${name}`, exact: true })

    await test.step('Enter the shared definition', async () => {
      await (
        await comfyPage.nodeOps.getNodeRefById('11')
      ).navigateIntoSubgraph()
      await expect.poll(() => portLabels(inputPorts)).toEqual(DEFINITION_ORDER)
    })

    await test.step('Drag the first input below the second', async () => {
      await dragHandle(comfyPage, handle('text'), handle('clip'))

      await expect.poll(() => portLabels(inputPorts)).toEqual(REORDERED)
      const moved = hostOrder.map((name) =>
        name === 'clip' ? 'text' : name === 'text' ? 'clip' : name
      )
      expect(await inputOrders(comfyPage)).toEqual({
        definition: REORDERED,
        hosts: [moved, moved]
      })
    })

    await test.step('Undo restores the original order', async () => {
      await comfyPage.keyboard.undo()
      await expect.poll(() => portLabels(inputPorts)).toEqual(DEFINITION_ORDER)
    })
  })

  test(
    'the properties panel and the input panel follow each other',
    {
      tag: '@vue-nodes'
    },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-two-hosts-three-promoted-widgets'
      )
      const { inputPanel, inputPorts, editor } = comfyPage.subgraph
      const handle = (name: string) =>
        inputPanel.getByRole('button', { name: `Reorder ${name}`, exact: true })
      const promoted = (ports: (string | null)[]) =>
        ports.filter((name) => name?.startsWith('text'))
      const labels = editor.promotionItems.getByTestId(
        TestIds.subgraphEditor.widgetLabel
      )
      const openEditor = () =>
        editor.ensureOpen(comfyPage.vueNodes.getNodeLocator('12'))

      await test.step('Reorder in the properties panel', async () => {
        await openEditor()
        await expect
          .poll(() => promotedLabels(labels))
          .toEqual(['text', 'text_1', 'text_2'])

        await editor.dragItem(2, 0)

        await expect
          .poll(() => promotedLabels(labels))
          .toEqual(['text_2', 'text', 'text_1'])
        expect(await promotedValues(comfyPage)).toEqual([
          ['text_2=third', 'text=first', 'text_1=second'],
          ['text_2=gamma', 'text=alpha', 'text_1=beta']
        ])
      })

      await test.step('The input panel shows the same order', async () => {
        await comfyPage.menu.propertiesPanel.close()
        await fitToViewInstant(comfyPage)
        await comfyPage.vueNodes.enterSubgraph('12')
        await expect
          .poll(async () => promoted(await portLabels(inputPorts)))
          .toEqual(['text_2', 'text', 'text_1'])
      })

      await test.step('Reorder in the input panel', async () => {
        await dragHandle(comfyPage, handle('text_2'), handle('text'))
        await expect
          .poll(async () => promoted(await portLabels(inputPorts)))
          .toEqual(['text', 'text_2', 'text_1'])
      })

      await test.step('The properties panel and both hosts follow', async () => {
        await comfyPage.subgraph.exitViaBreadcrumb()
        await openEditor()
        await expect
          .poll(() => promotedLabels(labels))
          .toEqual(['text', 'text_2', 'text_1'])
        expect(await promotedValues(comfyPage)).toEqual([
          ['text=first', 'text_2=third', 'text_1=second'],
          ['text=alpha', 'text_2=gamma', 'text_1=beta']
        ])
        const { definition, hosts } = await inputOrders(comfyPage)
        expect(hosts).toEqual([definition, definition])
      })
    }
  )

  test('dragging an output handle reorders every instance and keeps its links', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-custom-combo-promoted-choice'
    )
    const outputPanel = comfyPage.page.getByTestId(
      TestIds.subgraphIo.outputPanel
    )
    const handle = (name: string) =>
      outputPanel.getByRole('button', { name: `Reorder ${name}`, exact: true })
    const outputs = () =>
      comfyPage.page.evaluate(() => {
        const root = window.app?.rootGraph
        const host = root?.nodes.find((node) => String(node.id) === '5')
        if (!root || !host?.isSubgraphNode())
          throw new Error('Expected subgraph node 5')
        return {
          definition: host.subgraph.outputs.map(({ name }) => name),
          host: host.outputs.map(({ name }) => name),
          linkedOutputs: [...root.links.values()]
            .filter((link) => link.origin_id === host.id)
            .map((link) => host.outputs[link.origin_slot]?.name)
        }
      })

    await (await comfyPage.nodeOps.getNodeRefById('5')).navigateIntoSubgraph()
    await expect
      .poll(() => portLabels(comfyPage.subgraph.outputPorts))
      .toEqual(['STRING', 'INDEX', 'INDEX_STRING'])

    await dragHandle(comfyPage, handle('STRING'), handle('INDEX'))

    await expect
      .poll(() => portLabels(comfyPage.subgraph.outputPorts))
      .toEqual(['INDEX', 'STRING', 'INDEX_STRING'])
    const order = ['INDEX', 'STRING', 'STRING_1']
    expect(await outputs()).toEqual({
      definition: order,
      host: order,
      linkedOutputs: ['STRING']
    })
  })

  test('an instance saved out of definition order loads in definition order', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-drifted-host-input-order'
    )

    const loaded = await comfyPage.page.evaluate(() => {
      const root = window.app?.rootGraph
      const host = root?.nodes.find((node) => String(node.id) === '11')
      if (!root || !host?.isSubgraphNode())
        throw new Error('Expected subgraph node 11')
      return {
        definition: host.subgraph.inputs.map(({ name }) => name),
        host: host.inputs.map(({ name }) => name),
        widgets: host.widgets.map(({ name, value }) => [name, value]),
        links: [...root.links.values()]
          .filter((link) => link.target_id === host.id)
          .map((link) => [
            root.getNodeById(link.origin_id)?.type,
            host.inputs[link.target_slot]?.name
          ])
      }
    })

    expect(loaded.host).toEqual(loaded.definition)
    expect(loaded.widgets).toEqual([
      ['text', 'first'],
      ['text_1', 'second'],
      ['text_2', 'third']
    ])
    expect(loaded.links).toEqual(
      expect.arrayContaining([
        ['CheckpointLoaderSimple', 'model'],
        ['EmptyLatentImage', 'latent_image']
      ])
    )
  })
})
