import { expect } from '@playwright/test'

import {
  COMBO_NODE_ID,
  hostMintWidgetFormsTest as test,
  PREVIEW_NODE_ID
} from '@e2e/tests/agent/agentHostMintWidgetFormsFixture'

test.describe(
  'Agent host-minted widget forms',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('renders PreviewAny without persisted output and restores every CustomCombo option', async ({
      hostMintWidgetForms: { combo, missingWidgetReports, preview, rig }
    }) => {
      await expect(preview).toBeVisible()
      await expect(combo).toBeVisible()
      await expect(combo.getByLabel('option1', { exact: true })).toHaveValue(
        'first'
      )
      await expect(combo.getByLabel('option2', { exact: true })).toHaveValue(
        'second'
      )
      await expect(combo.getByLabel('option3', { exact: true })).toHaveValue(
        'third'
      )
      await expect(combo.getByLabel('option4', { exact: true })).toHaveValue('')
      await expect
        .poll(() => rig.widgetValue(COMBO_NODE_ID, 'choice'))
        .toBe('first')
      expect(
        rig.host.projection().nodes.find((node) => node.id === COMBO_NODE_ID)
          ?.widgets_values
      ).toEqual(['first', 0, 'first', 'second', 'third', ''])
      rig.hostSocket.send(
        rig.host.apply([
          {
            op: 'set_widget',
            node_id: COMBO_NODE_ID,
            widget: 'option3',
            value: 'host-updated'
          }
        ])
      )
      await expect(combo.getByLabel('option3', { exact: true })).toHaveValue(
        'host-updated'
      )
      await expect
        .poll(() => rig.widgetValue(PREVIEW_NODE_ID, 'preview_text'))
        .toBe('')
      expect(missingWidgetReports).toHaveLength(0)
    })
  }
)
