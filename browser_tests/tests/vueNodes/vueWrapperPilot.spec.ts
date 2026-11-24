import { readFile, writeFile } from 'node:fs/promises'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  centerOnGraph,
  measureIdle,
  measureLoad
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import { createChainWorkflow } from '@e2e/fixtures/utils/chainWorkflow'
import {
  measurePanFlicks,
  measureZoomSteps
} from '@e2e/fixtures/utils/gesturePerf'

async function captureLayout(comfyPage: ComfyPage, output: string) {
  const nodeCount = 245
  const { page, perf } = comfyPage
  await perf.init()
  try {
    const load = await measureLoad(
      comfyPage,
      'load',
      createChainWorkflow(nodeCount),
      'vue'
    )
    await comfyPage.expectNodeCount(nodeCount)
    const elements =
      (await page.locator('.lg-node[data-node-id] *').count()) + nodeCount
    await centerOnGraph(comfyPage, 0.5)
    const idle = await measureIdle(comfyPage, 'idle')
    const pan = await measurePanFlicks(comfyPage, 'pan-flicks')
    await centerOnGraph(comfyPage, 1)
    const zoom = await measureZoomSteps(comfyPage, 'zoom-steps')
    const measurements = [load, idle, pan, zoom]
    await writeFile(
      `${output}-layout.json`,
      JSON.stringify(
        {
          browser: page.context().browser()?.version(),
          viewport: page.viewportSize(),
          nodeCount,
          elements,
          measurements
        },
        null,
        2
      )
    )
    for (const m of measurements) {
      console.log(
        `Layout diagnostic: ${m.name}; ${elements} graph elements after load; ${m.layouts} layouts (${m.layoutDurationMs.toFixed(1)} ms), ${m.styleRecalcs} style recalcs (${m.styleRecalcDurationMs.toFixed(1)} ms)`
      )
    }
  } finally {
    await perf.dispose()
  }
}

test(
  'observes the default workflow for wrapper mutations',
  {
    tag: ['@vue-nodes', '@node', '@widget']
  },
  async ({ comfyPage }) => {
    const output = process.env.VUE_WRAPPER_PILOT_CAPTURE
    if (!output) throw new Error('Run pnpm audit:vue-wrapper-mutations')
    const measureLayout = process.env.VUE_WRAPPER_PILOT_LAYOUT === '1'
    if (measureLayout) test.setTimeout(180_000)

    await comfyPage.workflow.loadWorkflow('default')
    const { page } = comfyPage
    const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(sampler.body).toBeVisible()
    const modelSocket = sampler.getSlot('model')
    await expect(modelSocket).toBeVisible()
    await expect(
      sampler.root.getByTestId('widget-layout-field-label').first()
    ).toBeVisible()
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await comfyPage.nextFrame()

    const screenshot = await sampler.root.screenshot({
      path: `${output}.png`,
      animations: 'disabled',
      caret: 'hide'
    })
    const baselinePath = process.env.VUE_WRAPPER_PILOT_BASELINE
    const screenshotDifference = baselinePath
      ? await page.evaluate(
          async ([baseline, current]) => {
            async function decode(base64: string) {
              const image = new Image()
              image.src = `data:image/png;base64,${base64}`
              await image.decode()
              const canvas = new OffscreenCanvas(image.width, image.height)
              const context = canvas.getContext('2d')
              if (!context) throw new Error('Cannot compare screenshots')
              context.drawImage(image, 0, 0)
              return context.getImageData(0, 0, image.width, image.height)
            }
            const [a, b] = await Promise.all([
              decode(baseline),
              decode(current)
            ])
            if (a.width !== b.width || a.height !== b.height) return 1
            let changed = 0
            for (let i = 0; i < a.data.length; i += 4) {
              if (
                a.data
                  .slice(i, i + 4)
                  .some((channel, j) => channel !== b.data[i + j])
              )
                changed++
            }
            return changed / (a.width * a.height)
          },
          [
            await readFile(baselinePath, 'base64'),
            screenshot.toString('base64')
          ]
        )
      : 0
    const initial = {
      elements: await page
        .locator('.lg-node[data-node-id]')
        .evaluateAll((nodes) =>
          nodes.reduce(
            (count, node) => count + 1 + node.querySelectorAll('*').length,
            0
          )
        ),
      node: await sampler.boundingBox(),
      modelSocket: await modelSocket.boundingBox(),
      accessibility: await sampler.root.ariaSnapshot(),
      screenshotDifference
    }

    const label = sampler.root.getByText('model', { exact: true })
    await label.dblclick()
    await comfyPage.nextFrame()
    const editor = sampler.root
      .locator('[data-part="slot-label"]')
      .getByRole('textbox')
    const editSlot = await editor.isVisible()
    if (editSlot) await editor.press('Escape')

    const collapseButton = sampler.root.getByRole('button', {
      name: 'Collapse',
      exact: true
    })
    let collapse = false
    if (await collapseButton.isVisible()) {
      await collapseButton.focus()
      await collapseButton.press('Enter')
      await comfyPage.nextFrame()
      const collapsed = !(await sampler.body.isVisible())
      const expandButton = sampler.root.getByRole('button', {
        name: 'Expand',
        exact: true
      })
      if (collapsed && (await expandButton.isVisible())) {
        await expandButton.press('Enter')
        await comfyPage.nextFrame()
        collapse = await sampler.body.isVisible()
      }
    }
    const capture = { ...initial, editSlot, collapse }
    await writeFile(`${output}.json`, JSON.stringify(capture, null, 2))
    if (measureLayout)
      await test.step('Collect layout diagnostics', () =>
        captureLayout(comfyPage, output))
  }
)
