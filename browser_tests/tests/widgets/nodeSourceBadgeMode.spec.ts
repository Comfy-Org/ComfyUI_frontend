import { expect } from '@playwright/test'

import { NodeBadgeMode } from '@/types/nodeSource'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

for (const vueEnabled of [false, true] as const) {
  const renderer = vueEnabled ? 'vue' : 'legacy'

  test.describe(
    `Node source badge Settings transitions (${renderer})`,
    { tag: ['@node', '@widget'] },
    () => {
      test.use({
        initialSettings: {
          'Comfy.VueNodes.Enabled': vueEnabled,
          'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.ShowAll
        }
      })

      test('updates core and custom-node badges immediately without reload', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('nodes/execution_error')

        const coreVueNode = vueEnabled
          ? await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
          : undefined
        const customVueNode = vueEnabled
          ? await comfyPage.vueNodes.getFixtureByTitle('Raise Error')
          : undefined

        if (!vueEnabled) {
          await comfyPage.legacyNodeBadges.install([
            { key: 'core', type: 'PreviewImage' },
            { key: 'custom', type: 'DevToolsErrorRaiseNode' }
          ])
        }

        const coreVueBadge = coreVueNode?.root.getByTestId('comfy-badge')
        const customVueBadge = customVueNode?.root.getByText('devtools', {
          exact: true
        })

        await test.step('show all source badges initially', async () => {
          if (coreVueBadge && customVueBadge) {
            await expect(coreVueBadge).toBeVisible()
            await expect(customVueBadge).toBeVisible()
          } else {
            await comfyPage.legacyNodeBadges.expectState([
              { key: 'core', text: 'nodes', visible: true },
              { key: 'custom', text: 'devtools', visible: true }
            ])
          }
        })

        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Lite Graph').click()

        await test.step('hide built-in source badges', async () => {
          await comfyPage.settingDialog.selectSetting(
            'Comfy.NodeBadge.NodeSourceBadgeMode',
            NodeBadgeMode.HideBuiltIn
          )
          if (coreVueBadge && customVueBadge) {
            await expect(coreVueBadge).toBeHidden()
            await expect(customVueBadge).toBeVisible()
          } else {
            await comfyPage.legacyNodeBadges.expectState([
              { key: 'core', text: 'nodes', visible: false },
              { key: 'custom', text: 'devtools', visible: true }
            ])
          }
        })

        await test.step('hide all source badges', async () => {
          await comfyPage.settingDialog.selectSetting(
            'Comfy.NodeBadge.NodeSourceBadgeMode',
            NodeBadgeMode.None
          )
          if (coreVueBadge && customVueBadge) {
            await expect(coreVueBadge).toBeHidden()
            await expect(customVueBadge).toBeHidden()
          } else {
            await comfyPage.legacyNodeBadges.expectState([
              { key: 'core', text: 'nodes', visible: false },
              { key: 'custom', text: 'devtools', visible: false }
            ])
          }
        })

        await test.step('restore all source badges', async () => {
          await comfyPage.settingDialog.selectSetting(
            'Comfy.NodeBadge.NodeSourceBadgeMode',
            NodeBadgeMode.ShowAll
          )
          if (coreVueBadge && customVueBadge) {
            await expect(coreVueBadge).toBeVisible()
            await expect(customVueBadge).toBeVisible()
          } else {
            await comfyPage.legacyNodeBadges.expectState([
              { key: 'core', text: 'nodes', visible: true },
              { key: 'custom', text: 'devtools', visible: true }
            ])
          }
        })
      })
    }
  )
}
