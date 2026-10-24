import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { api } from './api'
import { getFromAvifFile } from './metadata/avif'
import { getFromFlacFile } from './metadata/flac'
import { getFromLatentFile } from './metadata/latent'
import { getFromPngFile } from './metadata/png'
import { getFromWebpFile } from './metadata/webp'

export const getAvifMetadata = getFromAvifFile
export const getFlacMetadata = getFromFlacFile
export const getLatentMetadata = getFromLatentFile
export const getPngMetadata = getFromPngFile
export const getWebpMetadata = getFromWebpFile

interface NodeConnection {
  node: LGraphNode
  index: number
}

interface LoraEntry {
  name: string
  weight: number
}

const A1111_NEGATIVE_PROMPT_PREFIX = '\nNegative prompt:'

function normalizeA1111Parameters(parameters: string): string {
  const stepsIndex = parameters.lastIndexOf('\nSteps:')
  if (
    stepsIndex === -1 ||
    parameters.lastIndexOf(A1111_NEGATIVE_PROMPT_PREFIX, stepsIndex) > -1
  ) {
    return parameters
  }

  return `${parameters.slice(0, stepsIndex)}${A1111_NEGATIVE_PROMPT_PREFIX}${parameters.slice(stepsIndex)}`
}

export type A1111ImportOutcome =
  | 'imported'
  | 'imported-without-embeddings'
  | 'not-a1111'
  | 'core-nodes-unavailable'

