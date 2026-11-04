import type { SettingValue } from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  arrayAt,
  stringAt,
  valueAt,
  withoutUndefined
} from '@/renderer/extensions/superComfy/router/routerJson'
import {
  humanizeKey,
  singleMediaPort,
  textPort
} from '@/renderer/extensions/superComfy/router/routerPorts'
import type {
  EncodedMedia,
  JsonObject,
  JsonValue,
  OutputsOutcome,
  RouterFamily
} from '@/renderer/extensions/superComfy/router/routerTypes'

const PREMADE_VOICES = [
  '21m00Tcm4TlvDq8ikWAM',
  'JBFqnCBsd6RMkjVDRZzb',
  'EXAVITQu4vr4xnSDxMaL',
  'pNInz6obpgDQGcFmaJgB',
  'ErXwobaYiN019PkySvjV',
  'TxGEqnHWrfWFTfGW9XjX',
  'MF3mGyEYCl7XYWbV9V6O',
  'AZnzlk1XvdvUeBnXmlld'
]

const VEO_DEFAULT_MIME = 'video/mp4'

function firstOf(items: EncodedMedia[] | undefined): EncodedMedia | undefined {
  return items?.[0]
}

function veoFrame(media: EncodedMedia | undefined): JsonObject | undefined {
  return media && { bytesBase64Encoded: media.data, mimeType: media.mime }
}

function readVeo(json: unknown): OutputsOutcome {
  const video = valueAt(json, ['response', 'videos', 0])
  const data = stringAt(video, ['bytesBase64Encoded'])
  if (data) {
    const mime = stringAt(video, ['mimeType']) ?? VEO_DEFAULT_MIME
    return { ok: true, outputs: [{ kind: 'base64', data, mime }] }
  }
  const url = stringAt(video, ['gcsUri'])
  if (url?.startsWith('https://')) {
    return { ok: true, outputs: [{ kind: 'url', url }] }
  }
  const reasons = arrayAt(json, ['response', 'raiMediaFilteredReasons'])
    .filter((reason): reason is string => typeof reason === 'string')
    .join('; ')
  return { ok: false, message: reasons || stringAt(json, ['error', 'message']) }
}

const veo: RouterFamily = {
  id: 'veo',
  matches: (modelId) => modelId.startsWith('veo/'),
  transport: 'queue',
  ports: () => [
    textPort('prompt', { required: true }),
    textPort('negative_prompt'),
    singleMediaPort({
      name: 'image',
      modality: 'image',
      encoding: 'base64',
      labelKey: 'first_frame'
    }),
    singleMediaPort({
      name: 'last_frame',
      modality: 'image',
      encoding: 'base64'
    })
  ],
  settingsRoots: [['parameters']],
  excludeSettings: [
    'negativePrompt',
    'personGeneration',
    'storageUri',
    'pubsubTopic',
    'task',
    'fps',
    'enhancePrompt'
  ],
  extraSettings: [],
  fixed: [{ path: ['parameters', 'personGeneration'], value: 'allow_adult' }],
  buildBody: ({ inputs }) => {
    const instance = withoutUndefined({
      prompt: inputs.text.prompt,
      image: veoFrame(firstOf(inputs.media.image)),
      lastFrame: veoFrame(firstOf(inputs.media.last_frame))
    })
    return {
      ok: true,
      body: {
        instances: [instance],
        parameters: withoutUndefined({
          negativePrompt: inputs.text.negative_prompt || undefined
        })
      }
    }
  },
  readResult: readVeo
}

function seedanceFrame(
  media: EncodedMedia | undefined,
  role: string
): JsonValue[] {
  return media
    ? [{ type: 'image_url', image_url: { url: media.data }, role }]
    : []
}

function readSeedance(json: unknown): OutputsOutcome {
  const status = stringAt(json, ['status'])
  const message = stringAt(json, ['error', 'message'])
  if (status !== undefined && status !== 'succeeded') {
    return { ok: false, message: message ?? status }
  }
  const url = stringAt(json, ['content', 'video_url'])
  return url
    ? { ok: true, outputs: [{ kind: 'url', url }] }
    : { ok: false, message }
}

