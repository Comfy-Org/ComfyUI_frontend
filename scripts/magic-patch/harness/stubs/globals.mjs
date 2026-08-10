/**
 * The `window.comfyAPI` namespace, which packs reach for instead of importing.
 *
 * ComfyUI publishes its modules twice: as ES modules under `scripts/`, and as a
 * global object built from the same exports. The resolve hook covers the first
 * form only, so a pack written against the second sees `undefined` and every one
 * of its files dies at load — which took out all 39 of kjnodes' node types and
 * looked like a conversion regression until the *unconverted* run failed the
 * same way.
 *
 * Registered under both `globalThis` and `window`, because packs use each.
 */
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

import { api } from './api.mjs'
import { app } from './app.mjs'
import * as ui from './ui.mjs'
import * as utils from './utils.mjs'
import * as widgets from './widgets.mjs'

/**
 * A DOM, so mounted and canvas widgets can run.
 *
 * `widgets.canvas` and `widgets.mount` are where the API sends every draw
 * callback, so without this the harness cannot verify the single largest class
 * of conversion — it threw at `addDOMWidget` and took the node with it.
 */
async function installDom() {
  if (globalThis.document) return
  const { Window } = await import('happy-dom')
  const win = new Window({ url: 'http://localhost' })
  for (const key of [
    'document',
    'HTMLElement',
    'HTMLCanvasElement',
    'Element',
    'Node',
    'CustomEvent',
    'ResizeObserver',
    'getComputedStyle'
  ]) {
    if (!globalThis[key] && win[key]) globalThis[key] = win[key]
  }
  globalThis.window = Object.assign(globalThis.window ?? globalThis, {
    document: win.document,
    getComputedStyle: win.getComputedStyle?.bind(win)
  })
  globalThis.document = win.document
}

export async function installGlobals() {
  await installDom()
  await import('@/scripts/domWidget')
  const comfyAPI = {
    app: { app, ComfyApp: app.constructor ?? function ComfyApp() {} },
    api: { api },
    ui,
    utils,
    widgets
  }

  // Litegraph is a script-tag global in ComfyUI, so packs use it unimported.
  Object.assign(globalThis, { LiteGraph, LGraph, LGraphNode, LGraphCanvas })

  globalThis.comfyAPI = comfyAPI
  if (!globalThis.window) globalThis.window = globalThis
  globalThis.window.comfyAPI = comfyAPI
}
