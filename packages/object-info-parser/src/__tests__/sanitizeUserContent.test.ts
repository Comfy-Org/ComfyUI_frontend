import { describe, expect, it } from 'vitest'

import { sanitizeUserContent } from '../helpers/sanitizeUserContent'
import type { ComfyNodeDef } from '../schemas/nodeDefSchema'

function makeNodeDef(
  name: string,
  pythonModule: string,
  input: ComfyNodeDef['input']
): ComfyNodeDef {
  return {
    name,
    display_name: name,
    description: '',
    category: 'test',
    output_node: false,
    python_module: pythonModule,
    input
  }
}

describe('sanitizeUserContent', () => {
  it('strips known user filenames from combo inputs across all nodes', () => {
    const defs = {
      CustomCombo: makeNodeDef('CustomCombo', 'custom_nodes.some-pack', {
        required: {
          choice: [['my-secret.png', 'safe-option', 'video.mp4', 42], {}],
          choiceV2: ['COMBO', { options: ['a.jpg', 'keep-me', 'b'] }]
        }
      })
    }

    const sanitized = sanitizeUserContent(defs)
    const required = sanitized.CustomCombo.input?.required
    expect(required?.choice).toEqual([['safe-option', 42], {}])
    expect(required?.choiceV2).toEqual(['COMBO', { options: ['keep-me', 'b'] }])
  })

  it('zeros combo lists for known upload nodes in required/optional/hidden sections', () => {
    const defs = {
      LoadImage: makeNodeDef('LoadImage', 'nodes', {
        required: {
          image: [['personal.png', 'public.png'], { image_upload: true }]
        },
        optional: {
          mask: ['COMBO', { options: ['another.jpg', 'value'] }]
        },
        hidden: {
          cache: [['movie.mov', 'keep'], {}],
          hiddenV2: ['COMBO', { options: ['private.wav', 'other'] }]
        }
      }),
      LoadVideo: makeNodeDef('LoadVideo', 'nodes', {
        required: {
          video: [['clip.mp4', 'clip2.webm'], {}]
        }
      }),
      LoadAudio: makeNodeDef('LoadAudio', 'nodes', {
        required: {
          audio: [['song.mp3', 'song.flac'], {}]
        }
      })
    }

    const sanitized = sanitizeUserContent(defs)

    expect(sanitized.LoadImage.input?.required?.image).toEqual([
      [],
      { image_upload: true }
    ])
    expect(sanitized.LoadImage.input?.optional?.mask).toEqual([
      'COMBO',
      { options: [] }
    ])
    expect(sanitized.LoadImage.input?.hidden?.cache).toEqual([[], {}])
    expect(sanitized.LoadImage.input?.hidden?.hiddenV2).toEqual([
      'COMBO',
      { options: [] }
    ])
    expect(sanitized.LoadVideo.input?.required?.video).toEqual([[], {}])
    expect(sanitized.LoadAudio.input?.required?.audio).toEqual([[], {}])
  })
})
