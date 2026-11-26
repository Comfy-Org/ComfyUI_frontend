import { readFile } from 'node:fs/promises'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'

export async function exportWorkflowPng(comfyPage: ComfyPage) {
  const { page } = comfyPage
  const entry = (label: string) =>
    page
      .locator('.litecontextmenu .litemenu-entry')
      .filter({ hasText: new RegExp(`^${label}$`) })
  await comfyPage.canvasOps.rightClick(750, 160)
  await entry('Workflow Image').click()
  await entry('Export').click()
  const download = page.waitForEvent('download')
  await entry('png').click()
  const file = await (await download).path()
  return readFile(file)
}

export async function textAreaOf(comfyPage: ComfyPage, nodeId: NodeId) {
  if (comfyPage.isVueNodes)
    return comfyPage.vueNodes.getNodeLocator(nodeId).locator('textarea')
  const index = await comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const widget = node.widgets!.find((w) => w.name === 'text')!
    const element: unknown = Reflect.get(widget, 'inputEl')
    return element instanceof HTMLTextAreaElement
      ? [...document.querySelectorAll('textarea')].indexOf(element)
      : -1
  }, nodeId)
  expect(index, 'CLIPTextEncode text widget has a textarea').toBeGreaterThan(-1)
  return comfyPage.page.locator('textarea').nth(index)
}
