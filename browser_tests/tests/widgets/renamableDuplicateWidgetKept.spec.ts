import { expect } from '@playwright/test'

import { test } from '@e2e/fixtures/unresolvedDuplicateWidgetFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe(
  'renamable duplicate widget name',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test('keeps the first owner and an unrelated widget when a rename is declined', async ({
      unresolvedDuplicateWidget
    }) => {
      const { node } = unresolvedDuplicateWidget
      const widgets = node.getByTestId(TestIds.widgets.widget)

      await expect(widgets).toHaveCount(3)

      await expect(unresolvedDuplicateWidget.collideNames()).resolves.toEqual([
        'alpha',
        'alpha',
        'gamma'
      ])

      await expect(widgets).toHaveCount(2)
      await expect(widgets.nth(0).locator('input').first()).toHaveValue(
        'first default'
      )
      await expect(widgets.nth(1).locator('input').first()).toHaveValue(
        'third default'
      )
      await expect(unresolvedDuplicateWidget.saveValues()).resolves.toEqual([
        'first default',
        'second default',
        'third default'
      ])
    })
  }
)
