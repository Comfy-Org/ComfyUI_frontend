import { expect } from '@playwright/test'

import { NodeBadgeMode } from '@/types/nodeSource'
import { test } from '@e2e/fixtures/legacyNodeBadgeFixture'

const CORE_NODE_TITLE = 'Preview Image'
const CUSTOM_NODE_TITLE = 'Raise Error'
const CORE_BADGE_TEXT = 'nodes'
const CUSTOM_BADGE_TEXT = 'devtools'

test.use({
  initialSettings: {
    'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.ShowAll
  }
})

test.describe(
  'Node source badge Settings transitions (Vue)',
  { tag: ['@node', '@widget', '@vue-nodes'] },
  () => {
    test('updates core and custom-node badges immediately without reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/execution_error')

      const coreNode =
        await comfyPage.vueNodes.getFixtureByTitle(CORE_NODE_TITLE)
      const customNode =
        await comfyPage.vueNodes.getFixtureByTitle(CUSTOM_NODE_TITLE)
      const coreBadge = coreNode.root.getByTestId('comfy-badge')
      const customBadge = customNode.root.getByText(CUSTOM_BADGE_TEXT, {
        exact: true
      })

      await test.step('show all source badges initially', async () => {
        await expect(coreBadge).toBeVisible()
        await expect(customBadge).toBeVisible()
      })

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Lite Graph').click()

      await test.step('hide built-in source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.HideBuiltIn
        )
        await expect(coreBadge).toBeHidden()
        await expect(customBadge).toBeVisible()
      })

      await test.step('hide all source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.None
        )
        await expect(coreBadge).toBeHidden()
        await expect(customBadge).toBeHidden()
      })

      await test.step('restore all source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.ShowAll
        )
        await expect(coreBadge).toBeVisible()
        await expect(customBadge).toBeVisible()
      })
    })
  }
)

test.describe(
  'Node source badge Settings transitions (legacy)',
  { tag: ['@node', '@widget'] },
  () => {
    test('updates core and custom-node badges immediately without reload', async ({
      comfyPage,
      legacyNodeBadges
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/execution_error')
      await legacyNodeBadges.install([
        { key: 'core', type: 'PreviewImage' },
        { key: 'custom', type: 'DevToolsErrorRaiseNode' }
      ])

      await test.step('show all source badges initially', async () => {
        await legacyNodeBadges.expectState([
          { key: 'core', text: CORE_BADGE_TEXT, visible: true },
          { key: 'custom', text: CUSTOM_BADGE_TEXT, visible: true }
        ])
      })

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Lite Graph').click()

      await test.step('hide built-in source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.HideBuiltIn
        )
        await legacyNodeBadges.expectState([
          { key: 'core', text: CORE_BADGE_TEXT, visible: false },
          { key: 'custom', text: CUSTOM_BADGE_TEXT, visible: true }
        ])
      })

      await test.step('hide all source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.None
        )
        await legacyNodeBadges.expectState([
          { key: 'core', text: CORE_BADGE_TEXT, visible: false },
          { key: 'custom', text: CUSTOM_BADGE_TEXT, visible: false }
        ])
      })

      await test.step('restore all source badges', async () => {
        await comfyPage.settingDialog.selectSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.ShowAll
        )
        await legacyNodeBadges.expectState([
          { key: 'core', text: CORE_BADGE_TEXT, visible: true },
          { key: 'custom', text: CUSTOM_BADGE_TEXT, visible: true }
        ])
      })
    })
  }
)
