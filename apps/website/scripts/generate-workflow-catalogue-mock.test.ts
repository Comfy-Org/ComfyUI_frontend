import { describe, expect, it } from 'vitest'

import {
  buildWorkflowCatalogueMock,
  classifyTemplate
} from './generate-workflow-catalogue-mock'

function template(name: string, title: string, tags: string[] = []) {
  return { name, title, tags, models: [] }
}

const IMAGE = { title: 'Image', type: 'image' }
const VIDEO = { title: 'Video', type: 'video' }

describe('classifyTemplate', () => {
  it.for([
    [
      template('api_kling_vto', 'Kling: Virtual Try On', ['Virtual Try-On']),
      IMAGE,
      { modality: 'image', task: 'edit', collections: ['product'] }
    ],
    [
      template('image_z_image_turbo', 'Z-Image-Turbo: Text to Image', [
        'Text to Image'
      ]),
      IMAGE,
      { modality: 'image', task: 'generate', collections: [] }
    ],
    [
      template('flux_canny_model_example', 'Flux.1 Canny Model', [
        'ControlNet'
      ]),
      IMAGE,
      { modality: 'image', task: 'control', collections: [] }
    ],
    [
      template('utility_seedvr2_video_upscale', 'Video Upscale: SeedVR2', [
        'Video Upscale'
      ]),
      VIDEO,
      { modality: 'video', task: 'upscale', collections: [] }
    ],
    [
      template('api_heygen_avatar_video', 'HeyGen: Avatar Video', ['Lip Sync']),
      VIDEO,
      { modality: 'video', task: 'lip-sync', collections: ['characters'] }
    ],
    [
      template(
        'video_wan21_scail2_character_replacement',
        'SCAIL-2: Character Replacement',
        ['Character Replacement']
      ),
      VIDEO,
      {
        modality: 'video',
        task: 'motion-transfer',
        collections: ['characters']
      }
    ],
    [
      template(
        'template_purz_nb2_single_image_sprite_sheet',
        'Single Image to Animated Sprite Sheet',
        ['Game']
      ),
      { title: 'Brand & Design', type: 'image' },
      { modality: 'image', task: 'generate', collections: ['game-assets'] }
    ],
    [
      template('template_product_placement', 'Product Placement', [
        'Image Edit',
        'Video'
      ]),
      { title: 'Product & Ads', type: 'image' },
      { modality: 'video', task: 'generate', collections: ['product'] }
    ],
    [
      template('api_fishaudio_text_to_speech', 'Fish Audio: Text to Speech', [
        'TTS'
      ]),
      { title: 'Audio', type: 'audio' },
      { modality: 'audio', task: 'speech', collections: [] }
    ],
    [
      template('api_tripo_p2_text_to_model', 'Tripo P2: Text to Model', [
        'Text to 3D'
      ]),
      { title: '3D Model', type: '3d' },
      { modality: '3d', task: 'from-text', collections: [] }
    ],
    [
      template('image_anima_base_v1', 'Anima Base v1: Text to Image', [
        'Anime',
        'Text to Image'
      ]),
      IMAGE,
      { modality: 'image', task: 'generate', collections: ['anime'] }
    ]
  ] as const)('places %o', ([entry, category, placed]) => {
    expect(classifyTemplate(entry, category)).toEqual(placed)
  })

  it('leaves out a text-only template', () => {
    expect(
      classifyTemplate(template('api_openai_chat', 'OpenAI: ChatGPT'), {
        title: 'LLM',
        type: 'llm'
      })
    ).toBeUndefined()
  })
})

describe('buildWorkflowCatalogueMock', () => {
  it('links a webp thumbnail and leaves an audio preview out', () => {
    const { entries, skipped } = buildWorkflowCatalogueMock([
      {
        title: 'Audio',
        type: 'audio',
        templates: [
          {
            ...template('audio_song', 'A song', ['Music']),
            mediaSubtype: 'mp3'
          },
          template('audio_voice', 'A voice', ['TTS'])
        ]
      },
      { title: 'LLM', type: 'llm', templates: [template('chat', 'Chat')] }
    ])

    expect(entries.map((entry) => [entry.name, entry.thumbnail])).toEqual([
      ['audio_song', undefined],
      [
        'audio_voice',
        'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/audio_voice-1.webp'
      ]
    ])
    expect(skipped).toEqual(['chat'])
  })
})
