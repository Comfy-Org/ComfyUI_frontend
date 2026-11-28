import fs from 'node:fs'
import path from 'node:path'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { zComfyNodeDef } from '@comfyorg/object-info-parser/schemas/nodeDefSchema'
import { z } from 'zod'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { decodePngBuffer } from '@e2e/fixtures/helpers/decodedImage'
import { drawingFound, hookDrawing } from '@e2e/fixtures/helpers/hookDrawing'
import type {
  ClientBox,
  LayoutData,
  NodeMeasure,
  ProbeOutcome,
  ProbeTarget,
  WidgetMeasure
} from '@e2e/reporters/nodes2Acceptance/layout'
import {
  MIN_DRAWN_PIXELS,
  NODE_BODY
} from '@e2e/reporters/nodes2Acceptance/layout'
import { REPORT_DIR } from '@e2e/reporters/nodes2Acceptance/reportDir'
import { writeReportFile } from '@e2e/reporters/nodes2Acceptance/reportFiles'

export type SurveyRenderer = 'classic' | 'nodes2'

const ROW_POINTS = [0.1, 0.3, 0.5, 0.7, 0.9] as const
const BODY_POINTS = [
  [0.2, 0.25],
  [0.5, 0.25],
  [0.8, 0.25],
  [0.2, 0.65],
  [0.5, 0.65],
  [0.8, 0.65]
] as const
const DRAW_HOOKS = ['onDrawForeground', 'onDrawBackground'] as const

const NODE_ORIGIN = [80, 120] as const
const IMAGE_PADDING = 16
const PIXEL_TOLERANCE = 24
const POPUP_SELECTOR = [
  '.litecontextmenu',
  '.graphdialog',
  '.comfy-modal',
  'dialog[open]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]'
].join(',')

type NodeState = Record<string, string>

const surveyUsesVueNodes = (comfyPage: ComfyPage) =>
  comfyPage.page.evaluate(() =>
    Boolean(window.app!.extensionManager.setting.get('Comfy.VueNodes.Enabled'))
  )

export async function packNodeTypes(
  comfyPage: ComfyPage,
  directory: string,
  frontendNodeTypes: readonly string[]
): Promise<string[]> {
  const response = await comfyPage.request.get(
    `${comfyPage.url}/api/object_info`
  )
  const objectInfo = z
    .record(z.string(), zComfyNodeDef.pick({ python_module: true }))
    .parse(await response.json())
  const module = `custom_nodes.${directory}`
  const serverTypes = Object.entries(objectInfo)
    .filter(
      ([, info]) =>
        info.python_module === module ||
        info.python_module.startsWith(`${module}.`)
    )
    .map(([type]) => type)
  const candidates = [...new Set([...serverTypes, ...frontendNodeTypes])]
  return comfyPage.page.evaluate(
    (types) =>
      types.filter((type) => type in window.LiteGraph!.registered_node_types),
    candidates
  )
}

