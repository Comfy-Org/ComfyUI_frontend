import { expect } from '@playwright/test'

import { NodeBadgeMode } from '@/types/nodeSource'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const CORE_NODE_TITLE = 'Preview Image'
const CUSTOM_NODE_TITLE = 'Raise Error'
const CUSTOM_SOURCE_BADGE = 'devtools'

for (const vueEnabled of [false, true] as const) {
  const renderer = vueEnabled ? 'vue' : 'legacy'

  test.describe(
    `Node source badge Settings transitions (${renderer})`,
    { tag: ['@node', '@widget'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueEnabled
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.ShowAll
        )
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          NodeBadgeMode.HideBuiltIn
        )
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      })

      test('updates core and custom-node badges immediately without reload', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('nodes/execution_error')

        const coreVueNode = vueEnabled
          ? await comfyPage.vueNodes.getFixtureByTitle(CORE_NODE_TITLE)
          : undefined
        const customVueNode = vueEnabled
          ? await comfyPage.vueNodes.getFixtureByTitle(CUSTOM_NODE_TITLE)
          : undefined

        if (!vueEnabled) {
          await comfyPage.page.evaluate(() => {
            const probe = document.createElement('output')
            probe.id = 'legacy-source-badge-draw-probe'
            probe.hidden = true
            document.body.append(probe)

            for (const node of window.app!.graph.nodes) {
              const drawBadges = node.drawBadges
              node.drawBadges = function (ctx, options) {
                const texts: string[] = []
                const fillText = ctx.fillText
                ctx.fillText = function (text, ...args) {
                  fillText.call(this, text, ...args)
                  texts.push(text)
                }
                try {
                  drawBadges.call(this, ctx, options)
                  if (node.type === 'PreviewImage') {
                    probe.dataset.coreTexts = JSON.stringify(texts)
                  }
                  if (node.type === 'DevToolsErrorRaiseNode') {
                    probe.dataset.customTexts = JSON.stringify(texts)
                  }
                  probe.dataset.frames = String(
                    Number(probe.dataset.frames ?? '0') + 1
                  )
                } finally {
                  ctx.fillText = fillText
                }
              }
            }
            window.app!.graph.setDirtyCanvas(true, true)
          })
        }

        const legacyProbe = comfyPage.page.locator(
          '#legacy-source-badge-draw-probe'
        )
        const coreVueBadge = coreVueNode?.root.getByTestId('comfy-badge')
        const customVueBadge = customVueNode?.root.getByText(
          CUSTOM_SOURCE_BADGE,
          { exact: true }
        )

        const expectLegacyBadges = async (
          coreVisible: boolean,
          customVisible: boolean
        ) => {
          const frame = Number(
            (await legacyProbe.getAttribute('data-frames')) ?? '0'
          )
          await comfyPage.page.evaluate(() =>
            window.app!.graph.setDirtyCanvas(true, true)
          )
          await expect
            .poll(async () =>
              Number(await legacyProbe.getAttribute('data-frames'))
            )
            .toBeGreaterThan(frame)
          const getCoreTexts = async () => {
            const texts = JSON.parse(
              (await legacyProbe.getAttribute('data-core-texts')) ?? '[]'
            ) as string[]
            return texts
          }
          if (coreVisible) {
            await expect.poll(getCoreTexts).toContain('nodes')
          } else {
            await expect.poll(getCoreTexts).not.toContain('nodes')
          }
          await expect
            .poll(async () => {
              const texts = JSON.parse(
                (await legacyProbe.getAttribute('data-custom-texts')) ?? '[]'
              ) as string[]
              return texts.some((text) => text.includes(CUSTOM_SOURCE_BADGE))
            })
            .toBe(customVisible)
        }

        const chooseMode = async (mode: NodeBadgeMode) => {
          const select = comfyPage.settingDialog.root
            .locator('[data-setting-id="Comfy.NodeBadge.NodeSourceBadgeMode"]')
            .getByRole('combobox')
          await select.click()
          await comfyPage.page
            .getByRole('option', { name: mode, exact: true })
            .click()
          await expect
            .poll(() =>
              comfyPage.settings.getSetting(
                'Comfy.NodeBadge.NodeSourceBadgeMode'
              )
            )
            .toBe(mode)
        }

        if (vueEnabled) {
          await expect(coreVueBadge!).toBeVisible()
          await expect(customVueBadge!).toBeVisible()
        } else {
          await expectLegacyBadges(true, true)
        }

        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Lite Graph').click()
        await chooseMode(NodeBadgeMode.HideBuiltIn)

        if (vueEnabled) {
          await expect(coreVueBadge!).toBeHidden()
          await expect(customVueBadge!).toBeVisible()
        } else {
          await expectLegacyBadges(false, true)
        }

        await chooseMode(NodeBadgeMode.None)

        if (vueEnabled) {
          await expect(coreVueBadge!).toBeHidden()
          await expect(customVueBadge!).toBeHidden()
        } else {
          await expectLegacyBadges(false, false)
        }

        await chooseMode(NodeBadgeMode.ShowAll)

        if (vueEnabled) {
          await expect(coreVueBadge!).toBeVisible()
          await expect(customVueBadge!).toBeVisible()
        } else {
          await expectLegacyBadges(true, true)
        }
      })
    }
  )
}
