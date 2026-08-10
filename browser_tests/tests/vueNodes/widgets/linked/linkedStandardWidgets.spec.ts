import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const TARGET_NODE_TYPE = 'DevToolsLinkedStandardWidgets'
const TARGET_NODE_TITLE = 'Linked Standard Widgets'
const WIDGET_NAMES = [
  'plain_text',
  'integer',
  'number',
  'slider',
  'switch',
  'labeled_toggle',
  'select',
  'color',
  'textarea'
] as const

test.describe(
  'Linked standard Vue widgets',
  { tag: ['@vue-nodes', '@widget', '@node', '@screenshot'] },
  () => {
    test('preserves each control surface while making stale values inert', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
      await comfyPage.workflow.loadWorkflow('vueNodes/linked-standard-widgets')

      const [targetNodeRef] =
        await comfyPage.nodeOps.getNodeRefsByType(TARGET_NODE_TYPE)
      if (!targetNodeRef) throw new Error('Target DevTools node was not loaded')
      await targetNodeRef.centerOnNode()

      const targetNode = comfyPage.vueNodes
        .getNodeByTitle(TARGET_NODE_TITLE)
        .first()
      await expect(targetNode).toBeVisible()

      const statuses = targetNode.getByTestId(TestIds.widgets.linkedPlaceholder)
      const linkedContent = targetNode.getByTestId(
        TestIds.widgets.linkedContent
      )
      await expect(statuses).toHaveCount(WIDGET_NAMES.length)
      await expect(linkedContent).toHaveCount(WIDGET_NAMES.length)

      for (const name of WIDGET_NAMES) {
        await expect(
          targetNode.getByRole('status', {
            name: `${name}: Linked input`
          })
        ).toBeVisible()
      }

      for (let index = 0; index < WIDGET_NAMES.length; index++) {
        await expect(linkedContent.nth(index)).toHaveAttribute('inert', '')
        await expect(linkedContent.nth(index)).toHaveAttribute(
          'aria-hidden',
          'true'
        )
      }

      const interactive = targetNode.locator(
        `[data-testid="${TestIds.widgets.linkedContent}"]:is(input, textarea, button, [role="slider"]), ` +
          `[data-testid="${TestIds.widgets.linkedContent}"] :is(input, textarea, button, [role="slider"])`
      )
      const interactiveCount = await interactive.count()
      expect(interactiveCount).toBeGreaterThan(WIDGET_NAMES.length)

      const disabled = await interactive.evaluateAll((elements) =>
        elements.map((element) => {
          if (
            element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
          ) {
            return element.disabled
          }
          return (
            element.getAttribute('aria-disabled') === 'true' ||
            element.hasAttribute('data-disabled')
          )
        })
      )
      expect(disabled.every(Boolean)).toBe(true)

      for (let index = 0; index < interactiveCount; index++) {
        const control = interactive.nth(index)
        await expect(control).toBeHidden()
        await control.evaluate((element) => {
          if (element instanceof HTMLElement) element.focus()
        })
        expect(
          await control.evaluate(
            (element) => document.activeElement === element
          )
        ).toBe(false)
      }

      await expect(
        targetNode.getByText('STALE SELECT VALUE', { exact: true })
      ).toBeHidden()
      await expect(
        targetNode.getByText('STALE ON', { exact: true })
      ).toBeHidden()
      await expect(
        targetNode.getByText('STALE OFF', { exact: true })
      ).toBeHidden()
      await expect(
        targetNode.getByText('#22c55d', { exact: true })
      ).toBeHidden()

      const widgetRefs = await Promise.all(
        WIDGET_NAMES.map((name) => targetNodeRef.getWidgetByName(name))
      )
      const valuesBefore = await Promise.all(
        widgetRefs.map((widget) => widget.getValue())
      )

      for (let index = 0; index < WIDGET_NAMES.length; index++) {
        await statuses.nth(index).click()
      }
      await comfyPage.page.keyboard.press('Space')
      await comfyPage.page.keyboard.press('ArrowUp')
      await comfyPage.page.keyboard.press('Enter')

      for (let index = 0; index < WIDGET_NAMES.length + 2; index++) {
        await comfyPage.page.keyboard.press('Tab')
        expect(
          await targetNode.evaluate(
            (node) =>
              node.querySelector(
                '[data-testid="linked-widget-content"]:focus-within'
              ) !== null
          )
        ).toBe(false)
      }

      await expect
        .poll(() => Promise.all(widgetRefs.map((widget) => widget.getValue())))
        .toStrictEqual(valuesBefore)

      await comfyPage.nextFrame()
      await comfyPage.nextFrame()
      await expect(targetNode).toHaveScreenshot('linked-standard-widgets.png')
    })
  }
)