async function isNodeElementVisible(comfyPage: ComfyPage, id: NodeId) {
  try {
    await comfyPage.vueNodes
      .getNodeLocator(id)
      .waitFor({ state: 'visible', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

const fullScreenLayers = (comfyPage: ComfyPage, remove: boolean) =>
  comfyPage.page.evaluate((remove) => {
    const covering = new Set<HTMLElement>()
    const area = window.innerWidth * window.innerHeight
    for (const element of document.elementsFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2
    )) {
      if (!(element instanceof HTMLElement)) continue
      if (element.parentElement !== document.body) continue
      const renderedByApp =
        element.id === 'vue-app' ||
        element.getAttribute('role') === 'dialog' ||
        element.getAttributeNames().some((name) => name.startsWith('data-v-'))
      const { width, height } = element.getBoundingClientRect()
      if (
        !renderedByApp &&
        getComputedStyle(element).position === 'fixed' &&
        width * height >= area / 2 &&
        !element.contains(window.app!.canvas.canvas)
      )
        covering.add(element)
    }
    if (remove) for (const element of covering) element.remove()
    return covering.size
  }, remove)

export async function placeSurveyNode(
  comfyPage: ComfyPage,
  type: string
): Promise<NodeId | null> {
  for (const page of comfyPage.page.context().pages())
    if (page !== comfyPage.page) await page.close()
  await comfyPage.page.keyboard.press('Escape')
  await fullScreenLayers(comfyPage, true)
  const viewport = comfyPage.page.viewportSize()!
  await comfyPage.page.mouse.move(viewport.width - 100, viewport.height / 2)
  const id = await comfyPage.page.evaluate(
    ({ type, origin }) => {
      const app = window.app!
      const lastNodeId = app.graph.state.lastNodeId
      app.graph.clear()
      app.graph.state.lastNodeId = lastNodeId
      app.canvas.ds.scale = 1
      app.canvas.ds.offset[0] = 0
      app.canvas.ds.offset[1] = 0
      try {
        const node = window.LiteGraph!.createNode(type)
        if (!node) return null
        node.pos = [origin[0], origin[1]]
        app.graph.add(node)
        app.canvas.setDirty(true, true)
        return String(node.id)
      } catch {
        return null
      }
    },
    { type, origin: NODE_ORIGIN }
  )
  if (id === null) return null
  const nodeId = toNodeId(id)
  if (
    (await surveyUsesVueNodes(comfyPage)) &&
    !(await isNodeElementVisible(comfyPage, nodeId))
  )
    return null
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()
  return nodeId
}

type PageMeasure = Pick<
  NodeMeasure,
  'rendered' | 'rect' | 'widgets' | 'overflow' | 'bodyInteractive'
>

async function measureInPage(
  comfyPage: ComfyPage,
  id: NodeId
): Promise<PageMeasure> {
  return comfyPage.page.evaluate(
    ({ id, vue }) => {
      const app = window.app!
      const LiteGraph = window.LiteGraph!
      const node = app.graph.getNodeById(id)
      if (!node)
        return {
          rendered: false,
          rect: null,
          widgets: [],
          overflow: 0,
          bodyInteractive: false
        }
      const boxOf = (element: Element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const clientBox = (
        left: number,
        top: number,
        width: number,
        height: number
      ) => {
        const [x, y] = app.canvasPosToClientPos([left, top])
        return { x, y, width, height }
      }
      const nodeElement = vue
        ? document.querySelector(`[data-node-id="${CSS.escape(String(id))}"]`)
        : null
      const rect = nodeElement
        ? boxOf(nodeElement)
        : clientBox(
            node.pos[0],
            node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
            node.size[0],
            node.size[1] + LiteGraph.NODE_TITLE_HEIGHT
          )
      const inViewport = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
      const widgets = (node.widgets ?? []).map((widget) => {
        const custom =
          typeof widget.draw === 'function' ||
          typeof widget.mouse === 'function'
        const shownInOwner =
          widget.name.startsWith('$$') ||
          (node.widgets ?? []).some(
            (owner) =>
              owner !== widget && !!owner.linkedWidgets?.includes(widget)
          )
        const base = {
          name: widget.name,
          type: widget.type,
          custom,
          shownInOwner,
          coveredBy: null
        }
        if (!vue) {
          const height =
            widget.computedHeight ??
            widget.computeSize?.(node.size[0])[1] ??
            LiteGraph.NODE_WIDGET_HEIGHT
          const top = widget.last_y
          const visible =
            node.isWidgetVisible(widget) &&
            height > 0 &&
            top !== undefined &&
            top < node.size[1]
          return {
            ...base,
            visible,
            reachable: visible ? true : null,
            rect: visible
              ? clientBox(node.pos[0], node.pos[1] + top, node.size[0], height)
              : null,
            clippedPixels: 0
          }
        }
        const row = nodeElement?.querySelector(
          `[data-widget-name="${CSS.escape(widget.name)}"]`
        )
        if (!row)
          return {
            ...base,
            visible: false,
            reachable: null,
            rect: null,
            clippedPixels: 0
          }
        const box = boxOf(row)
        const centreX = box.x + box.width / 2
        const centreY = box.y + box.height / 2
        const insideNode =
          centreX >= rect.x &&
          centreX <= rect.x + rect.width &&
          centreY >= rect.y &&
          centreY <= rect.y + rect.height
        const visible =
          row.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true
          }) &&
          box.width >= 4 &&
          box.height >= 4 &&
          insideNode
        const hit = inViewport(centreX, centreY)
          ? document.elementFromPoint(centreX, centreY)
          : undefined
        const coveredByNode = !!hit?.closest('[data-node-id]')
        const reachable =
          !visible || !hit
            ? null
            : row.contains(hit) || (coveredByNode ? false : null)
        const describe = (element: Element) =>
          element.closest('[data-testid]')?.getAttribute('data-testid') ??
          `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 3).join('.')}`
        return {
          ...base,
          visible,
          reachable,
          coveredBy: reachable === false && hit ? describe(hit) : null,
          rect: box,
          clippedPixels: 0
        }
      })
      const overflow = Math.max(
        0,
        ...widgets.flatMap(({ rect: row }) =>
          vue && row
            ? [
                row.y + row.height - (rect.y + rect.height),
                row.x + row.width - (rect.x + rect.width)
              ]
            : []
        )
      )
      return {
        rendered: true,
        rect,
        widgets,
        overflow,
        bodyInteractive: typeof node.onMouseDown === 'function'
      }
    },
    { id, vue: await surveyUsesVueNodes(comfyPage) }
  )
}

async function clippedPixelsByWidget(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    const nodeElement = document.querySelector(
      `[data-node-id="${CSS.escape(String(id))}"]`
    )
    const padding = 400
    const result: Record<string, number> = {}
    const errors: string[] = []
    for (const widget of node?.widgets ?? []) {
      const draw = widget.draw
      const strip = nodeElement?.querySelector<HTMLCanvasElement>(
        `[data-widget-name="${CSS.escape(widget.name)}"] canvas[data-testid="legacy-widget-canvas"]`
      )
      if (typeof draw !== 'function' || !strip || !widget.triggerDraw) continue
      let drawArgs: Parameters<typeof draw> | undefined
      widget.draw = function (...args) {
        drawArgs = args
        return draw.apply(this, args)
      }
      try {
        widget.triggerDraw()
      } catch (error) {
        errors.push(
          `Widget ${widget.name} redraw unavailable: ${String(error)}`
        )
        continue
      } finally {
        widget.draw = draw
      }
      if (!drawArgs) continue
      const [, owner, width, y, height] = drawArgs
      const band = strip.height / 2
      const probe = document.createElement('canvas')
      probe.width = Math.ceil(width) + padding * 2
      probe.height = Math.ceil(band) + padding * 2
      const context = probe.getContext('2d', { willReadFrequently: true })!
      context.translate(padding, padding + 1 - y)
      try {
        draw.call(widget, context, owner, width, y, height)
      } catch (error) {
        errors.push(
          `Widget ${widget.name} clipping unavailable: ${String(error)}`
        )
        continue
      }
      const pixels = context.getImageData(0, 0, probe.width, probe.height).data
      const spill = 2
      const left = padding - spill
      const right = padding + width + spill
      const top = padding - spill
      const bottom = padding + band + spill
      let outside = 0
      for (let py = 0; py < probe.height; py++) {
        const rowInBand = py >= top && py < bottom
        for (let px = 0; px < probe.width; px++) {
          if (pixels[(py * probe.width + px) * 4 + 3] < 32) continue
          if (!rowInBand || px < left || px >= right) outside++
        }
      }
      result[widget.name] = outside
    }
    return { pixels: result, errors }
  }, id)
}

