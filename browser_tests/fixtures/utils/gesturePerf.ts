import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { findCenterNodeGrip } from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import { nodeGraphPosition } from '@e2e/fixtures/utils/nodeGraphPosition'

const GESTURES = 8
const PAUSE_MS = 600
const STEP_GAP_MS = 60
const FLICK_NOTCHES = 4
const NOTCH_DELTA = 100
const PAN_FLICK_STEPS = 4
const PAN_FLICK_DISTANCE = 30
const NUDGE_STEPS = 4
const NUDGE_DISTANCE = 12
const EMPTY_MARGIN = 80

function wait(comfyPage: ComfyPage, ms: number) {
  return comfyPage.page.evaluate(
    (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    ms
  )
}

async function canvasCenter(comfyPage: ComfyPage) {
  const box = await comfyPage.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not available')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function readView(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const { ds, zoom_speed } = window.app!.canvas
    return {
      scale: ds.scale,
      x: ds.offset[0],
      y: ds.offset[1],
      zoomSpeed: zoom_speed
    }
  })
}

function selectedCount(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => window.app!.canvas.selectedItems.size)
}

function expectEachStep(values: number[], size: number, digits: number) {
  const steps = values
    .slice(1)
    .map((value, index) => Math.abs(value - values[index]))
  for (const step of steps) expect(step).toBeCloseTo(size, digits)
}

function expectEachZoom(scales: number[], zoomSpeed: number, notches: number) {
  expectEachStep(scales.map(Math.log), notches * Math.log(zoomSpeed), 5)
}

async function findEmptyPoint(comfyPage: ComfyPage) {
  const point = await comfyPage.page.evaluate((margin) => {
    const canvas = window.app!.canvas
    const graph = window.app!.graph
    const rect = canvas.canvas.getBoundingClientRect()
    const isEmpty = (x: number, y: number) =>
      [-margin, 0, margin].every((dx) =>
        [-margin, 0, margin].every((dy) => {
          const [graphX, graphY] = canvas.ds.convertCanvasToOffset([
            x + dx - rect.left,
            y + dy - rect.top
          ])
          return !graph.getNodeOnPos(graphX, graphY)
        })
      )
    for (let y = rect.top + rect.height / 2; y < rect.bottom - 200; y += 20) {
      for (let x = rect.left + rect.width / 2; x < rect.right - 400; x += 20) {
        if (isEmpty(x, y)) return { x, y }
      }
    }
    return null
  }, EMPTY_MARGIN)
  if (!point) throw new Error('No empty canvas point in view')
  return point
}

export async function measureZoomFlicks(comfyPage: ComfyPage, name: string) {
  const { mouse } = comfyPage.page
  const center = await canvasCenter(comfyPage)
  await mouse.move(center.x, center.y)
  const start = await readView(comfyPage)
  const scales = [start.scale]

  await comfyPage.perf.startMeasuring()
  for (let flick = 0; flick < GESTURES; flick++) {
    const delta = flick % 2 === 0 ? -NOTCH_DELTA : NOTCH_DELTA
    for (let notch = 0; notch < FLICK_NOTCHES; notch++) {
      await mouse.wheel(0, delta)
      await wait(comfyPage, STEP_GAP_MS)
    }
    await wait(comfyPage, PAUSE_MS)
    scales.push((await readView(comfyPage)).scale)
  }
  const measurement = await comfyPage.perf.stopMeasuring(name)

  expectEachZoom(scales, start.zoomSpeed, FLICK_NOTCHES)
  expect(scales.at(-1)).toBeCloseTo(start.scale, 5)
  return measurement
}

export async function measureZoomSteps(comfyPage: ComfyPage, name: string) {
  const { mouse } = comfyPage.page
  const center = await canvasCenter(comfyPage)
  await mouse.move(center.x, center.y)
  const start = await readView(comfyPage)
  const deltas = [-NOTCH_DELTA, NOTCH_DELTA, NOTCH_DELTA, -NOTCH_DELTA]
  const scales = [start.scale]

  await comfyPage.perf.startMeasuring()
  for (let step = 0; step < GESTURES; step++) {
    await mouse.wheel(0, deltas[step % deltas.length])
    await wait(comfyPage, PAUSE_MS)
    scales.push((await readView(comfyPage)).scale)
  }
  const measurement = await comfyPage.perf.stopMeasuring(name)

  expectEachZoom(scales, start.zoomSpeed, 1)
  expect(scales.at(-1)).toBeCloseTo(start.scale, 5)
  return measurement
}

