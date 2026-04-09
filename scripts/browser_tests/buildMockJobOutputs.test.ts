import { describe, expect, it } from 'vitest'

import { buildMockJobOutputs } from '../../browser_tests/fixtures/helpers/buildMockJobOutputs'
import type {
  GeneratedJobFixture,
  GeneratedOutputFixture
} from '../../browser_tests/fixtures/helpers/assetScenarioTypes'

describe('buildMockJobOutputs', () => {
  it('defaults nodeId, mediaType, subfolder, and type for a single output', () => {
    const job = {
      jobId: 'job-1',
      outputs: [{ filename: 'single-output.png' }]
    } satisfies GeneratedJobFixture
    const outputs = [
      {
        filename: 'single-output.png',
        displayName: 'Single output'
      }
    ] satisfies GeneratedOutputFixture[]

    expect(buildMockJobOutputs(job, outputs)).toEqual({
      '5': {
        images: [
          {
            filename: 'single-output.png',
            subfolder: '',
            type: 'output',
            display_name: 'Single output'
          }
        ]
      }
    })
  })

  it('buckets outputs by media type and preserves order within each bucket', () => {
    const job = {
      jobId: 'job-2',
      nodeId: '12',
      outputs: [{ filename: 'preview.png' }]
    } satisfies GeneratedJobFixture
    const outputs = [
      {
        filename: 'image-a.png',
        mediaType: 'images',
        subfolder: 'gallery',
        type: 'temp'
      },
      {
        filename: 'clip.mp4',
        mediaType: 'video',
        displayName: 'Clip'
      },
      {
        filename: 'image-b.png',
        mediaType: 'images',
        displayName: 'Second image'
      },
      {
        filename: 'sound.wav',
        mediaType: 'audio'
      }
    ] satisfies GeneratedOutputFixture[]

    expect(buildMockJobOutputs(job, outputs)).toEqual({
      '12': {
        images: [
          {
            filename: 'image-a.png',
            subfolder: 'gallery',
            type: 'temp',
            display_name: undefined
          },
          {
            filename: 'image-b.png',
            subfolder: '',
            type: 'output',
            display_name: 'Second image'
          }
        ],
        video: [
          {
            filename: 'clip.mp4',
            subfolder: '',
            type: 'output',
            display_name: 'Clip'
          }
        ],
        audio: [
          {
            filename: 'sound.wav',
            subfolder: '',
            type: 'output',
            display_name: undefined
          }
        ]
      }
    })
  })
})