async function setDrawHooksEnabled(
  comfyPage: ComfyPage,
  id: NodeId,
  enabled: boolean
) {
  await comfyPage.page.evaluate(
    ({ id, hooks, enabled }) => {
      const node = window.app!.graph.getNodeById(id)
      if (!node) return
      const saved = '__layoutSurveySavedHooks'
      if (!enabled) {
        Reflect.set(
          node,
          saved,
          hooks.map((hook) => Object.getOwnPropertyDescriptor(node, hook))
        )
        for (const hook of hooks) Reflect.set(node, hook, () => undefined)
      } else {
        const descriptors: unknown = Reflect.get(node, saved)
        hooks.forEach((hook, index) => {
          const descriptor = Array.isArray(descriptors)
            ? descriptors[index]
            : undefined
          if (descriptor) Object.defineProperty(node, hook, descriptor)
          else Reflect.deleteProperty(node, hook)
        })
      }
      window.app!.canvas.setDirty(true, true)
    },
    { id, hooks: DRAW_HOOKS, enabled }
  )
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()
}

const nodeInClip = (rect: ClientBox, clip: ClientBox): ClientBox => ({
  x: rect.x - clip.x,
  y: rect.y - clip.y,
  width: rect.width,
  height: rect.height
})

async function classicHookDrawing(
  comfyPage: ComfyPage,
  id: NodeId,
  rect: ClientBox,
  clip: ClientBox,
  withHooks: Buffer
) {
  await setDrawHooksEnabled(comfyPage, id, false)
  const withoutHooks = await comfyPage.page.screenshot({ clip })
  await setDrawHooksEnabled(comfyPage, id, true)
  return hookDrawing(
    decodePngBuffer(withHooks),
    decodePngBuffer(withoutHooks),
    nodeInClip(rect, clip)
  )
}

