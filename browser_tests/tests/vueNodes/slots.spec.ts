import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'

test('Dragging a typed output reveals compatible widget input slots @vue-nodes', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow(
    'primitive/static_primitive_unconnected'
  )
  const { page } = comfyPage
  const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
  const intNode = await comfyPage.nodeOps.getNodeRefByType('PrimitiveInt')
  const intOutput = page
    .locator(`[data-slot-key="${getSlotKey(intNode.id, 0, false)}"]`)
    .locator('..')

  await expect(ksampler.getWidgetSlotContainer('seed')).toHaveCSS(
    'opacity',
    '0'
  )

  await intOutput.hover()
  await page.mouse.down()
  const { x, y } = (await intOutput.boundingBox())!
  await page.mouse.move(x, y + 200, { steps: 5 })

  await expect(
    ksampler.getWidgetSlotContainer('seed'),
    'INT widget accepts INT'
  ).toHaveCSS('opacity', '1')
  await expect(
    ksampler.getWidgetSlotContainer('steps'),
    'INT widget accepts INT'
  ).toHaveCSS('opacity', '1')
  await expect(
    ksampler.getWidgetSlotContainer('cfg'),
    'FLOAT widget rejects INT'
  ).toHaveCSS('opacity', '0')

  await page.mouse.up()
  await expect(ksampler.getWidgetSlotContainer('seed')).toHaveCSS(
    'opacity',
    '0'
  )
})

test('Moving an existing link off an input reveals compatible widget input slots @vue-nodes', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow(
    'primitive/static_primitive_unconnected'
  )
  const { page } = comfyPage
  const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
  const intNode = await comfyPage.nodeOps.getNodeRefByType('PrimitiveInt')
  const seedSlot = ksampler.getSlot('seed')
  await page
    .locator(`[data-slot-key="${getSlotKey(intNode.id, 0, false)}"]`)
    .locator('..')
    .dragTo(seedSlot)
  await expect
    .poll(() => comfyPage.vueNodes.isSlotConnected(seedSlot))
    .toBe(true)

  await seedSlot.hover()
  await page.mouse.down()
  const { x, y } = (await seedSlot.boundingBox())!
  await page.mouse.move(x - 50, y + 250, { steps: 5 })

  await expect(
    ksampler.getWidgetSlotContainer('steps'),
    'INT widget accepts the moved INT link'
  ).toHaveCSS('opacity', '1')
  await expect(
    ksampler.getWidgetSlotContainer('cfg'),
    'FLOAT widget rejects the moved INT link'
  ).toHaveCSS('opacity', '0')

  await page.mouse.up()
  await expect(ksampler.getWidgetSlotContainer('steps')).toHaveCSS(
    'opacity',
    '0'
  )
})

test('Dragging from a subgraph input reveals compatible widget input slots @vue-nodes @subgraph', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
  await comfyPage.vueNodes.enterSubgraph('2')
  const { page, subgraph } = comfyPage
  const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
  const seedSlot = ksampler.getSlot('seed')
  await seedSlot.dragTo(subgraph.addInputSocket)
  await expect
    .poll(() => comfyPage.vueNodes.isSlotConnected(seedSlot))
    .toBe(true)
  await ksampler.title.hover()

  const { x, y } = await (await subgraph.getInputSlot('seed')).getPosition()
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 40, y + 250, { steps: 5 })

  await expect(
    ksampler.getWidgetSlotContainer('steps'),
    'INT widget accepts INT from the subgraph input'
  ).toHaveCSS('opacity', '1')
  await expect(
    ksampler.getWidgetSlotContainer('cfg'),
    'FLOAT widget rejects INT from the subgraph input'
  ).toHaveCSS('opacity', '0')

  await page.mouse.up()
  await expect(ksampler.getWidgetSlotContainer('steps')).toHaveCSS(
    'opacity',
    '0'
  )
})

