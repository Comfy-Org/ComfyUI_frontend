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
  { tag: ['@vue-nodes', '@widget', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
      await comfyPage.workflow.loadWorkflow('vueNodes/linked-standard-widgets')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test(
      'renders each linked control surface',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const [targetNodeRef] =
          await comfyPage.nodeOps.getNodeRefsByType(TARGET_NODE_TYPE)
        if (!targetNodeRef)
          throw new Error('Target DevTools node was not loaded')
        await targetNodeRef.centerOnNode()

        const targetNode = comfyPage.vueNodes
          .getNodeByTitle(TARGET_NODE_TITLE)
          .first()
        await expect(targetNode).toBeVisible()

        const statuses = targetNode.getByTestId(
          TestIds.widgets.linkedPlaceholder
        )
        await expect(statuses).toHaveCount(WIDGET_NAMES.length)

        for (const name of WIDGET_NAMES) {
          await expect(
            targetNode.getByRole('img', {
              name: `${name}: Linked input`
            })
          ).toBeVisible()
        }

        await comfyPage.nextFrame()
        await comfyPage.nextFrame()
        await expect(targetNode).toHaveScreenshot('linked-standard-widgets.png')
      }
    )

    test('keeps linked controls inaccessible to focus', async ({
      comfyPage
    }) => {
      const targetNode = comfyPage.vueNodes
        .getNodeByTitle(TARGET_NODE_TITLE)
        .first()
      await expect(targetNode).toBeVisible()

      const linkedContent = targetNode.getByTestId(
        TestIds.widgets.linkedContent
      )
      await expect(linkedContent).toHaveCount(WIDGET_NAMES.length)

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

      const controlStates = await interactive.evaluateAll((elements) =>
        elements.map((element) => {
          const disabled =
            element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
              ? element.disabled
              : element.getAttribute('aria-disabled') === 'true' ||
                element.hasAttribute('data-disabled')

          if (element instanceof HTMLElement) element.focus()

          return {
            disabled,
            focused: document.activeElement === element
          }
        })
      )
      expect(controlStates.every(({ disabled }) => disabled)).toBe(true)
      expect(controlStates.every(({ focused }) => !focused)).toBe(true)

      for (let index = 0; index < interactiveCount; index++) {
        await expect(interactive.nth(index)).toBeHidden()
      }
    })

    test('ignores pointer input on linked controls', async ({ comfyPage }) => {
      const [targetNodeRef] =
        await comfyPage.nodeOps.getNodeRefsByType(TARGET_NODE_TYPE)
      if (!targetNodeRef) throw new Error('Target DevTools node was not loaded')

      const targetNode = comfyPage.vueNodes
        .getNodeByTitle(TARGET_NODE_TITLE)
        .first()
      await expect(targetNode).toBeVisible()

      for (const text of [
        'STALE SELECT VALUE',
        'STALE ON',
        'STALE OFF',
        '#22c55d'
      ]) {
        const staleValue = targetNode.getByText(text, { exact: true })
        await expect(staleValue).toBeAttached()
        await expect(staleValue).toBeHidden()
      }

      const widgetRefs = await Promise.all(
        WIDGET_NAMES.map((name) => targetNodeRef.getWidgetByName(name))
      )
      const valuesBefore = await Promise.all(
        widgetRefs.map((widget) => widget.getValue())
      )

      await targetNode
        .getByRole('img', { name: 'switch: Linked input' })
        .click()

      await targetNode
        .getByRole('img', { name: 'select: Linked input' })
        .click()

      await targetNode
        .getByRole('img', { name: 'textarea: Linked input' })
        .click()

      await comfyPage.nextFrame()
      await expect
        .poll(() => Promise.all(widgetRefs.map((widget) => widget.getValue())))
        .toStrictEqual(valuesBefore)
    })
  }
)
