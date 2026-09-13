import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  captureCanvasTextGeometry,
  expectDomTextGeometry
} from '@e2e/fixtures/utils/localizedTextGeometry'

test.describe(
  'Localized workflow round trip',
  { tag: ['@workflow', '@widget'] },
  () => {
    test.describe.configure({ timeout: 120_000 })
    test.use({ actionTimeout: 15_000 })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Locale', 'en')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    })

    test('Chinese reload, edit, save, and English restore preserve geometry in both renderers', async ({
      comfyPage
    }) => {
      const zhLabels = [
        'K采样器',
        '种子',
        '步数',
        '采样器名称',
        '调度器',
        '降噪'
      ]
      const enLabels = [
        'KSampler',
        'seed',
        'steps',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
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

            await comfyPage.settingDialog.selectLocale('zh')
            await comfyPage.page.reload()
            await comfyPage.page.waitForFunction(
              () => window.app?.graph !== undefined
            )
            await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
            await (await comfyPage.nodeOps.getNodeRefById('3')).centerOnNode()
            await expect(
              comfyPage.page.getByRole('button', { name: '运行', exact: true })
            ).toBeVisible()

            if (vueNodesEnabled) {
              const root = comfyPage.page.locator('[data-node-id="3"]')
              const texts = zhLabels.map((label) =>
                root.getByText(label, { exact: true }).first()
              )
              for (const text of texts) {
                await expect(text).toBeVisible()
              }
              await expectDomTextGeometry(texts)
              const originalStyle = await texts[2].getAttribute('style')
              const target = await texts[1].boundingBox()
              await texts[2].evaluate((element, target) => {
                if (!(element instanceof HTMLElement) || !target)
                  throw new Error('Missing label geometry')
                const bounds = element.getBoundingClientRect()
                const scale = bounds.width / element.offsetWidth
                element.style.transform = `translate(${(target.x - bounds.x) / scale}px, ${(target.y - bounds.y) / scale}px)`
              }, target)
              try {
                await expect(expectDomTextGeometry(texts)).rejects.toThrow(
                  'rendered label bounds must not overlap'
                )
              } finally {
                await texts[2].evaluate((element, style) => {
                  if (style === null) element.removeAttribute('style')
                  else element.setAttribute('style', style)
                }, originalStyle)
              }
              await expectDomTextGeometry(texts)
            } else {
              await captureCanvasTextGeometry(comfyPage.page, zhLabels)
              await expect(
                captureCanvasTextGeometry(comfyPage.page, zhLabels, true)
              ).rejects.toThrow('rendered label bounds must not overlap')
              await captureCanvasTextGeometry(comfyPage.page, zhLabels)
            }
            await comfyPage.page.screenshot({
              path: test
                .info()
                .outputPath(
                  `locale-roundtrip-${vueNodesEnabled ? 'vue' : 'litegraph'}-zh.png`
                )
            })

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
            await expect(
              comfyPage.page.getByRole('button', { name: '运行', exact: true })
            ).toBeVisible()

            await comfyPage.settingDialog.selectLocale('en')
            await comfyPage.page.reload()
            await comfyPage.page.waitForFunction(
              () => window.app?.graph !== undefined
            )
            await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
            await (await comfyPage.nodeOps.getNodeRefById('3')).centerOnNode()
            await expect(
              comfyPage.page.getByRole('button', { name: 'Run', exact: true })
            ).toBeVisible()
            if (vueNodesEnabled) {
              const root = comfyPage.page.locator('[data-node-id="3"]')
              const texts = enLabels.map((label) =>
                root.getByText(label, { exact: true }).first()
              )
              for (const text of texts) {
                await expect(text).toBeVisible()
              }
              await expectDomTextGeometry(texts)
            } else {
              await captureCanvasTextGeometry(comfyPage.page, enLabels)
            }
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
