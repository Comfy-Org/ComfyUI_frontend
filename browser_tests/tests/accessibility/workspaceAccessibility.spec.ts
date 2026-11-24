import { mergeTests } from '@playwright/test'

import { accessibilityFixture } from '@e2e/fixtures/accessibilityFixture'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(comfyPageFixture, accessibilityFixture)

test.describe('Workspace accessibility', { tag: '@a11y' }, () => {
  test('graph workspace', async ({ comfyPage, accessibility }) => {
    await expect(comfyPage.canvas).toBeVisible()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 1,
      'meta-viewport': 1,
      tabindex: 1
    })
  })

  test(
    'graph workspace with Vue nodes',
    { tag: '@vue-nodes' },
    async ({ comfyPage, accessibility }) => {
      await expect(comfyPage.vueNodes.getNodeByTitle('KSampler')).toBeVisible()

      await accessibility.expectOnlyKnownViolations({
        'color-contrast': 1,
        'meta-viewport': 1,
        tabindex: 1
      })
    }
  )

  test('app mode', async ({ comfyPage, accessibility }) => {
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.canvas).toBeHidden()

    await accessibility.expectOnlyKnownViolations({
      'color-contrast': 4,
      'meta-viewport': 1
    })
  })

  test(
    'graph workspace on a mobile viewport',
    { tag: '@mobile' },
    async ({ comfyPage, accessibility }) => {
      await expect(comfyPage.canvas).toBeVisible()

      await accessibility.expectOnlyKnownViolations({
        'color-contrast': 1,
        'meta-viewport': 1,
        tabindex: 1
      })
    }
  )

  test.describe('selection toolbox', () => {
    test.use({ initialSettings: { 'Comfy.Canvas.SelectionToolbox': true } })

    test('selected node', async ({ comfyPage, accessibility }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(comfyPage.selectionToolbox).toBeVisible()

      await accessibility.expectOnlyKnownViolations({
        'color-contrast': 1,
        'meta-viewport': 1,
        tabindex: 1
      })
    })
  })

  test.describe('error overlay', () => {
    test.use({
      initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
    })

    test('workflow with missing nodes', async ({
      comfyPage,
      accessibility
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeVisible()

      await accessibility.expectOnlyKnownViolations({
        'color-contrast': 1,
        'meta-viewport': 1,
        tabindex: 1
      })
    })
  })

  test.describe('light theme', () => {
    test.use({ initialSettings: { 'Comfy.ColorPalette': 'light' } })

    test('graph workspace', async ({ comfyPage, accessibility }) => {
      await expect(comfyPage.canvas).toBeVisible()

      await accessibility.expectOnlyKnownViolations({
        'meta-viewport': 1,
        tabindex: 1
      })
    })

    test(
      'graph workspace with Vue nodes',
      { tag: '@vue-nodes' },
      async ({ comfyPage, accessibility }) => {
        await expect(
          comfyPage.vueNodes.getNodeByTitle('KSampler')
        ).toBeVisible()

        await accessibility.expectOnlyKnownViolations({
          'meta-viewport': 1,
          tabindex: 1
        })
      }
    )
  })
})