test('A node added mid-drag reveals its compatible widget input slots @vue-nodes', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow(
    'primitive/static_primitive_unconnected'
  )
  const { page } = comfyPage
  const intNode = await comfyPage.nodeOps.getNodeRefByType('PrimitiveInt')
  const intOutput = page
    .locator(`[data-slot-key="${getSlotKey(intNode.id, 0, false)}"]`)
    .locator('..')
  await intOutput.hover()
  await page.mouse.down()
  const { x, y } = (await intOutput.boundingBox())!
  await page.mouse.move(x, y + 200, { steps: 5 })

  const added = await comfyPage.nodeOps.addNode('KSampler', undefined, {
    x: 600,
    y: 500
  })
  const addedSampler = new VueNodeFixture(
    comfyPage.vueNodes.getNodeLocator(String(added.id))
  )

  await expect(
    addedSampler.getWidgetSlotContainer('steps'),
    'INT widget on the added node accepts INT'
  ).toHaveCSS('opacity', '1')
  await expect(
    addedSampler.getWidgetSlotContainer('cfg'),
    'FLOAT widget on the added node rejects INT'
  ).toHaveCSS('opacity', '0')

  await page.mouse.up()
  await expect(addedSampler.getWidgetSlotContainer('steps')).toHaveCSS(
    'opacity',
    '0'
  )
})

function addNodeToCurrentGraph(
  page: Page,
  type: string,
  pos: [number, number]
) {
  return page.evaluate(
    ([nodeType, nodePos]) => {
      const node = window.LiteGraph!.createNode(nodeType)!
      node.pos = nodePos
      window.app!.canvas.graph!.add(node)
      return node.id
    },
    [type, pos] as const
  )
}

const slotWrapper = (page: Page, key: string) =>
  page.locator(`.lg-slot:has([data-slot-key="${key}"])`)

test('A node added mid-drag while dragging from an input marks its compatible outputs @vue-nodes', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow(
    'primitive/static_primitive_unconnected'
  )
  const { page } = comfyPage
  const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
  const stepsSlot = ksampler.getSlot('steps')
  await stepsSlot.hover()
  await page.mouse.down()
  const { x, y } = (await stepsSlot.boundingBox())!
  await page.mouse.move(x - 50, y + 250, { steps: 5 })

  const intId = await addNodeToCurrentGraph(page, 'PrimitiveInt', [700, 300])
  const floatId = await addNodeToCurrentGraph(
    page,
    'PrimitiveFloat',
    [700, 450]
  )
  const intOutput = slotWrapper(page, getSlotKey(intId, 0, false))
  const floatOutput = slotWrapper(page, getSlotKey(floatId, 0, false))

  await expect(intOutput).toBeVisible()
  await expect(
    intOutput,
    'INT output on the added node accepts the INT input drag'
  ).not.toHaveClass(/opacity-40/)
  await expect(
    floatOutput,
    'FLOAT output on the added node rejects the INT input drag'
  ).toHaveClass(/opacity-40/)

  await page.mouse.up()
})

test('A node added mid-drag inside a subgraph marks its compatible inputs @vue-nodes @subgraph', async ({
  comfyPage
}) => {
  await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
  await comfyPage.vueNodes.enterSubgraph('2')
  const { page } = comfyPage
  const vaeId = await page.evaluate(
    () =>
      window.app!.canvas.graph!.nodes.find((n) => n.type === 'VAEEncode')!.id
  )
  const vaeOutput = page
    .locator(`[data-slot-key="${getSlotKey(vaeId, 0, false)}"]`)
    .locator('..')
  await vaeOutput.hover()
  await page.mouse.down()
  const { x, y } = (await vaeOutput.boundingBox())!
  await page.mouse.move(x + 60, y + 120, { steps: 5 })

  const addedId = await addNodeToCurrentGraph(page, 'KSampler', [150, 300])
  const inputIndex = (name: string) =>
    page.evaluate(
      ([id, inputName]) =>
        window
          .app!.canvas.graph!.getNodeById(id)!
          .inputs.findIndex((input) => input.name === inputName),
      [addedId, name] as const
    )
  const latentInput = slotWrapper(
    page,
    getSlotKey(addedId, await inputIndex('latent_image'), true)
  )
  const modelInput = slotWrapper(
    page,
    getSlotKey(addedId, await inputIndex('model'), true)
  )

  await expect(
    latentInput,
    'LATENT input on the added node accepts LATENT'
  ).toHaveClass(/lg-slot--compatible/)
  await expect(
    modelInput,
    'MODEL input on the added node rejects LATENT'
  ).toHaveClass(/opacity-40/)

  await page.mouse.up()
})

