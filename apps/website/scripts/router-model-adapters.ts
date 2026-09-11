import { z } from 'astro/zod'

import { valuesAtPointer } from '../src/config/workshop-json-pointer'

import type {
  WorkshopContract,
  WorkshopMediaBinding
} from '../src/config/workshop-contract'

const mediaBindings: Readonly<
  Partial<Record<string, readonly WorkshopMediaBinding[]>>
> = {
  'bfl/erase-v1': imageAndMask(),
  'bria/image-edit-erase': imageAndMask(),
  'bria/image-edit-gen-fill': imageAndMask()
}

function imageAndMask(): WorkshopMediaBinding[] {
  return ['image', 'mask'].map((name) => ({
    name,
    label: name === 'image' ? 'Source image' : 'Mask',
    accept: 'image',
    encoding: 'base64',
    targets: [`/${name}`],
    required: true
  }))
}

export function adaptRouterModel(contract: WorkshopContract): WorkshopContract {
  if (['wan/wan3.0-video', 'wan/wan3.0-video-prime'].includes(contract.id))
    return { ...contract, rehostUrlInputs: true }
  if (['luma/photon-1', 'luma/photon-flash-1'].includes(contract.id)) {
    const output = contract.output
    if (output.format === 'binary' || !output.schema)
      throw new Error('Missing Luma image response schema')
    return {
      ...contract,
      output: {
        format: 'json',
        schema: output.schema,
        success: {
          path: '/state',
          values: ['completed'],
          caseInsensitive: false
        },
        selectors: [{ path: '/assets/image', encoding: 'url', kind: 'image' }]
      }
    }
  }
  if (contract.id === 'bfl/flux-3-video') {
    const slug = 'bfl--flux-3-video-continuation--edit-videos'
    const continuation = contract.creatorVariants?.[slug]
    if (!continuation) return contract
    const properties = z
      .record(z.string(), z.json())
      .parse(continuation.parameters.properties)
    return {
      ...contract,
      creatorVariants: {
        ...contract.creatorVariants,
        [slug]: {
          ...continuation,
          parameters: {
            ...continuation.parameters,
            properties: {
              ...properties,
              duration: {
                default: 'auto',
                oneOf: [
                  { type: 'integer', minimum: 5, maximum: 15 },
                  { type: 'string', const: 'auto' }
                ],
                enum: ['auto', ...Array.from({ length: 11 }, (_, i) => i + 5)]
              }
            }
          }
        }
      }
    }
  }
  if (contract.id === 'bfl/vto-v1' && contract.inputs) {
    return {
      ...contract,
      inputs: {
        ...contract.inputs,
        person: { ...contract.inputs.person, urlUpload: 'image' },
        garment: { ...contract.inputs.garment, urlUpload: 'image' }
      }
    }
  }
  if (contract.id === 'kling/videos-lip-sync' && contract.creator) {
    return {
      ...contract,
      creatorVariants: {
        ...contract.creatorVariants,
        'kling--lip-sync-text-to-video--edit-videos': {
          parameters: {
            type: 'object',
            properties: {
              video_url: { type: 'string' },
              text: {
                type: 'string',
                maxLength: 120,
                default: 'Welcome to Comfy Cloud.'
              },
              voice_id: { type: 'string', default: 'genshin_vindi2' }
            },
            required: ['video_url', 'text', 'voice_id']
          },
          inputs: {
            video_url: contract.creator.inputs.video_url,
            text: {
              label: 'Text',
              help: '',
              hidden: false,
              advanced: false,
              control: 'text-area'
            },
            voice_id: {
              label: 'Voice ID',
              help: '',
              hidden: false,
              advanced: true,
              control: 'text-box'
            }
          },
          files: [],
          request: {
            kind: 'template',
            template:
              '{"input":{"mode":"text2video","video_url":$repl_string("video_url"),"text":$repl_string("text"),"voice_id":$repl_string("voice_id"),"voice_language":"en","voice_speed":1}}'
          }
        }
      }
    }
  }
  const media = mediaBindings[contract.id]
  const output = contract.output
  if (
    contract.id === 'bria/image-edit-gen-fill' &&
    output.format !== 'binary' &&
    output.schema
  ) {
    const schema = structuredClone(output.schema)
    const [refinedPrompt] = valuesAtPointer(
      schema,
      '/components/schemas/BriaStatusResponse/properties/result/properties/refined_prompt'
    )
    if (
      !refinedPrompt ||
      typeof refinedPrompt !== 'object' ||
      !('type' in refinedPrompt) ||
      refinedPrompt.type !== 'string'
    )
      throw new Error('Unexpected Bria refined_prompt schema')
    refinedPrompt.type = ['string', 'null']
    return {
      ...contract,
      output: { ...output, schema },
      media: [...contract.media, ...(media ?? [])]
    }
  }
  return media
    ? { ...contract, media: [...contract.media, ...media] }
    : contract
}
