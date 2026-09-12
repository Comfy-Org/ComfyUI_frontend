import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Localized workflow round trip',
  { tag: ['@workflow', '@widget'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Locale', 'en')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    })

    test('Chinese reload, edit, save, and English restore preserve geometry in both renderers', async ({
      comfyPage
    }) => {
      test.slow()
      for (const vueNodesEnabled of [false, true]) {
        await test.step(
          vueNodesEnabled ? 'Vue renderer' : 'LiteGraph renderer',
          async () => {
            await comfyPage.settings.setSetting(
              'Comfy.VueNodes.Enabled',
              vueNodesEnabled
            )
            await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

            const geometry = await comfyPage.page.evaluate(() =>
              window.app!.graph.nodes.map(({ id, pos, size }) => ({
                id,
                pos,
                size
              }))
            )

            await comfyPage.settings.setSetting('Comfy.Locale', 'zh')
            await expect(
              comfyPage.page.getByRole('button', { name: '运行', exact: true })
            ).toBeVisible()

            const node = await comfyPage.nodeOps.getNodeRefById('3')
            const seed = await node.getWidget(0)
            const oldSeed = await seed.getValue()
            if (vueNodesEnabled) {
              const seedInput = comfyPage.page
                .locator('[data-node-id="3"]')
                .getByRole('spinbutton')
                .first()
              await seedInput.fill('42')
              await seedInput.press('Enter')
              await seedInput.blur()
            } else {
              await seed.dragHorizontal(20)
            }
            await expect.poll(() => seed.getValue()).not.toBe(oldSeed)
            const editedSeed = await seed.getValue()

            await comfyPage.menu.topbar.triggerTopbarCommand(['文件', '另存为'])
            await comfyPage.menu.topbar
              .getSaveDialog()
              .fill(`locale-roundtrip-${vueNodesEnabled ? 'vue' : 'litegraph'}`)
            await comfyPage.page.keyboard.press('Enter')
            await comfyPage.workflow.waitForWorkflowIdle()
            await comfyPage.page.reload()
            await comfyPage.page.waitForFunction(
              () => window.app?.graph !== undefined
            )
            await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

            const reloadedNode = await comfyPage.nodeOps.getNodeRefById('3')
            await expect
              .poll(async () => (await reloadedNode.getWidget(0)).getValue())
              .toBe(editedSeed)

            await comfyPage.settings.setSetting('Comfy.Locale', 'en')
            await expect(
              comfyPage.page.getByRole('button', { name: 'Run', exact: true })
            ).toBeVisible()
            await expect
              .poll(() =>
                comfyPage.page.evaluate(() =>
                  window.app!.graph.nodes.map(({ id, pos, size }) => ({
                    id,
                    pos,
                    size
                  }))
                )
              )
              .toEqual(geometry)
          }
        )
      }
    })
  }
)