async function hookCallsDuringRedraw(comfyPage: ComfyPage, id: NodeId) {
  const wrapped = await comfyPage.page.evaluate(
    ({ id, hooks }) => {
      const node = window.app!.graph.getNodeById(id)
      const counter = { calls: 0 }
      Reflect.set(window, '__layoutSurveyDrawCalls', counter)
      let wrappedAny = false
      for (const hook of hooks) {
        const original: unknown = node && Reflect.get(node, hook)
        if (!node || typeof original !== 'function') continue
        wrappedAny = true
        Reflect.set(node, hook, function (this: unknown, ...args: unknown[]) {
          counter.calls++
          return original.apply(this, args)
        })
      }
      window.app!.canvas.setDirty(true, true)
      return wrappedAny
    },
    { id, hooks: DRAW_HOOKS }
  )
  if (!wrapped) return null
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()
  return comfyPage.page.evaluate(() => {
    const counter: unknown = Reflect.get(window, '__layoutSurveyDrawCalls')
    return counter && typeof counter === 'object' && 'calls' in counter
      ? Number(counter.calls)
      : null
  })
}

function viewportClip(comfyPage: ComfyPage, rect: ClientBox) {
  const viewport = comfyPage.page.viewportSize()!
  const x = Math.max(0, Math.floor(rect.x - IMAGE_PADDING))
  const y = Math.max(0, Math.floor(rect.y - IMAGE_PADDING))
  const width = Math.min(
    viewport.width - x,
    Math.ceil(rect.width + IMAGE_PADDING * 2)
  )
  const height = Math.min(
    viewport.height - y,
    Math.ceil(rect.height + IMAGE_PADDING * 2)
  )
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

function saveImage(image: Buffer, relativePath: string) {
  const file = path.join(REPORT_DIR, relativePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, image)
  return relativePath
}

const NOT_RENDERED: NodeMeasure = {
  rendered: false,
  rect: null,
  widgets: [],
  overflow: 0,
  drawing: null,
  drawingFound: null,
  drawCalls: null,
  bodyInteractive: false,
  errors: [],
  image: null
}

export async function measureSurveyNode(
  comfyPage: ComfyPage,
  id: NodeId,
  imagePath: string,
  errors: string[],
  classic?: NodeMeasure
): Promise<NodeMeasure> {
  const measure = await measureInPage(comfyPage, id)
  const clip = measure.rect && viewportClip(comfyPage, measure.rect)
  if (!measure.rendered || !measure.rect || !clip)
    return { ...NOT_RENDERED, ...measure, errors }
  const vue = await surveyUsesVueNodes(comfyPage)
  const clipped = vue
    ? await clippedPixelsByWidget(comfyPage, id)
    : { pixels: {}, errors: [] }
  const widgets: WidgetMeasure[] = measure.widgets.map((widget) => ({
    ...widget,
    clippedPixels: clipped.pixels[widget.name] ?? 0
  }))
  const screenshot = await comfyPage.page.screenshot({ clip })
  const drawing = vue
    ? null
    : await classicHookDrawing(comfyPage, id, measure.rect, clip, screenshot)
  return {
    ...measure,
    widgets,
    drawing,
    drawingFound:
      vue && classic?.drawing
        ? drawingFound(
            decodePngBuffer(screenshot),
            nodeInClip(measure.rect, clip),
            classic.drawing
          )
        : null,
    drawCalls: vue ? await hookCallsDuringRedraw(comfyPage, id) : null,
    errors: [...errors, ...clipped.errors],
    image: saveImage(screenshot, imagePath)
  }
}

export function probeTargets(measure: NodeMeasure, maxWidgets: number) {
  const drawsOwnBody =
    (measure.drawing?.pixels ?? 0) >= MIN_DRAWN_PIXELS ||
    (measure.bodyInteractive &&
      measure.widgets.every((widget) => !widget.visible))
  const widgetTargets = measure.widgets
    .filter((widget) => widget.custom && widget.visible)
    .slice(0, maxWidgets)
    .flatMap((widget) =>
      ROW_POINTS.map((x) => ({ target: widget.name, x, y: 0.5 }))
    )
  const bodyTargets = drawsOwnBody
    ? BODY_POINTS.map(([x, y]) => ({ target: NODE_BODY, x, y }))
    : []
  return [...widgetTargets, ...bodyTargets]
}

async function nodeState(comfyPage: ComfyPage, id: NodeId): Promise<NodeState> {
  return comfyPage.page.evaluate((id): Record<string, string> => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) return { node: 'removed' }
    const text = (value: unknown) => {
      try {
        const serialisable =
          value !== undefined &&
          typeof value !== 'function' &&
          typeof value !== 'symbol'
        return serialisable ? JSON.stringify(value) : String(value)
      } catch {
        return String(value)
      }
    }
    return {
      ...Object.fromEntries(
        (node.widgets ?? []).map((widget) => [
          `widget ${widget.name}`,
          text(widget.value)
        ])
      ),
      ...Object.fromEntries(
        Object.entries(node.properties).map(([key, value]) => [
          `property ${key}`,
          text(value)
        ])
      ),
      mode: String(node.mode),
      title: node.title,
      'input count': String(node.inputs.length),
      'output count': String(node.outputs.length),
      'widget count': String(node.widgets?.length ?? 0)
    }
  }, id)
}

