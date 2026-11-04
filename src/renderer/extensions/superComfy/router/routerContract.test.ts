import { pick } from 'es-toolkit'
import { describe, expect, it } from 'vitest'

import type {
  Modality,
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  docWith,
  edge,
  generateNode,
  ioNode
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import {
  initialRuntime,
  mergeContractValues,
  reduceSuperComfy
} from '@/renderer/extensions/superComfy/engine/reduce'
import {
  deriveRouterContract,
  summarizeRouterSchema,
  toGenerateContract
} from '@/renderer/extensions/superComfy/router/routerContract'
import type { RouterModelSummary } from '@/renderer/extensions/superComfy/router/routerContract'
import type { FixtureId } from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import {
  contractFrom,
  fixtureContract,
  fixtureDoc
} from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import type {
  FixedValue,
  OpenApiDoc,
  RouterContract,
  RouterPortSpec
} from '@/renderer/extensions/superComfy/router/routerTypes'

type PortSummary = Pick<
  RouterPortSpec,
  'name' | 'modality' | 'required' | 'multi' | 'max' | 'encoding'
>

interface ContractRow {
  id: FixtureId
  modality: Modality
  shape: RouterContract['shape']
  transport: RouterContract['transport']
  ports: PortSummary[]
  settings: string[]
  fixed: FixedValue[]
}

function summarize(contract: RouterContract) {
  return {
    shape: contract.shape,
    transport: contract.transport,
    ports: contract.inputs.map((port) =>
      pick(port, ['name', 'modality', 'required', 'multi', 'max', 'encoding'])
    ),
    settings: contract.settings.map(({ name }) => name),
    fixed: contract.fixed
  }
}

function settingOf(contract: RouterContract, name: string) {
  return contract.settings.find((setting) => setting.name === name)
}

function withInputModalities(doc: OpenApiDoc, inputs: string[]): OpenApiDoc {
  return { ...doc, 'x-comfy-router-input-modalities': inputs }
}

const prompt = (required: boolean): PortSummary => ({
  name: 'prompt',
  modality: 'text',
  required,
  multi: false
})

const optionalText = (name: string): PortSummary => ({
  name,
  modality: 'text',
  required: false,
  multi: false
})

describe('deriveRouterContract', () => {
  it.for<ContractRow>([
    {
      id: 'bfl/flux-2-pro',
      modality: 'image',
      shape: 'flat',
      transport: 'queue',
      ports: [
        prompt(true),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          max: 9,
          encoding: 'base64'
        }
      ],
      settings: [
        'output_format',
        'height',
        'safety_tolerance',
        'seed',
        'width',
        'prompt_upsampling'
      ],
      fixed: []
    },
    {
      id: 'openai/gpt-image-2',
      modality: 'image',
      shape: 'flat',
      transport: 'queue',
      ports: [
        prompt(true),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          max: 16,
          encoding: 'dataUrl'
        }
      ],
      settings: [
        'background',
        'moderation',
        'output_format',
        'quality',
        'output_compression',
        'size'
      ],
      fixed: [{ path: ['n'], value: 1 }]
    },
    {
      id: 'byteplus/seedream-5-0-260128',
      modality: 'image',
      shape: 'flat',
      transport: 'queue',
      ports: [
        prompt(false),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          max: 14,
          encoding: 'dataUrl'
        }
      ],
      settings: [
        'output_format',
        'response_format',
        'guidance_scale',
        'seed',
        'size',
        'layer_decomposition',
        'watermark'
      ],
      fixed: [{ path: ['sequential_image_generation'], value: 'disabled' }]
    },
    {
      id: 'kling/kling-v3',
      modality: 'video',
      shape: 'flat',
      transport: 'queue',
      ports: [prompt(false), optionalText('negative_prompt')],
      settings: [
        'aspect_ratio',
        'duration',
        'mode',
        'shot_type',
        'sound',
        'cfg_scale',
        'multi_shot'
      ],
      fixed: []
    },
    {
      id: 'meshy/meshy-7.1',
      modality: '3d',
      shape: 'flat',
      transport: 'queue',
      ports: [prompt(true)],
      settings: [
        'art_style',
        'geometry_resolution',
        'mode',
        'pose_mode',
        'symmetry_mode',
        'topology',
        'target_polycount',
        'is_a_t_pose',
        'moderation',
        'should_remesh'
      ],
      fixed: []
    },
    {
      id: 'elevenlabs/eleven_sfx_v2',
      modality: 'audio',
      shape: 'flat',
      transport: 'sync',
      ports: [prompt(true)],
      settings: ['duration_seconds', 'prompt_influence', 'loop'],
      fixed: []
    },
    {
      id: 'anthropic/claude-haiku-4-5-20251001',
      modality: 'text',
      shape: 'anthropicMessages',
      transport: 'sync',
      ports: [
        prompt(true),
        optionalText('system'),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          max: 20,
          encoding: 'base64'
        }
      ],
      settings: ['max_tokens'],
      fixed: []
    },
    {
      id: 'vertexai/gemini-3-pro-image',
      modality: 'image',
      shape: 'geminiContents',
      transport: 'queue',
      ports: [
        prompt(true),
        optionalText('system'),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          max: 14,
          encoding: 'base64'
        }
      ],
      settings: [
        'maxOutputTokens',
        'seed',
        'temperature',
        'topK',
        'topP',
        'aspectRatio',
        'imageSize'
      ],
      fixed: [
        {
          path: ['generationConfig', 'responseModalities'],
          value: ['TEXT', 'IMAGE']
        }
      ]
    },
    {
      id: 'openai/gpt-5-mini',
      modality: 'text',
      shape: 'openaiResponses',
      transport: 'sync',
      ports: [
        prompt(true),
        optionalText('system'),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: true,
          encoding: 'dataUrl'
        }
      ],
      settings: ['effort', 'max_output_tokens', 'temperature', 'top_p'],
      fixed: []
    },
    {
      id: 'veo/veo-3.1-generate-001',
      modality: 'video',
      shape: 'family',
      transport: 'queue',
      ports: [
        prompt(true),
        optionalText('negative_prompt'),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'base64'
        },
        {
          name: 'last_frame',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'base64'
        }
      ],
      settings: [
        'aspectRatio',
        'compressionQuality',
        'resizeMode',
        'resolution',
        'durationSeconds',
        'seed',
        'generateAudio'
      ],
      fixed: [
        { path: ['parameters', 'sampleCount'], value: 1 },
        { path: ['parameters', 'personGeneration'], value: 'allow_adult' }
      ]
    },
    {
      id: 'byteplus/dreamina-seedance-2-0-260128',
      modality: 'video',
      shape: 'family',
      transport: 'queue',
      ports: [
        prompt(true),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'dataUrl'
        },
        {
          name: 'last_frame',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'dataUrl'
        }
      ],
      settings: [
        'duration',
        'output_format',
        'ratio',
        'resolution',
        'seed',
        'generate_audio'
      ],
      fixed: [{ path: ['watermark'], value: false }]
    },
    {
      id: 'kling/kling-v3-omni',
      modality: 'video',
      shape: 'family',
      transport: 'queue',
      ports: [
        prompt(true),
        {
          name: 'image',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'base64'
        },
        {
          name: 'last_frame',
          modality: 'image',
          required: false,
          multi: false,
          encoding: 'base64'
        }
      ],
      settings: ['aspect_ratio', 'duration', 'mode', 'sound'],
      fixed: [{ path: ['watermark_info'], value: { enabled: false } }]
    },
    {
      id: 'elevenlabs/eleven_v3',
      modality: 'audio',
      shape: 'family',
      transport: 'sync',
      ports: [prompt(true)],
      settings: [
        'apply_text_normalization',
        'voice_id',
        'seed',
        'stability',
        'language_code'
      ],
      fixed: []
    }
  ])(
    '$id maps to $shape ports and settings',
    ({ id, modality, ...expected }) => {
      expect(summarize(fixtureContract(id, modality))).toEqual(expected)
    }
  )

  it('collapses numbered image siblings into one port spread over their keys', () => {
    const image = fixtureContract('bfl/flux-2-pro', 'image').inputs.find(
      (port) => port.name === 'image'
    )

    expect(image?.numbered).toEqual([
      'input_image',
      'input_image_2',
      'input_image_3',
      'input_image_4',
      'input_image_5',
      'input_image_6',
      'input_image_7',
      'input_image_8',
      'input_image_9'
    ])
  })

  it.for<{
    name: string
    id: FixtureId
    modality: Modality
    setting: string
    expected: Partial<SettingSpec>
  }>([
    {
      name: 'max_tokens defaults to 1024 when the schema requires it without a default',
      id: 'anthropic/claude-haiku-4-5-20251001',
      modality: 'text',
      setting: 'max_tokens',
      expected: { control: 'number', default: 1024, required: true }
    },
    {
      name: 'a required enum without a default takes its first option',
      id: 'meshy/meshy-7.1',
      modality: '3d',
      setting: 'mode',
      expected: {
        control: 'select',
        options: ['preview'],
        default: 'preview',
        required: true
      }
    },
    {
      name: 'a required number without a default takes its minimum',
      id: 'elevenlabs/eleven_sfx_v2',
      modality: 'audio',
      setting: 'duration_seconds',
      expected: { control: 'number', min: 0.5, max: 30, default: 0.5 }
    },
    {
      name: 'a declared default is kept',
      id: 'kling/kling-v3',
      modality: 'video',
      setting: 'duration',
      expected: { control: 'select', default: '5', required: false }
    }
  ])('$name', ({ id, modality, setting, expected }) => {
    expect(settingOf(fixtureContract(id, modality), setting)).toMatchObject(
      expected
    )
  })

  it('gives no port to a media field whose modality the model does not take', () => {
    const doc = withInputModalities(fixtureDoc('bfl/flux-2-pro'), ['text'])

    const contract = contractFrom('bfl/flux-2-pro', doc, 'image')

    expect(contract.inputs.map(({ name }) => name)).toEqual(['prompt'])
  })

  it.for<{
    name: string
    id: string
    doc: OpenApiDoc
    reason: 'unsupportedShape' | 'notAuthored'
  }>([
    {
      name: 'a real schema with no prompt, chat or family shape',
      id: 'meshy/rigging',
      doc: fixtureDoc('meshy/rigging'),
      reason: 'unsupportedShape'
    },
    {
      name: 'a crafted schema with an unknown shape',
      id: 'acme/unknown',
      doc: {
        paths: {
          '/v2/models/acme/unknown': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { task_id: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      reason: 'unsupportedShape'
    },
    {
      name: 'a schema Router marks as not authored',
      id: 'bfl/flux-2-pro',
      doc: {
        ...fixtureDoc('bfl/flux-2-pro'),
        'x-comfy-input-schema-authored': false
      },
      reason: 'notAuthored'
    }
  ])('refuses $name', ({ id, doc, reason }) => {
    expect(deriveRouterContract(id, doc, 'image')).toEqual({
      ok: false,
      reason
    })
  })
})

describe('summarizeRouterSchema', () => {
  it.for<{
    id: string
    doc: OpenApiDoc
    expected: Pick<RouterModelSummary, 'primary' | 'status'>
  }>([
    {
      id: 'veo/veo-3.1-generate-001',
      doc: fixtureDoc('veo/veo-3.1-generate-001'),
      expected: { primary: 'video', status: 'supported' }
    },
    {
      id: 'vertexai/gemini-3-pro-image',
      doc: fixtureDoc('vertexai/gemini-3-pro-image'),
      expected: { primary: 'image', status: 'supported' }
    },
    {
      id: 'meshy/rigging',
      doc: fixtureDoc('meshy/rigging'),
      expected: { primary: '3d', status: 'unsupported' }
    },
    {
      id: 'fal/fal-flux',
      doc: {
        ...fixtureDoc('bfl/flux-2-pro'),
        'x-comfy-input-schema-authored': false
      },
      expected: { primary: 'image', status: 'hidden' }
    }
  ])('$id is $expected.status', ({ id, doc, expected }) => {
    expect(summarizeRouterSchema(id, 'etag-1', doc)).toEqual({
      id,
      etag: 'etag-1',
      ...expected
    })
  })
})

describe('switching models', () => {
  it.for<{
    name: string
    values: Record<string, SettingValue>
    expected: Record<string, SettingValue>
  }>([
    {
      name: 'keeps values flux still accepts',
      values: { output_format: 'png', background: 'auto' },
      expected: { output_format: 'png' }
    },
    {
      name: 'drops a value outside the new options',
      values: { output_format: 'webp' },
      expected: {}
    }
  ])('$name', ({ values, expected }) => {
    const settings = fixtureContract('bfl/flux-2-pro', 'image').settings

    expect(mergeContractValues(values, settings)).toEqual(expected)
  })

  it.for([
    {
      name: 'gpt-image-2 keeps the prompt and image edges',
      next: fixtureContract('openai/gpt-image-2', 'image'),
      ports: ['prompt', 'image']
    },
    {
      name: 'a text-only model drops the image edge',
      next: contractFrom(
        'bfl/flux-2-pro',
        withInputModalities(fixtureDoc('bfl/flux-2-pro'), ['text']),
        'image'
      ),
      ports: ['prompt']
    }
  ])('picking flux then $name', ({ next, ports }) => {
    const flux = toGenerateContract(fixtureContract('bfl/flux-2-pro', 'image'))
    const doc = docWith(
      [
        ioNode('words', 'text'),
        ioNode('pictures', 'image'),
        {
          ...generateNode('gen', 'image'),
          modelId: 'bfl/flux-2-pro',
          contract: flux
        }
      ],
      [
        edge('words', 'out', 'gen', 'prompt'),
        edge('pictures', 'out', 'gen', 'image')
      ]
    )
    const picked = reduceSuperComfy(
      { doc, runtime: initialRuntime() },
      { type: 'modelPicked', nodeId: 'gen', modelId: next.modelId }
    )

    const resolved = reduceSuperComfy(picked, {
      type: 'modelContractResolved',
      nodeId: 'gen',
      modelId: next.modelId,
      modelLabel: 'next',
      contract: toGenerateContract(next)
    })

    expect(resolved.doc.edges.map(({ to }) => to.port)).toEqual(ports)
  })
})