test('A node pasted mid-drag marks inputs its paste config creates @vue-nodes', async ({
  comfyPage
}) => {
  const { page } = comfyPage
  await comfyPage.nodeOps.clearGraph()
  const source = await comfyPage.nodeOps.addNode('EmptyImage', undefined, {
    x: 100,
    y: 100
  })
  const feeder = await comfyPage.nodeOps.addNode('EmptyImage', undefined, {
    x: 100,
    y: 500
  })
  const batch = await comfyPage.nodeOps.addNode('BatchImagesNode', undefined, {
    x: 500,
    y: 500
  })
  for (const inputSlot of [1, 2, 3, 4]) {
    await page.evaluate(
      ([feederId, batchId, slot]) => {
        const graph = window.app!.canvas.graph!
        graph
          .getNodeById(feederId)!
          .connect(0, graph.getNodeById(batchId), slot)
      },
      [feeder.id, batch.id, inputSlot] as const
    )
    await comfyPage.nextFrame()
  }
  await page.evaluate(
    ([feederId, batchId]) => {
      const canvas = window.app!.canvas
      const graph = canvas.graph!
      canvas.selectItems([
        graph.getNodeById(feederId)!,
        graph.getNodeById(batchId)!
      ])
    },
    [feeder.id, batch.id] as const
  )
  await comfyPage.clipboard.copy()
  const existingIds = await page.evaluate(() =>
    window.app!.canvas.graph!.nodes.map((n) => n.id)
  )

  const sourceOutput = page
    .locator(`[data-slot-key="${getSlotKey(source.id, 0, false)}"]`)
    .locator('..')
  await sourceOutput.hover()
  await page.mouse.down()
  const { x, y } = (await sourceOutput.boundingBox())!
  await page.mouse.move(x + 300, y + 100, { steps: 5 })
  await page.keyboard.press('Control+v')

  const pastedId = await page.evaluate(
    (previous) =>
      window.app!.canvas.graph!.nodes.find(
        (n) => n.type === 'BatchImagesNode' && !previous.includes(n.id)
      )!.id,
    existingIds
  )
  const lastGrownIndex = await page.evaluate(
    (id) =>
      window
        .app!.canvas.graph!.getNodeById(id)!
        .inputs.findIndex((input) => input.name === 'images.image4'),
    pastedId
  )
  const lastGrownInput = slotWrapper(
    page,
    getSlotKey(pastedId, lastGrownIndex, true)
  )

  await expect(lastGrownInput).toBeVisible()
  await expect(
    lastGrownInput,
    'IMAGE input created by the paste config accepts IMAGE'
  ).not.toHaveClass(/opacity-40/)

  await page.mouse.up()
})

test('MatchType updates output color @vue-nodes', async ({ comfyPage }) => {
  await comfyPage.menu.topbar.newWorkflowButton.click()
  await comfyPage.nextFrame()

  await comfyPage.searchBoxV2.addNode('Load Image')
  const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
  await comfyPage.searchBoxV2.addNode('Switch', {
    position: { x: 600, y: 200 }
  })
  const switchNode = await comfyPage.vueNodes.getFixtureByTitle('switch')

  await loadImage.getSlot('MASK').dragTo(switchNode.getSlot('on_false'))
  const slotEl = switchNode.getSlot('output').locator('.slot-dot')
  await expect.poll(() => slotEl.getAttribute('style')).toContain('MASK')
})
