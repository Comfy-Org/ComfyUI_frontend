import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
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