const seedance: RouterFamily = {
  id: 'seedance',
  matches: (modelId) => /^byteplus\/(dreamina-)?seedance/.test(modelId),
  transport: 'queue',
  ports: () => [
    textPort('prompt', { required: true }),
    singleMediaPort({
      name: 'image',
      modality: 'image',
      encoding: 'dataUrl',
      labelKey: 'first_frame'
    }),
    singleMediaPort({
      name: 'last_frame',
      modality: 'image',
      encoding: 'dataUrl'
    })
  ],
  settingsRoots: [[]],
  excludeSettings: [
    'content',
    'draft',
    'execution_expires_after',
    'return_last_frame',
    'service_tier',
    'watermark'
  ],
  extraSettings: [],
  fixed: [{ path: ['watermark'], value: false }],
  buildBody: ({ inputs }) => {
    const prompt = inputs.text.prompt
    return {
      ok: true,
      body: {
        content: [
          ...(prompt ? [{ type: 'text', text: prompt }] : []),
          ...seedanceFrame(firstOf(inputs.media.image), 'first_frame'),
          ...seedanceFrame(firstOf(inputs.media.last_frame), 'last_frame')
        ]
      }
    }
  },
  readResult: readSeedance
}

function readKling(json: unknown): OutputsOutcome {
  const status = stringAt(json, ['data', 'task_status'])
  if (status !== 'succeed') {
    return {
      ok: false,
      message: stringAt(json, ['data', 'task_status_msg']) ?? status
    }
  }
  const url = stringAt(json, ['data', 'task_result', 'videos', 0, 'url'])
  return url ? { ok: true, outputs: [{ kind: 'url', url }] } : { ok: false }
}

const KLING_OMNI_MODELS: ReadonlySet<string> = new Set([
  'kling/kling-v3-omni',
  'kling/kling-video-o1'
])

const klingOmni: RouterFamily = {
  id: 'klingOmni',
  matches: (modelId) => KLING_OMNI_MODELS.has(modelId),
  transport: 'queue',
  ports: () => [
    textPort('prompt', { required: true }),
    singleMediaPort({
      name: 'image',
      modality: 'image',
      encoding: 'base64',
      labelKey: 'first_frame'
    }),
    singleMediaPort({
      name: 'last_frame',
      modality: 'image',
      encoding: 'base64'
    })
  ],
  settingsRoots: [[]],
  excludeSettings: [
    'prompt',
    'image_list',
    'video_list',
    'element_list',
    'multi_prompt',
    'multi_shot',
    'shot_type',
    'watermark_info'
  ],
  extraSettings: [],
  fixed: [{ path: ['watermark_info'], value: { enabled: false } }],
  buildBody: ({ inputs }) => {
    const first = firstOf(inputs.media.image)
    const last = firstOf(inputs.media.last_frame)
    if (last && !first) return { ok: false, reason: 'needsFirstFrame' }
    const imageList: JsonValue[] = [
      ...(first ? [{ image_url: first.data, type: 'first_frame' }] : []),
      ...(last ? [{ image_url: last.data, type: 'end_frame' }] : [])
    ]
    return {
      ok: true,
      body: withoutUndefined({
        prompt: inputs.text.prompt,
        image_list: imageList.length > 0 ? imageList : undefined
      })
    }
  },
  readResult: readKling
}

function voiceOf(values: Record<string, SettingValue>): string {
  const voice = values.voice_id
  return typeof voice === 'string' && voice !== '' ? voice : PREMADE_VOICES[0]
}

const elevenlabsDialogue: RouterFamily = {
  id: 'elevenlabsDialogue',
  matches: (modelId) =>
    modelId === 'elevenlabs/eleven_v3' ||
    modelId.startsWith('elevenlabs/eleven_v4'),
  transport: 'sync',
  ports: () => [textPort('prompt', { required: true })],
  settingsRoots: [[], ['settings']],
  excludeSettings: ['inputs', 'pronunciation_dictionary_locators', 'settings'],
  extraSettings: [
    {
      control: 'select',
      name: 'voice_id',
      label: humanizeKey('voice_id'),
      options: PREMADE_VOICES,
      default: PREMADE_VOICES[0],
      required: true
    }
  ],
  fixed: [],
  buildBody: ({ inputs, values }) => ({
    ok: true,
    body: {
      inputs: [{ text: inputs.text.prompt ?? '', voice_id: voiceOf(values) }]
    }
  }),
  readResult: (json) => ({ ok: false, message: stringAt(json, ['detail']) })
}

const ROUTER_FAMILIES: readonly RouterFamily[] = [
  veo,
  seedance,
  klingOmni,
  elevenlabsDialogue
]

export function findRouterFamily(modelId: string): RouterFamily | undefined {
  return ROUTER_FAMILIES.find((family) => family.matches(modelId))
}
