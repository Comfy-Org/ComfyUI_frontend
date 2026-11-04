import { describe, expect, it } from 'vitest'

import type { SettingValue } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { buildRouterBody } from '@/renderer/extensions/superComfy/router/routerBody'
import {
  contractFrom,
  fixtureContract
} from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import type {
  EncodedInputs,
  EncodedMedia,
  JsonObject,
  OpenApiDoc,
  RouterContract
} from '@/renderer/extensions/superComfy/router/routerTypes'

function png(data: string): EncodedMedia {
  return { data, mime: 'image/png' }
}

const chatDoc: OpenApiDoc = {
  paths: {
    '/v2/models/acme/chat': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: { type: 'array', items: { type: 'object' } },
                  temperature: { type: 'number', minimum: 0, maximum: 2 }
                }
              }
            }
          }
        }
      }
    }
  },
  'x-comfy-router-input-modalities': ['text', 'image'],
  'x-comfy-router-output-modalities': ['text']
}

interface BodyRow {
  name: string
  contract: RouterContract
  inputs: EncodedInputs
  values: Record<string, SettingValue>
  body: JsonObject
}

describe('buildRouterBody', () => {
  it.for<BodyRow>([
    {
      name: 'flat spreads numbered image fields in order',
      contract: fixtureContract('bfl/flux-2-pro', 'image'),
      inputs: {
        text: { prompt: 'a fox' },
        media: { image: [png('AAA'), png('BBB')] }
      },
      values: { width: 512 },
      body: {
        prompt: 'a fox',
        input_image: 'AAA',
        input_image_2: 'BBB',
        width: 512
      }
    },
    {
      name: 'flat sends an array field and fixes the count to one',
      contract: fixtureContract('openai/gpt-image-2', 'image'),
      inputs: {
        text: { prompt: 'a fox' },
        media: {
          image: [
            png('data:image/png;base64,AAA'),
            png('data:image/png;base64,BBB')
          ]
        }
      },
      values: {},
      body: {
        prompt: 'a fox',
        image: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB'],
        n: 1
      }
    },
    {
      name: 'flat drops an emptied setting and places the fixed value',
      contract: fixtureContract('byteplus/seedream-5-0-260128', 'image'),
      inputs: { text: { prompt: 'a fox' }, media: {} },
      values: { size: '', seed: 7 },
      body: {
        prompt: 'a fox',
        seed: 7,
        sequential_image_generation: 'disabled'
      }
    },
    {
      name: 'flat writes the prompt to the text field and sends required defaults',
      contract: fixtureContract('elevenlabs/eleven_sfx_v2', 'audio'),
      inputs: { text: { prompt: 'rain on a tin roof' }, media: {} },
      values: {},
      body: { text: 'rain on a tin roof', duration_seconds: 0.5 }
    },
    {
      name: 'flat sends the negative prompt',
      contract: fixtureContract('kling/kling-v3', 'video'),
      inputs: {
        text: { prompt: 'a fox runs', negative_prompt: 'blur' },
        media: {}
      },
      values: { mode: 'pro' },
      body: { prompt: 'a fox runs', negative_prompt: 'blur', mode: 'pro' }
    },
    {
      name: 'anthropic messages put images before the text',
      contract: fixtureContract('anthropic/claude-haiku-4-5-20251001', 'text'),
      inputs: {
        text: { prompt: 'Describe it', system: 'Be brief' },
        media: { image: [png('AAA')] }
      },
      values: { max_tokens: 16 },
      body: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: 'AAA' }
              },
              { type: 'text', text: 'Describe it' }
            ]
          }
        ],
        system: 'Be brief',
        max_tokens: 16
      }
    },
    {
      name: 'openai chat sends a system message first',
      contract: contractFrom('acme/chat', chatDoc, 'text'),
      inputs: {
        text: { prompt: 'Describe it', system: 'Be brief' },
        media: { image: [png('data:image/png;base64,AAA')] }
      },
      values: { temperature: 0.2 },
      body: {
        messages: [
          { role: 'system', content: 'Be brief' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe it' },
              {
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,AAA' }
              }
            ]
          }
        ],
        temperature: 0.2
      }
    },
    {
      name: 'openai responses nest the reasoning effort',
      contract: fixtureContract('openai/gpt-5-mini', 'text'),
      inputs: {
        text: { prompt: 'Describe it', system: 'Be brief' },
        media: { image: [png('data:image/png;base64,AAA')] }
      },
      values: { effort: 'low' },
      body: {
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Describe it' },
              { type: 'input_image', image_url: 'data:image/png;base64,AAA' }
            ]
          }
        ],
        instructions: 'Be brief',
        reasoning: { effort: 'low' }
      }
    },
    {
      name: 'gemini places image settings under generationConfig',
      contract: fixtureContract('vertexai/gemini-3-pro-image', 'image'),
      inputs: {
        text: { prompt: 'A cat', system: 'Watercolour' },
        media: { image: [png('AAA')] }
      },
      values: { aspectRatio: '16:9', temperature: 0.5 },
      body: {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'A cat' },
              { inlineData: { mimeType: 'image/png', data: 'AAA' } }
            ]
          }
        ],
        systemInstruction: { parts: [{ text: 'Watercolour' }] },
        generationConfig: {
          temperature: 0.5,
          imageConfig: { aspectRatio: '16:9' },
          responseModalities: ['TEXT', 'IMAGE']
        }
      }
    },
    {
      name: 'veo nests the frame and parameters',
      contract: fixtureContract('veo/veo-3.1-generate-001', 'video'),
      inputs: {
        text: { prompt: 'a fox runs', negative_prompt: 'blur' },
        media: { image: [{ data: 'AAA', mime: 'image/jpeg' }] }
      },
      values: { aspectRatio: '9:16' },
      body: {
        instances: [
          {
            prompt: 'a fox runs',
            image: { bytesBase64Encoded: 'AAA', mimeType: 'image/jpeg' }
          }
        ],
        parameters: {
          negativePrompt: 'blur',
          aspectRatio: '9:16',
          sampleCount: 1,
          personGeneration: 'allow_adult'
        }
      }
    },
    {
      name: 'seedance lists frames by role and turns the watermark off',
      contract: fixtureContract(
        'byteplus/dreamina-seedance-2-0-260128',
        'video'
      ),
      inputs: {
        text: { prompt: 'a fox runs' },
        media: { image: [png('data:A')], last_frame: [png('data:B')] }
      },
      values: { duration: 5 },
      body: {
        content: [
          { type: 'text', text: 'a fox runs' },
          {
            type: 'image_url',
            image_url: { url: 'data:A' },
            role: 'first_frame'
          },
          {
            type: 'image_url',
            image_url: { url: 'data:B' },
            role: 'last_frame'
          }
        ],
        duration: 5,
        watermark: false
      }
    },
    {
      name: 'kling omni lists the first and end frames',
      contract: fixtureContract('kling/kling-v3-omni', 'video'),
      inputs: {
        text: { prompt: 'a fox runs' },
        media: { image: [png('AAA')], last_frame: [png('BBB')] }
      },
      values: {},
      body: {
        prompt: 'a fox runs',
        image_list: [
          { image_url: 'AAA', type: 'first_frame' },
          { image_url: 'BBB', type: 'end_frame' }
        ],
        watermark_info: { enabled: false }
      }
    },
    {
      name: 'elevenlabs dialogue sends the default voice and nested stability',
      contract: fixtureContract('elevenlabs/eleven_v3', 'audio'),
      inputs: { text: { prompt: 'Hello there' }, media: {} },
      values: { stability: 0.3 },
      body: {
        inputs: [{ text: 'Hello there', voice_id: '21m00Tcm4TlvDq8ikWAM' }],
        settings: { stability: 0.3 }
      }
    }
  ])('$name', ({ contract, inputs, values, body }) => {
    expect(buildRouterBody(contract, inputs, values)).toEqual({
      ok: true,
      body
    })
  })

  it('refuses a kling omni end frame without a first frame', () => {
    const contract = fixtureContract('kling/kling-v3-omni', 'video')

    expect(
      buildRouterBody(
        contract,
        { text: { prompt: 'a fox runs' }, media: { last_frame: [png('BBB')] } },
        {}
      )
    ).toEqual({ ok: false, reason: 'needsFirstFrame' })
  })
})
