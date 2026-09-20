import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  captureCanvasTextGeometry,
  expectDomTextGeometry
} from '@e2e/fixtures/utils/localizedTextGeometry'
import type { Locator, Page } from '@playwright/test'

async function moveTextOntoTarget(
  text: Locator,
  target: Locator,
  missingGeometryMessage: string
) {
  const targetBounds = await target.boundingBox()
  await text.evaluate(
    (element, { targetBounds, missingGeometryMessage }) => {
      if (!(element instanceof HTMLElement) || !targetBounds)
        throw new Error(missingGeometryMessage)
      const bounds = element.getBoundingClientRect()
      const scale = bounds.width / element.offsetWidth
      element.style.transform = `translate(${(targetBounds.x - bounds.x) / scale}px, ${(targetBounds.y - bounds.y) / scale}px)`
    },
    { targetBounds, missingGeometryMessage }
  )
}

async function restoreStyle(element: Locator, style: string | null) {
  await element.evaluate((element, style) => {
    if (style === null) element.removeAttribute('style')
    else element.setAttribute('style', style)
  }, style)
}

async function expectVueChineseGeometry(
  page: Page,
  labels: string[],
  portLabels: string[]
) {
  const root = page.locator('[data-node-id="3"]')
  const texts = labels.map((label) =>
    root.getByText(label, { exact: true }).first()
  )
  const portTexts = portLabels.map((label) =>
    root
      .locator('.lg-slot--input, .lg-slot--output')
      .getByText(label, { exact: true })
  )
  for (const text of [...texts, ...portTexts]) await expect(text).toBeVisible()
  await expectDomTextGeometry(texts)
  await expectDomTextGeometry(portTexts)
  await expectDomTextGeometry([...texts, ...portTexts])

  const originalStyle = await texts[2].getAttribute('style')
  await moveTextOntoTarget(texts[2], texts[1], 'Missing label geometry')
  try {
    await expect(expectDomTextGeometry(texts)).rejects.toThrow(
      'rendered label bounds must not overlap'
    )
  } finally {
    await restoreStyle(texts[2], originalStyle)
  }
  await expectDomTextGeometry(texts)

  const originalPortStyle = await portTexts[2].getAttribute('style')
  await moveTextOntoTarget(
    portTexts[2],
    portTexts[1],
    'Missing port label geometry'
  )
  try {
    await expect(expectDomTextGeometry(portTexts)).rejects.toThrow(
      'rendered label bounds must not overlap'
    )
  } finally {
    await restoreStyle(portTexts[2], originalPortStyle)
  }
  await expectDomTextGeometry(portTexts)

  const portRow = portTexts[0].locator('..')
  const originalPortRowStyle = await portRow.getAttribute('style')
  await moveTextOntoTarget(
    portRow,
    texts[1],
    'Missing cross-family label geometry'
  )
  try {
    await expectDomTextGeometry(texts)
    await expectDomTextGeometry(portTexts)
    await expect(
      expectDomTextGeometry([...texts, ...portTexts])
    ).rejects.toThrow('rendered label bounds must not overlap')
  } finally {
    await restoreStyle(portRow, originalPortRowStyle)
  }
  await expectDomTextGeometry([...texts, ...portTexts])
}

async function expectCanvasChineseGeometry(
  page: Page,
  labels: string[],
  portLabels: string[]
) {
  await captureCanvasTextGeometry(page, labels)
  await expect(captureCanvasTextGeometry(page, labels, true)).rejects.toThrow(
    'rendered label bounds must not overlap'
  )
  await captureCanvasTextGeometry(page, labels)
  await captureCanvasTextGeometry(page, portLabels, false, '3')
  await expect(
    captureCanvasTextGeometry(page, portLabels, true, '3')
  ).rejects.toThrow('rendered label bounds must not overlap')
  await captureCanvasTextGeometry(page, portLabels, false, '3')
  const combinedLabels = [
    labels[0],
    portLabels[0],
    labels[1],
    ...labels.slice(2),
    ...portLabels.slice(1)
  ]
  await captureCanvasTextGeometry(page, combinedLabels, false, '3')
  await expect(
    captureCanvasTextGeometry(page, combinedLabels, true, '3')
  ).rejects.toThrow('rendered label bounds must not overlap')
  await captureCanvasTextGeometry(page, combinedLabels, false, '3')
}

test.describe(
  'Localized workflow round trip',
  { tag: ['@workflow', '@widget'] },
  () => {
    test.describe.configure({ timeout: 120_000 })
    test.use({ actionTimeout: 15_000 })

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
      const zhPortLabels = [
        '模型',
        '正面条件',
        '负面条件',
        'Latent图像',
        'Latent'
      ]
      const enPortLabels = [
        'model',
        'positive',
        'negative',
        'latent_image',
        'LATENT'
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
              await expectVueChineseGeometry(
                comfyPage.page,
                zhLabels,
                zhPortLabels
              )
            } else {
              await expectCanvasChineseGeometry(
                comfyPage.page,
                zhLabels,
                zhPortLabels
              )
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
              const portTexts = enPortLabels.map((label) =>
                root
                  .locator('.lg-slot--input, .lg-slot--output')
                  .getByText(label, { exact: true })
              )
              for (const text of texts) {
                await expect(text).toBeVisible()
              }
              for (const text of portTexts) {
                await expect(text).toBeVisible()
              }
              await expectDomTextGeometry(texts)
              await expectDomTextGeometry(portTexts)
              await expectDomTextGeometry([...texts, ...portTexts])
            } else {
              await captureCanvasTextGeometry(comfyPage.page, enLabels)
              await captureCanvasTextGeometry(
                comfyPage.page,
                enPortLabels,
                false,
                '3'
              )
              await captureCanvasTextGeometry(
                comfyPage.page,
                [...enLabels, ...enPortLabels],
                false,
                '3'
              )
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