export async function measurePanFlicks(comfyPage: ComfyPage, name: string) {
  const { mouse } = comfyPage.page
  const center = await canvasCenter(comfyPage)
  await mouse.move(center.x, center.y)
  const start = await readView(comfyPage)
  const offsets = [start.x]

  await comfyPage.perf.startMeasuring()
  for (let flick = 0; flick < GESTURES; flick++) {
    const direction = flick % 2 === 0 ? 1 : -1
    const from = flick % 2 === 0 ? 0 : PAN_FLICK_STEPS
    await mouse.down({ button: 'middle' })
    for (let step = 1; step <= PAN_FLICK_STEPS; step++) {
      const travelled = (from + direction * step) * PAN_FLICK_DISTANCE
      await mouse.move(center.x + travelled, center.y + travelled / 2)
      await wait(comfyPage, STEP_GAP_MS / 2)
    }
    await mouse.up({ button: 'middle' })
    await wait(comfyPage, PAUSE_MS)
    offsets.push((await readView(comfyPage)).x)
  }
  const measurement = await comfyPage.perf.stopMeasuring(name)

  expectEachStep(
    offsets,
    (PAN_FLICK_STEPS * PAN_FLICK_DISTANCE) / start.scale,
    1
  )
  expect(offsets.at(-1)).toBeCloseTo(start.x, 1)
  return measurement
}

export async function measureNodeSelect(comfyPage: ComfyPage, name: string) {
  const { mouse } = comfyPage.page
  const grip = await findCenterNodeGrip(comfyPage)
  const empty = await findEmptyPoint(comfyPage)
  const rounds = GESTURES / 2
  const selected: number[] = []

  await comfyPage.perf.startMeasuring()
  for (let round = 0; round < rounds; round++) {
    await mouse.click(grip.x, grip.y)
    await wait(comfyPage, PAUSE_MS)
    selected.push(await selectedCount(comfyPage))
    await mouse.click(empty.x, empty.y)
    await wait(comfyPage, PAUSE_MS)
    selected.push(await selectedCount(comfyPage))
  }
  const measurement = await comfyPage.perf.stopMeasuring(name)

  expect(selected).toEqual(Array.from({ length: rounds }, () => [1, 0]).flat())
  return measurement
}

export async function measureNodeNudges(comfyPage: ComfyPage, name: string) {
  const { mouse } = comfyPage.page
  const grip = await findCenterNodeGrip(comfyPage)
  const position = () => nodeGraphPosition(comfyPage, grip.id)
  const { scale } = await readView(comfyPage)
  const positions = [(await position())[0]]

  await comfyPage.perf.startMeasuring()
  for (let nudge = 0; nudge < GESTURES; nudge++) {
    const direction = nudge % 2 === 0 ? 1 : -1
    const from = nudge % 2 === 0 ? 0 : NUDGE_STEPS
    await mouse.move(
      grip.x + from * NUDGE_DISTANCE,
      grip.y + (from * NUDGE_DISTANCE) / 2
    )
    await mouse.down()
    for (let step = 1; step <= NUDGE_STEPS; step++) {
      const travelled = (from + direction * step) * NUDGE_DISTANCE
      await mouse.move(grip.x + travelled, grip.y + travelled / 2)
      await wait(comfyPage, STEP_GAP_MS / 2)
    }
    await mouse.up()
    await wait(comfyPage, PAUSE_MS)
    positions.push((await position())[0])
  }
  const measurement = await comfyPage.perf.stopMeasuring(name)

  expectEachStep(positions, (NUDGE_STEPS * NUDGE_DISTANCE) / scale, 1)
  return measurement
}