const popupCount = async (comfyPage: ComfyPage) =>
  comfyPage.page.context().pages().length +
  (await fullScreenLayers(comfyPage, false)) +
  (await comfyPage.page.evaluate(
    (selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)].filter((element) =>
        element.checkVisibility()
      ).length,
    POPUP_SELECTOR
  ))

function differingPixels(a: Buffer, b: Buffer) {
  const before = decodePngBuffer(a)
  const after = decodePngBuffer(b)
  if (before.rgba.length !== after.rgba.length)
    return before.width * before.height
  let count = 0
  for (let offset = 0; offset < before.rgba.length; offset += 4) {
    const delta =
      Math.abs(before.rgba[offset] - after.rgba[offset]) +
      Math.abs(before.rgba[offset + 1] - after.rgba[offset + 1]) +
      Math.abs(before.rgba[offset + 2] - after.rgba[offset + 2])
    if (delta > PIXEL_TOLERANCE) count++
  }
  return count
}

async function bodyRect(
  comfyPage: ComfyPage,
  id: NodeId,
  rect: ClientBox
): Promise<ClientBox> {
  const titleHeight = await comfyPage.page.evaluate(
    ({ id, vue }) => {
      if (!vue) return window.LiteGraph!.NODE_TITLE_HEIGHT
      const header = document.querySelector(
        `[data-testid="node-header-${CSS.escape(String(id))}"]`
      )
      return header ? header.getBoundingClientRect().height : 0
    },
    { id, vue: await surveyUsesVueNodes(comfyPage) }
  )
  return {
    x: rect.x,
    y: rect.y + titleHeight,
    width: rect.width,
    height: rect.height - titleHeight
  }
}

async function targetRect(
  comfyPage: ComfyPage,
  id: NodeId,
  widget: string
): Promise<ClientBox | null> {
  const measure = await measureInPage(comfyPage, id)
  if (widget === NODE_BODY)
    return measure.rect && bodyRect(comfyPage, id, measure.rect)
  const match = measure.widgets.find((candidate) => candidate.name === widget)
  if (!match?.visible || !match.rect) return null
  if (!(await surveyUsesVueNodes(comfyPage))) return match.rect
  const escapedName = await comfyPage.page.evaluate(
    (name) => CSS.escape(name),
    widget
  )
  const strip = comfyPage.vueNodes
    .getNodeLocator(id)
    .locator(
      `[data-widget-name="${escapedName}"] canvas[data-testid="legacy-widget-canvas"]`
    )
  return (await strip.count()) ? await strip.boundingBox() : match.rect
}

const changedKeys = (before: NodeState, after: NodeState) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => before[key] !== after[key])
    .sort()

const onWidgetRow = (widgets: WidgetMeasure[], x: number, y: number) =>
  widgets.some(
    ({ visible, rect }) =>
      visible &&
      rect !== null &&
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
  )

const selectNode = (comfyPage: ComfyPage, id: NodeId) =>
  comfyPage.page.evaluate((id) => {
    const app = window.app!
    const node = app.graph.getNodeById(id)
    if (node) app.canvas.selectNode(node)
  }, id)

