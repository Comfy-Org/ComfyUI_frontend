import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { Locator, Page } from '@playwright/test'

const zhLabels = ['K采样器', '种子', '步数', '采样器名称', '调度器', '降噪']
const enLabels = [
  'KSampler',
  'seed',
  'steps',
  'sampler_name',
  'scheduler',
  'denoise'
]

async function expectDomTextGeometry(text: Locator) {
  const geometry = await text.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const textBounds = range.getBoundingClientRect()
    const rowBounds = element.parentElement!.getBoundingClientRect()
    return {
      text: textBounds.toJSON(),
      row: rowBounds.toJSON()
    }
  })
  expect(geometry.text.width).toBeGreaterThan(0)
  expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.row.left)
  expect(geometry.text.right).toBeLessThanOrEqual(geometry.row.right)
  expect(geometry.text.top).toBeGreaterThanOrEqual(geometry.row.top)
  expect(geometry.text.bottom).toBeLessThanOrEqual(geometry.row.bottom)

  const narrowedRowRight = geometry.text.left + geometry.text.width / 2
  expect(
    geometry.text.right > narrowedRowRight,
    'negative control must detect a causally narrowed text row'
  ).toBe(true)
}

async function captureCanvasTextGeometry(page: Page, expected: string[]) {
  const captures = await page.evaluate(async (labels) => {
    const contextPrototype = CanvasRenderingContext2D.prototype
    const original = contextPrototype.fillText
    const draws: Array<{
      text: string
      left: number
      right: number
      top: number
      bottom: number
    }> = []
    contextPrototype.fillText = function (text, x, y, maxWidth) {
      const value = text
      if (labels.includes(value)) {
        const metrics = this.measureText(value)
        const point = this.getTransform().transformPoint({ x, y })
        draws.push({
          text: value,
          left: point.x - metrics.actualBoundingBoxLeft,
          right: point.x + metrics.actualBoundingBoxRight,
          top: point.y - metrics.actualBoundingBoxAscent,
          bottom: point.y + metrics.actualBoundingBoxDescent
        })
      }
      if (maxWidth === undefined) original.call(this, text, x, y)
      else original.call(this, text, x, y, maxWidth)
    }
    try {
      window.app!.graph.setDirtyCanvas(true, true)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
    } finally {
      contextPrototype.fillText = original
    }
    return draws
  }, expected)

  const draws = expected.flatMap((label) => {
    const capture = captures.find(({ text }) => text === label)
    return capture ? [capture] : []
  })
  for (const label of expected) {
    expect(
      draws.some(({ text }) => text === label),
      `${label} was drawn`
    ).toBe(true)
  }
  const overlaps = draws.some((draw, index) =>
    draws
      .slice(index + 1)
      .some(
        (other) =>
          draw.left < other.right &&
          draw.right > other.left &&
          draw.top < other.bottom &&
          draw.bottom > other.top
      )
  )
  expect(overlaps, 'canvas text draw bounds must not overlap').toBe(false)
  const clippedControl = { ...draws[0], right: draws[0].left + 1 }
  expect(
    draws[0].right > clippedControl.right,
    'negative control must detect a causally clipped draw bound'
  ).toBe(true)
}

test.describe(
  'Localized workflow round trip',
  { tag: ['@workflow', '@widget'] },
  () => {
    test.describe.configure({ timeout: 120_000 })

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
              for (const label of zhLabels) {
                const text = root.getByText(label, { exact: true }).first()
                await expect(text).toBeVisible()
                await expectDomTextGeometry(text)
              }
            } else {
              await captureCanvasTextGeometry(comfyPage.page, zhLabels)
            }
            await comfyPage.page.screenshot({
              path: `/tmp/locale-roundtrip-${vueNodesEnabled ? 'vue' : 'litegraph'}-zh.png`
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

            await comfyPage.settings.setSetting('Comfy.Locale', 'en')
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
              for (const label of enLabels) {
                const text = root.getByText(label, { exact: true }).first()
                await expect(text).toBeVisible()
                await expectDomTextGeometry(text)
              }
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
