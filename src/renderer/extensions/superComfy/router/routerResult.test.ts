import { describe, expect, it } from 'vitest'

import { fixtureContract } from '@/renderer/extensions/superComfy/router/fixtures/routerFixtures'
import { extractRouterOutputs } from '@/renderer/extensions/superComfy/router/routerResult'
import type {
  OutputsOutcome,
  RouterContract
} from '@/renderer/extensions/superComfy/router/routerTypes'

interface ResultRow {
  name: string
  contract: RouterContract
  json: unknown
  expected: OutputsOutcome
}

const claude = fixtureContract('anthropic/claude-haiku-4-5-20251001', 'text')
const gpt5 = fixtureContract('openai/gpt-5-mini', 'text')
const flux = fixtureContract('bfl/flux-2-pro', 'image')
const geminiImage = fixtureContract('vertexai/gemini-3-pro-image', 'image')
const veo = fixtureContract('veo/veo-3.1-generate-001', 'video')
const seedance = fixtureContract(
  'byteplus/dreamina-seedance-2-0-260128',
  'video'
)
const klingOmni = fixtureContract('kling/kling-v3-omni', 'video')
const meshy = fixtureContract('meshy/meshy-7.1', '3d')
const chat: RouterContract = { ...gpt5, shape: 'openaiChat' }
const geminiText: RouterContract = {
  ...geminiImage,
  modality: 'text',
  output: { ...geminiImage.output, modality: 'text' }
}

describe('extractRouterOutputs', () => {
  it.for<ResultRow>([
    {
      name: 'anthropic joins its text blocks',
      contract: claude,
      json: {
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'tool_use', name: 'x' },
          { type: 'text', text: 'world' }
        ]
      },
      expected: { ok: true, outputs: [{ kind: 'text', text: 'Hello world' }] }
    },
    {
      name: 'openai chat reads the first choice',
      contract: chat,
      json: { choices: [{ message: { content: 'Hi there' } }] },
      expected: { ok: true, outputs: [{ kind: 'text', text: 'Hi there' }] }
    },
    {
      name: 'openai responses prefer output_text',
      contract: gpt5,
      json: { output_text: 'Short answer', output: [] },
      expected: { ok: true, outputs: [{ kind: 'text', text: 'Short answer' }] }
    },
    {
      name: 'openai responses fall back to message output parts',
      contract: gpt5,
      json: {
        output: [
          { type: 'reasoning', summary: [] },
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Long ' },
              { type: 'output_text', text: 'answer' }
            ]
          }
        ]
      },
      expected: { ok: true, outputs: [{ kind: 'text', text: 'Long answer' }] }
    },
    {
      name: 'gemini skips thought parts',
      contract: geminiText,
      json: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'thinking...', thought: true },
                { text: 'The answer' }
              ]
            }
          }
        ]
      },
      expected: { ok: true, outputs: [{ kind: 'text', text: 'The answer' }] }
    },
    {
      name: 'gemini images ignore the text parts',
      contract: geminiImage,
      json: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is your cat' },
                { inlineData: { mimeType: 'image/png', data: 'AAA' } }
              ]
            }
          }
        ]
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'base64', data: 'AAA', mime: 'image/png' }]
      }
    },
    {
      name: 'the media walk skips echoed inputs',
      contract: flux,
      json: {
        input: { image_url: 'https://cdn.example/input.png' },
        result: { sample: 'https://cdn.example/out.jpeg?sig=1' }
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'url', url: 'https://cdn.example/out.jpeg?sig=1' }]
      }
    },
    {
      name: 'the media walk keeps base64 without a mime as the modality default',
      contract: flux,
      json: { data: [{ b64_json: 'BBB' }] },
      expected: {
        ok: true,
        outputs: [{ kind: 'base64', data: 'BBB', mime: 'image/png' }]
      }
    },
    {
      name: 'a 3D result keeps only the glb model',
      contract: meshy,
      json: {
        status: 'SUCCEEDED',
        thumbnail_url: 'https://cdn.example/thumb.png',
        model_urls: {
          fbx: 'https://cdn.example/m.fbx',
          glb: 'https://cdn.example/m.glb',
          obj: 'https://cdn.example/m.obj'
        }
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'url', url: 'https://cdn.example/m.glb' }]
      }
    },
    {
      name: 'veo prefers inline bytes',
      contract: veo,
      json: {
        response: {
          videos: [
            {
              bytesBase64Encoded: 'VVV',
              mimeType: 'video/mp4',
              gcsUri: 'https://storage.example/v.mp4'
            }
          ]
        }
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'base64', data: 'VVV', mime: 'video/mp4' }]
      }
    },
    {
      name: 'veo falls back to an https gcsUri',
      contract: veo,
      json: {
        response: { videos: [{ gcsUri: 'https://storage.example/v.mp4' }] }
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'url', url: 'https://storage.example/v.mp4' }]
      }
    },
    {
      name: 'veo reports filtered reasons when there is no video',
      contract: veo,
      json: {
        response: { raiMediaFilteredReasons: ['Unsafe content', 'Faces'] }
      },
      expected: { ok: false, message: 'Unsafe content; Faces' }
    },
    {
      name: 'seedance reads the video url',
      contract: seedance,
      json: {
        status: 'succeeded',
        content: {
          video_url: 'https://cdn.example/v.mp4',
          last_frame_url: 'https://cdn.example/last.png'
        }
      },
      expected: {
        ok: true,
        outputs: [{ kind: 'url', url: 'https://cdn.example/v.mp4' }]
      }
    },
    {
      name: 'seedance fails with its error message',
      contract: seedance,
      json: { status: 'failed', error: { message: 'Sensitive content' } },
      expected: { ok: false, message: 'Sensitive content' }
    },
    {
      name: 'kling fails unless the task succeeded',
      contract: klingOmni,
      json: {
        data: { task_status: 'failed', task_status_msg: 'Image too small' }
      },
      expected: { ok: false, message: 'Image too small' }
    },
    {
      name: 'no output fails with the server error',
      contract: flux,
      json: { status: 'Error', error: { message: 'Request moderated' } },
      expected: { ok: false, message: 'Request moderated' }
    },
    {
      name: 'no output and no error fails without a message',
      contract: flux,
      json: { status: 'Pending' },
      expected: { ok: false }
    }
  ])('$name', ({ contract, json, expected }) => {
    expect(
      extractRouterOutputs(contract, { json, contentType: 'application/json' })
    ).toEqual(expected)
  })

  it('passes a binary response through as one blob', () => {
    const blob = new Blob(['ID3'], { type: 'audio/mpeg' })

    expect(
      extractRouterOutputs(fixtureContract('elevenlabs/eleven_v3', 'audio'), {
        blob,
        contentType: 'audio/mpeg'
      })
    ).toEqual({ ok: true, outputs: [{ kind: 'blob', blob }] })
  })
})