export async function probeNode(
  comfyPage: ComfyPage,
  type: string,
  probe: ProbeTarget
): Promise<ProbeOutcome> {
  const unavailable = (reason: string): ProbeOutcome => ({
    ...probe,
    changed: [],
    popup: false,
    pixels: 0,
    unavailable: reason
  })
  const id = await placeSurveyNode(comfyPage, type)
  if (id === null) return unavailable('Node could not be placed')
  await selectNode(comfyPage, id)
  await comfyPage.nextFrame()
  const target = await targetRect(comfyPage, id, probe.target)
  const placed = await measureInPage(comfyPage, id)
  const clip = placed.rect && viewportClip(comfyPage, placed.rect)
  if (!target || !clip) return unavailable('Target has no visible rectangle')
  const x = target.x + target.width * probe.x
  const y = target.y + target.height * probe.y
  const viewport = comfyPage.page.viewportSize()
  if (
    !viewport ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x >= viewport.width ||
    y >= viewport.height
  )
    return unavailable('Probe point is outside the viewport')
  if (probe.target === NODE_BODY && onWidgetRow(placed.widgets, x, y))
    return unavailable(
      'Body point is occupied by a widget; click intentionally skipped'
    )
  await comfyPage.page.mouse.move(x, y)
  await comfyPage.nextFrame()
  const [stateBefore, popupsBefore, imageBefore] = [
    await nodeState(comfyPage, id),
    await popupCount(comfyPage),
    await comfyPage.page.screenshot({ clip })
  ]
  await comfyPage.page.mouse.down()
  await comfyPage.page.mouse.up()
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()
  const [stateAfter, popupsAfter, imageAfter] = [
    await nodeState(comfyPage, id),
    await popupCount(comfyPage),
    await comfyPage.page.screenshot({ clip })
  ]
  return {
    ...probe,
    changed: changedKeys(stateBefore, stateAfter),
    transitions: Object.fromEntries(
      changedKeys(stateBefore, stateAfter).map((key) => [
        key,
        { before: stateBefore[key] ?? null, after: stateAfter[key] ?? null }
      ])
    ),
    popup: popupsAfter > popupsBefore,
    pixels: differingPixels(imageBefore, imageAfter)
  }
}

async function collectSurveyType(
  comfyPage: ComfyPage,
  type: string,
  imagePath: string,
  targetsFor: (measure: NodeMeasure) => ProbeTarget[],
  classic?: NodeMeasure
) {
  const errors: string[] = []
  const collect = (error: Error) =>
    errors.push(error.message.split('\n')[0].slice(0, 200))
  comfyPage.page.on('pageerror', collect)
  let measure: NodeMeasure = { ...NOT_RENDERED }
  const probes: ProbeOutcome[] = []
  try {
    const id = await placeSurveyNode(comfyPage, type)
    if (id !== null)
      measure = await measureSurveyNode(comfyPage, id, imagePath, [], classic)
    for (const target of targetsFor(measure)) {
      try {
        probes.push(await probeNode(comfyPage, type, target))
      } catch (error) {
        const reason = String(error)
        errors.push(reason)
        probes.push({
          ...target,
          changed: [],
          popup: false,
          pixels: 0,
          unavailable: reason
        })
      }
    }
  } catch (error) {
    errors.push(String(error))
  } finally {
    comfyPage.page.off('pageerror', collect)
  }
  return {
    measure: { ...measure, errors: [...measure.errors, ...errors] },
    probes
  }
}

export async function surveyRenderer(
  comfyPage: ComfyPage,
  pack: string,
  types: string[],
  renderer: SurveyRenderer,
  targetsFor: (index: number, measure: NodeMeasure) => ProbeTarget[],
  classicFor: (index: number) => NodeMeasure | undefined = () => undefined
) {
  await comfyPage.vueNodes.setEnabled(renderer === 'nodes2')
  const passes: { measure: NodeMeasure; probes: ProbeOutcome[] }[] = []
  for (const [index, type] of types.entries())
    passes.push(
      await collectSurveyType(
        comfyPage,
        type,
        `layout/img/${pack}/${index}.${renderer}.png`,
        (measure) => targetsFor(index, measure),
        classicFor(index)
      )
    )
  return passes
}

export function writeLayoutData(data: LayoutData) {
  const file = path.join(REPORT_DIR, 'layout', 'data', `${data.pack}.json`)
  writeReportFile(file, JSON.stringify(data, null, 2))
}
