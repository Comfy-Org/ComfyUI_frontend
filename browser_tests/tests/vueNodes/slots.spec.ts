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
  const widgetSlot = (name: string) => ksampler.getSlot(name).locator('../..')
  const intNode = await comfyPage.nodeOps.getNodeRefByType('PrimitiveInt')
  const intOutput = page
    .locator(`[data-slot-key="${getSlotKey(intNode.id, 0, false)}"]`)
    .locator('..')

  await expect(widgetSlot('seed')).toHaveCSS('opacity', '0')

  await intOutput.hover()
  await page.mouse.down()
  const { x, y } = (await intOutput.boundingBox())!
  await page.mouse.move(x, y + 200, { steps: 5 })

  await expect(widgetSlot('seed'), 'INT widget accepts INT').toHaveCSS(
    'opacity',
    '1'
  )
  await expect(widgetSlot('steps'), 'INT widget accepts INT').toHaveCSS(
    'opacity',
    '1'
  )
  await expect(widgetSlot('cfg'), 'FLOAT widget rejects INT').toHaveCSS(
    'opacity',
    '0'
  )

  await page.mouse.up()
  await expect(widgetSlot('seed')).toHaveCSS('opacity', '0')
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
