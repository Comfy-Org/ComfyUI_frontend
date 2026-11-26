import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import type { Rgb } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  addPackNode,
  legacyWidgetPoint,
  nodeValue,
  nodeGeometry
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export const SET_NAME = 'model_x'

export async function addNamedSetNode(comfyPage: ComfyPage) {
  const loaderId = await addPackNode(
    comfyPage,
    'CheckpointLoaderSimple',
    [40, 100]
  )
  const setId = await addPackNode(comfyPage, 'SetNode', [420, 100])
  await comfyPage.page.evaluate(
    ({ loaderId, setId, name }) => {
      const graph = window.app!.graph
      const loader = graph.getNodeById(loaderId)!
      const setNode = graph.getNodeById(setId)!
      loader.connect(0, setNode, 0)
      const constant = setNode.widgets![0]
      constant.value = name
      constant.callback?.(name)
    },
    { loaderId, setId, name: SET_NAME }
  )
  await expect
    .poll(() => nodeValue(comfyPage, setId, ['inputs', '0', 'type']))
    .toBe('MODEL')
  return setId
}

export async function pickGetConstant(comfyPage: ComfyPage, getId: NodeId) {
  if (comfyPage.isVueNodes) {
    await new WidgetSelectDefaultFixture(
      comfyPage.vueNodes.getNodeLocator(getId),
      'Constant'
    ).selectOption(SET_NAME)
    return
  }
  const {
    size: [width]
  } = await nodeGeometry(comfyPage, getId)
  const combo = await legacyWidgetPoint(
    comfyPage,
    getId,
    'Constant',
    width / 2,
    10
  )
  await comfyPage.page.mouse.click(combo.x, combo.y)
  await comfyPage.page
    .locator('.litecontextmenu .litemenu-entry', { hasText: SET_NAME })
    .click()
}

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Link colour ${hex} is not #rrggbb`)
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16)
  ]
}

export async function editorCanvasCentre(comfyPage: ComfyPage, nodeId: NodeId) {
  const target = await comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const canvas = node
      .widgets!.map((widget) =>
        'element' in widget && widget.element instanceof HTMLElement
          ? widget.element.querySelector('canvas')
          : null
      )
      .find((element) => element !== null)
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = rect.x + rect.width * 0.6
    const y = rect.y + rect.height * 0.3
    return { x, y, hitsEditor: document.elementFromPoint(x, y) === canvas }
  }, nodeId)
  expect(target, 'editor canvas is in the page').not.toBeNull()
  expect(target!.hitsEditor, 'nothing covers the editor canvas').toBe(true)
  return { x: target!.x, y: target!.y }
}

export async function shiftClick(
  comfyPage: ComfyPage,
  at: { x: number; y: number }
) {
  const { keyboard, mouse } = comfyPage.page
  await mouse.move(at.x, at.y)
  await keyboard.down('Shift')
  await mouse.down()
  await mouse.up()
  await keyboard.up('Shift')
}

export async function pointsStore(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<unknown> {
  const raw = await comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.find((widget) => widget.name === 'points_store')!.value,
    nodeId
  )
  return JSON.parse(String(raw))
}

export async function helpButtonCentre(comfyPage: ComfyPage, nodeId: NodeId) {
  const button = comfyPage.vueNodes
    .getNodeLocator(nodeId)
    .locator('.kj-help-btn')
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  if (!box) throw new Error('help button has no box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
