import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

/**
 * Default workflow widget inputs as [nodeId, widgetName] tuples.
 * All widgets from the default graph are selected so the panel scrolls,
 * pushing the last widget's dropdown to the clipping boundary.
 */
const DEFAULT_INPUTS: [string, string][] = [
  ['4', 'ckpt_name'],
  ['6', 'text'],
  ['7', 'text'],
  ['5', 'width'],
  ['5', 'height'],
  ['5', 'batch_size'],
  ['3', 'seed'],
  ['3', 'steps'],
  ['3', 'cfg'],
  ['3', 'sampler_name'],
  ['3', 'scheduler'],
  ['3', 'denoise'],
  ['9', 'filename_prefix']
]

function isClippedByAnyAncestor(el: Element): boolean {
  const child = el.getBoundingClientRect()
  let parent = el.parentElement

  while (parent) {
    const overflow = getComputedStyle(parent).overflow
    if (overflow !== 'visible') {
      const p = parent.getBoundingClientRect()
      if (
        child.top < p.top ||
        child.bottom > p.bottom ||
        child.left < p.left ||
        child.right > p.right
      ) {
        return true
      }
    }
    parent = parent.parentElement
  }
  return false
}

/** Add a node to the graph by type and return its ID. */
async function addNode(page: Page, nodeType: string): Promise<string> {
  return page.evaluate((type) => {
    const node = window.app!.graph.add(
      window.LiteGraph!.createNode(type, undefined, {})
    )
    return String(node!.id)
  }, nodeType)
}

test.describe('App mode dropdown clipping', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test('Select dropdown is not clipped in app mode panel', async ({
    comfyPage
  }) => {
    const saveVideoId = await addNode(comfyPage.page, 'SaveVideo')
    await comfyPage.nextFrame()

    const inputs: [string, string][] = [
      ...DEFAULT_INPUTS,
      [saveVideoId, 'codec']
    ]
    await comfyPage.appMode.enterAppModeWithInputs(inputs)

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()

    // Scroll to bottom so the codec widget is at the clipping edge
    const widgetList = comfyPage.appMode.linearWidgets
    await widgetList.evaluate((el) =>
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    )

    // Click the codec select (combobox role with aria-label from WidgetSelectDefault)
    const codecSelect = widgetList.getByRole('combobox', { name: 'codec' })
    await codecSelect.click()

    const overlay = comfyPage.page.locator('.p-select-overlay').first()
    await expect(overlay).toBeVisible()

    await expect
      .poll(() =>
        overlay.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          )
        })
      )
      .toBe(true)

    await expect
      .poll(() => overlay.evaluate(isClippedByAnyAncestor))
      .toBe(false)
  })

  test('FormDropdown popup is not clipped in app mode panel', async ({
    comfyPage
  }) => {
    const loadImageId = await addNode(comfyPage.page, 'LoadImage')
    await comfyPage.nextFrame()

    const inputs: [string, string][] = [
      ...DEFAULT_INPUTS,
      [loadImageId, 'image']
    ]
    await comfyPage.appMode.enterAppModeWithInputs(inputs)

    await expect(comfyPage.appMode.linearWidgets).toBeVisible()

    // Scroll to bottom so the image widget is at the clipping edge
    const widgetList = comfyPage.appMode.linearWidgets
    await widgetList.evaluate((el) =>
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    )

    // Click the FormDropdown trigger button for the image widget.
    // The button emits 'select-click' which toggles the Popover.
    const imageRow = widgetList.locator(
      'div:has(> div > span:text-is("image"))'
    )
    const dropdownButton = imageRow.locator('button:has(> span)').first()
    await dropdownButton.click()

    // The Reka UI PopoverContent is teleported to <body> via PopoverPortal,
    // so it's never clipped by the app mode panel's overflow container.
    const popover = comfyPage.appMode.imagePickerPopover
    await expect(popover).toBeVisible()

    // Verify popover is outside the linear-widgets container
    // (PopoverPortal teleports it to <body>, escaping overflow: hidden)
    await expect
      .poll(() =>
        popover.evaluate((el) => {
          const panel = document.querySelector(
            '[data-testid="linear-widgets"]'
          )
          return panel ? !panel.contains(el) : true
        })
      )
      .toBe(true)

  })
})
