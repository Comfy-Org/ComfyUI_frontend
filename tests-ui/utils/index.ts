// @ts-strict-ignore
import { APIConfig, mockApi, mockNodeDefStore } from './setup'
import { Ez, EzGraph, EzNameSpace } from './ezgraph'
import lg from './litegraph'
import fs from 'fs'
import path from 'path'

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'))

interface StartConfig extends APIConfig {
  resetEnv?: boolean
  preSetup?(app): Promise<void>
  localStorage?: Record<string, string>
}

interface StartResult {
  app: any
  graph: EzGraph
  ez: EzNameSpace
}

/**
 *
 * @param { Parameters<typeof mockApi>[0] & {
 *   resetEnv?: boolean,
 *   preSetup?(app): Promise<void>,
 *  localStorage?: Record<string, string>
 * } } config
 * @returns
 */
export async function start(config: StartConfig = {}): Promise<StartResult> {
  if (config.resetEnv) {
    jest.resetModules()
    jest.resetAllMocks()
    lg.setup(global)
    localStorage.clear()
    sessionStorage.clear()
  }

  Object.assign(localStorage, config.localStorage ?? {})
  document.body.innerHTML = html.toString()

  mockApi(config)
  const { app } = await import('../../src/scripts/app')
  mockNodeDefStore()

  const { LiteGraph, LGraphCanvas } = await import('@comfyorg/litegraph')
  config.preSetup?.(app)
  const canvasEl = document.createElement('canvas')
  canvasEl.style.touchAction = 'none'
  canvasEl.id = 'graph-canvas'
  canvasEl.tabIndex = 1
  app.canvasContainer.prepend(canvasEl)
  await app.setup(canvasEl)

  return { ...Ez.graph(app, LiteGraph, LGraphCanvas), app }
}

/**
 * @param { ReturnType<Ez["graph"]>["graph"] } graph
 * @param { (hasReloaded: boolean) => (Promise<void> | void) } cb
 */
export async function checkBeforeAndAfterReload(graph, cb) {
  await cb(false)
  await graph.reload()
  await cb(true)
}

/**
 * @param { string } name
 * @param { Record<string, string | [string | string[], any]> } input
 * @param { (string | string[])[] | Record<string, string | string[]> } output
 */
export function makeNodeDef(name, input, output = {}) {
  const nodeDef = {
    name,
    category: 'test',
    output: [],
    output_name: [],
    output_is_list: [],
    input: {
      required: {}
    }
  }
  for (const k in input) {
    nodeDef.input.required[k] =
      typeof input[k] === 'string' ? [input[k], {}] : [...input[k]]
  }
  if (output instanceof Array) {
    output = output.reduce((p, c) => {
      p[c] = c
      return p
    }, {})
  }
  for (const k in output) {
    nodeDef.output.push(output[k])
    nodeDef.output_name.push(k)
    nodeDef.output_is_list.push(false)
  }

  return { [name]: nodeDef }
}

/**
/**
 * @template { any } T
 * @param { T } x
 * @returns { x is Exclude<T, null | undefined> }
 */
export function assertNotNullOrUndefined(x) {
  expect(x).not.toEqual(null)
  expect(x).not.toEqual(undefined)
  return true
}

/**
 *
 * @param { ReturnType<Ez["graph"]>["ez"] } ez
 * @param { ReturnType<Ez["graph"]>["graph"] } graph
 */
export function createDefaultWorkflow(ez, graph) {
  graph.clear()
  const ckpt = ez.CheckpointLoaderSimple()

  const pos = ez.CLIPTextEncode(ckpt.outputs.CLIP, { text: 'positive' })
  const neg = ez.CLIPTextEncode(ckpt.outputs.CLIP, { text: 'negative' })

  const empty = ez.EmptyLatentImage()
  const sampler = ez.KSampler(
    ckpt.outputs.MODEL,
    pos.outputs.CONDITIONING,
    neg.outputs.CONDITIONING,
    empty.outputs.LATENT
  )

  const decode = ez.VAEDecode(sampler.outputs.LATENT, ckpt.outputs.VAE)
  const save = ez.SaveImage(decode.outputs.IMAGE)
  graph.arrange()

  return { ckpt, pos, neg, empty, sampler, decode, save }
}

export async function getNodeDefs() {
  const { api } = await import('../../src/scripts/api')
  return api.getNodeDefs()
}

export async function getNodeDef(nodeId) {
  return (await getNodeDefs())[nodeId]
}