export async function importA1111(
  initialGraph: LGraph,
  parameters: string,
  beforeGraphClear?: () => void | LGraph | Promise<void | LGraph>
): Promise<A1111ImportOutcome> {
  let graph = initialGraph
  const normalizedParameters = normalizeA1111Parameters(parameters)
  const p = normalizedParameters.lastIndexOf('\nSteps:')
  if (p > -1) {
    const matchResult = normalizedParameters
      .substr(p)
      .split('\n')[1]
      .match(
        new RegExp('\\s*([^:]+:\\s*([^"\\{].*?|".*?"|\\{.*?\\}))\\s*(,|$)', 'g')
      )
    if (!matchResult) return 'not-a1111'

    const opts: Partial<Record<string, string>> = matchResult.reduce(
      (acc: Record<string, string>, n: string) => {
        const s = n.split(':')
        if (s[1].endsWith(',')) {
          s[1] = s[1].substr(0, s[1].length - 1)
        }
        acc[s[0].trim().toLowerCase()] = s[1].trim()
        return acc
      },
      {}
    )
    const p2 = normalizedParameters.lastIndexOf(A1111_NEGATIVE_PROMPT_PREFIX, p)
    if (p2 > -1) {
      let positive = normalizedParameters.substr(0, p2).trim()
      let negative = normalizedParameters
        .substring(p2 + A1111_NEGATIVE_PROMPT_PREFIX.length, p)
        .trim()

      const ckptNode = LiteGraph.createNode('CheckpointLoaderSimple')
      const clipSkipNode = LiteGraph.createNode('CLIPSetLastLayer')
      const positiveNode = LiteGraph.createNode('CLIPTextEncode')
      const negativeNode = LiteGraph.createNode('CLIPTextEncode')
      const samplerNode = LiteGraph.createNode('KSampler')
      const imageNode = LiteGraph.createNode('EmptyLatentImage')
      const vaeNode = LiteGraph.createNode('VAEDecode')
      const saveNode = LiteGraph.createNode('SaveImage')

      if (
        !ckptNode ||
        !clipSkipNode ||
        !positiveNode ||
        !negativeNode ||
        !samplerNode ||
        !imageNode ||
        !vaeNode ||
        !saveNode
      ) {
        console.error('Failed to create required nodes for A1111 import')
        return 'core-nodes-unavailable'
      }

      const hires: { samplerNode: LGraphNode | null; steps?: string } = {
        samplerNode: null
      }

      const ceil64 = (v: number) => Math.ceil(v / 64) * 64

      function getWidget(
        node: LGraphNode | null,
        name: string
      ): IBaseWidget | undefined {
        return node?.widgets?.find((w) => w.name === name)
      }

      function setWidgetValue(
        node: LGraphNode | null,
        name: string,
        value: string | number,
        isOptionPrefix?: boolean
      ): void {
        const w = getWidget(node, name)
        if (!w) return

        if (isOptionPrefix) {
          const values = w.options.values as string[] | undefined
          const o = values?.find((v) => v.startsWith(String(value)))
          if (o) {
            w.value = o
          } else {
            console.warn(`Unknown value '${value}' for widget '${name}'`, node)
            w.value = value
          }
        } else {
          w.value = value
        }
      }

      function createLoraNodes(
        clipNode: LGraphNode,
        text: string,
        prevClip: NodeConnection,
        prevModel: NodeConnection,
        targetSamplerNode: LGraphNode
      ): { text: string; prevModel: NodeConnection; prevClip: NodeConnection } {
        const loras: LoraEntry[] = []
        text = text.replace(/<lora:([^:]+:[^>]+)>/g, (_m, c: string) => {
          const s = c.split(':')
          const weight = parseFloat(s[1])
          if (isNaN(weight)) {
            console.warn('Invalid LORA', _m)
          } else {
            loras.push({ name: s[0], weight })
          }
          return ''
        })

        for (const l of loras) {
          const loraNode = LiteGraph.createNode('LoraLoader')
          if (!loraNode) continue
          graph.add(loraNode)
          setWidgetValue(loraNode, 'lora_name', l.name, true)
          setWidgetValue(loraNode, 'strength_model', l.weight)
          setWidgetValue(loraNode, 'strength_clip', l.weight)
          prevModel.node.connect(prevModel.index, loraNode, 0)
          prevClip.node.connect(prevClip.index, loraNode, 1)
          prevModel = { node: loraNode, index: 0 }
          prevClip = { node: loraNode, index: 1 }
        }

        prevClip.node.connect(1, clipNode, 0)
        prevModel.node.connect(0, targetSamplerNode, 0)
        if (hires.samplerNode) {
          prevModel.node.connect(0, hires.samplerNode, 0)
        }

        return { text, prevModel, prevClip }
      }

      function replaceEmbeddings(text: string): string {
        if (!embeddings.length) return text
        return text.replaceAll(
          new RegExp(
            '\\b(' +
              embeddings
                .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('\\b|\\b') +
              ')\\b',
            'ig'
          ),
          'embedding:$1'
        )
      }

      function popOpt(name: string): string | undefined {
        const v = opts[name]
        delete opts[name]
        return v
      }

      const { embeddings, embeddingsLoaded } = await api
        .getEmbeddings()
        .then((embeddings) => ({ embeddings, embeddingsLoaded: true }))
        .catch((error: unknown) => {
          console.error('Failed to load embeddings for A1111 import:', error)
          return { embeddings: [], embeddingsLoaded: false }
        })

      graph = (await beforeGraphClear?.()) ?? graph
      withGraphIntentSource('load', () => {
        graph.clear()
        graph.add(ckptNode)
        graph.add(clipSkipNode)
        graph.add(positiveNode)
        graph.add(negativeNode)
        graph.add(samplerNode)
        graph.add(imageNode)
        graph.add(vaeNode)
        graph.add(saveNode)

        ckptNode.connect(1, clipSkipNode, 0)
        clipSkipNode.connect(0, positiveNode, 0)
        clipSkipNode.connect(0, negativeNode, 0)
        ckptNode.connect(0, samplerNode, 0)
        positiveNode.connect(0, samplerNode, 1)
        negativeNode.connect(0, samplerNode, 2)
        imageNode.connect(0, samplerNode, 3)
        vaeNode.connect(0, saveNode, 0)
        samplerNode.connect(0, vaeNode, 0)
        ckptNode.connect(2, vaeNode, 1)

        const handlers: Partial<Record<string, (v: string) => void>> = {
          model(v: string) {
            setWidgetValue(ckptNode, 'ckpt_name', v, true)
          },
          vae() {},
          'cfg scale'(v: string) {
            setWidgetValue(samplerNode, 'cfg', +v)
          },
          'clip skip'(v: string) {
            setWidgetValue(clipSkipNode, 'stop_at_clip_layer', -Number(v))
          },
          sampler(v: string) {
            let name = v.toLowerCase().replace('++', 'pp').replaceAll(' ', '_')
            if (name.includes('karras')) {
              name = name.replace('karras', '').replace(/_+$/, '')
              setWidgetValue(samplerNode, 'scheduler', 'karras')
            } else {
              setWidgetValue(samplerNode, 'scheduler', 'normal')
            }
            const w = getWidget(samplerNode, 'sampler_name')
            const values = w?.options.values as string[] | undefined
            const o = values?.find((v) => v === name || v === 'sample_' + name)
            if (o) {
              setWidgetValue(samplerNode, 'sampler_name', o)
            }
          },
          // fallow-ignore-next-line complexity -- legacy A1111 size/hires importer; this PR only scopes its existing branches under load provenance.
          size(v: string) {
            const wxh = v.split('x')
            const w = ceil64(+wxh[0])
            const h = ceil64(+wxh[1])
            const hrUp = popOpt('hires upscale')
            const hrSz = popOpt('hires resize')
            hires.steps = popOpt('hires steps')
            let hrMethod = popOpt('hires upscaler')

            setWidgetValue(imageNode, 'width', w)
            setWidgetValue(imageNode, 'height', h)

            if (hrUp || hrSz) {
              let uw: number, uh: number
              if (hrUp) {
                uw = w * Number(hrUp)
                uh = h * Number(hrUp)
              } else if (hrSz) {
                const s = hrSz.split('x')
                uw = +s[0]
                uh = +s[1]
              } else {
                return
              }

              let upscaleNode: LGraphNode | null
              let latentNode: LGraphNode | null

              if (hrMethod?.startsWith('Latent')) {
                latentNode = upscaleNode = LiteGraph.createNode('LatentUpscale')
                if (!upscaleNode) return
                graph.add(upscaleNode)
                samplerNode.connect(0, upscaleNode, 0)

                switch (hrMethod) {
                  case 'Latent (nearest-exact)':
                    hrMethod = 'nearest-exact'
                    break
                }
                setWidgetValue(upscaleNode, 'upscale_method', hrMethod, true)
              } else {
                const decode = LiteGraph.createNode('VAEDecodeTiled')
                if (!decode) return
                graph.add(decode)
                samplerNode.connect(0, decode, 0)
                ckptNode.connect(2, decode, 1)

                const upscaleLoaderNode =
                  LiteGraph.createNode('UpscaleModelLoader')
                if (!upscaleLoaderNode) return
                graph.add(upscaleLoaderNode)
                setWidgetValue(
                  upscaleLoaderNode,
                  'model_name',
                  hrMethod ?? '',
                  true
                )

                const modelUpscaleNode = LiteGraph.createNode(
                  'ImageUpscaleWithModel'
                )
                if (!modelUpscaleNode) return
                graph.add(modelUpscaleNode)
                decode.connect(0, modelUpscaleNode, 1)
                upscaleLoaderNode.connect(0, modelUpscaleNode, 0)

                upscaleNode = LiteGraph.createNode('ImageScale')
                if (!upscaleNode) return
                graph.add(upscaleNode)
                modelUpscaleNode.connect(0, upscaleNode, 0)

                const vaeEncodeNode = LiteGraph.createNode('VAEEncodeTiled')
                if (!vaeEncodeNode) return
                latentNode = vaeEncodeNode
                graph.add(vaeEncodeNode)
                upscaleNode.connect(0, vaeEncodeNode, 0)
                ckptNode.connect(2, vaeEncodeNode, 1)
              }

              setWidgetValue(upscaleNode, 'width', ceil64(uw))
              setWidgetValue(upscaleNode, 'height', ceil64(uh))

              const hrSamplerNode = LiteGraph.createNode('KSampler')
              if (!hrSamplerNode || !latentNode) return
              hires.samplerNode = hrSamplerNode
              graph.add(hrSamplerNode)
              ckptNode.connect(0, hrSamplerNode, 0)
              positiveNode.connect(0, hrSamplerNode, 1)
              negativeNode.connect(0, hrSamplerNode, 2)
              latentNode.connect(0, hrSamplerNode, 3)
              hrSamplerNode.connect(0, vaeNode, 0)
            }
          },
          steps(v: string) {
            setWidgetValue(samplerNode, 'steps', +v)
          },
          seed(v: string) {
            setWidgetValue(samplerNode, 'seed', +v)
          }
        }

        for (const opt in opts) {
          const handler = handlers[opt]
          if (handler) {
            const value = popOpt(opt)
            if (value !== undefined) handler(value)
          }
        }

        const { samplerNode: hrSamplerNode, steps: hrSteps } = hires
        if (hrSamplerNode) {
          setWidgetValue(
            hrSamplerNode,
            'steps',
            hrSteps
              ? +hrSteps
              : (getWidget(samplerNode, 'steps')?.value as number)
          )
          setWidgetValue(
            hrSamplerNode,
            'cfg',
            getWidget(samplerNode, 'cfg')?.value as number
          )
          setWidgetValue(
            hrSamplerNode,
            'scheduler',
            getWidget(samplerNode, 'scheduler')?.value as string
          )
          setWidgetValue(
            hrSamplerNode,
            'sampler_name',
            getWidget(samplerNode, 'sampler_name')?.value as string
          )
          setWidgetValue(
            hrSamplerNode,
            'denoise',
            +(popOpt('denoising strength') ?? '1')
          )
        }

        let n = createLoraNodes(
          positiveNode,
          positive,
          { node: clipSkipNode, index: 0 },
          { node: ckptNode, index: 0 },
          samplerNode
        )
        positive = n.text
        n = createLoraNodes(
          negativeNode,
          negative,
          n.prevClip,
          n.prevModel,
          samplerNode
        )
        negative = n.text

        setWidgetValue(positiveNode, 'text', replaceEmbeddings(positive))
        setWidgetValue(negativeNode, 'text', replaceEmbeddings(negative))

        graph.arrange()
      })

      for (const opt of [
        'model hash',
        'ensd',
        'version',
        'vae hash',
        'ti hashes',
        'lora hashes',
        'hashes'
      ]) {
        delete opts[opt]
      }

      if (Object.keys(opts).length) {
        console.warn('Unhandled parameters:', opts)
      }
      return embeddingsLoaded ? 'imported' : 'imported-without-embeddings'
    }
  }
  return 'not-a1111'
}
