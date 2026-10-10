import { describe, expect, it } from 'vitest'

import type { DarkroomRequest } from './request'
import {
  baseSeed,
  buildDarkroomBody,
  darkroomPromptText,
  draftFromSettings,
  settingsFromRequest
} from './request'
import { DEFAULT_DARKROOM_SETTINGS } from './vocabulary'

function request(over: Partial<DarkroomRequest> = {}): DarkroomRequest {
  return {
    prompt: 'a fox reading a map',
    model: 'vertexai/gemini-nano-banana-2.1',
    aspectRatio: '16:9',
    imageSize: '2K',
    mimeType: 'image/png',
    temperature: 1,
    seed: 42,
    jobId: 'job',
    run: 0,
    runs: 1,
    inputCount: 0,
    ...over
  }
}

const image = { mime: 'image/png', data: 'AAAA' }

describe('buildDarkroomBody', () => {
  it('maps the controls onto the generateContent fields', () => {
    expect(buildDarkroomBody(request(), [])).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'a fox reading a map' }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageOutputOptions: { mimeType: 'image/png' },
          imageSize: '2K',
          aspectRatio: '16:9'
        },
        temperature: 1,
        seed: 42
      }
    })
  })

  it('leaves the shape unset for auto', () => {
    const body = buildDarkroomBody(request({ aspectRatio: 'auto' }), [])
    expect(body.generationConfig).not.toHaveProperty('imageConfig.aspectRatio')
  })

  it('leaves the resolution out for the model that has only one', () => {
    const body = buildDarkroomBody(
      request({ model: 'vertexai/gemini-2.5-flash-image' }),
      []
    )
    expect(body.generationConfig).not.toHaveProperty('imageConfig.imageSize')
  })

  it('sends planning and style notes only when they are set', () => {
    const body = buildDarkroomBody(
      request({ thinkingLevel: 'HIGH', system: 'soft grain' }),
      []
    )
    expect(body.generationConfig).toHaveProperty(
      'thinkingConfig.thinkingLevel',
      'HIGH'
    )
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'soft grain' }] })
    expect(buildDarkroomBody(request(), [])).not.toHaveProperty(
      'systemInstruction'
    )
  })

  it('puts reference images before the prompt', () => {
    const body = buildDarkroomBody(request(), [image, image])
    expect(body.contents).toEqual([
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
          { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
          { text: 'a fox reading a map' }
        ]
      }
    ])
  })
})

describe('darkroomPromptText', () => {
  const moodboard = { id: 'b', name: 'Dusk', count: 7, sheets: 2 }

  it('sends the prompt as typed without a moodboard', () => {
    expect(darkroomPromptText(request(), 3)).toBe('a fox reading a map')
  })

  it('tells the model to read moodboard sheets as art direction', () => {
    const text = darkroomPromptText(request({ moodboard }), 2)
    expect(text).toMatch(/^The last 2 reference images are moodboard sheets/)
    expect(text).toMatch(/\n\nCreate: a fox reading a map$/)
  })

  it("sets the user's own references apart from the sheets", () => {
    const text = darkroomPromptText(
      request({ moodboard: { ...moodboard, sheets: 1 } }),
      2
    )
    expect(text).toMatch(
      /^The first 1 reference image is the user's own reference.* The last 1 reference image is moodboard sheet:/
    )
  })
})

describe('baseSeed', () => {
  it('uses the seed that was typed', () => {
    expect(baseSeed('1234')).toBe(1234)
  })

  it.for(['', '  ', 'abc', '-5', '1.5', '99999999999'])(
    'picks a fresh seed for %j',
    (typed) => {
      expect(baseSeed(typed, () => 0.5)).toBe(1_073_741_500)
    }
  )
})

describe('draftFromSettings', () => {
  it('carries the settings a prompt was made with', () => {
    expect(
      draftFromSettings(
        {
          ...DEFAULT_DARKROOM_SETTINGS,
          planning: 'MEDIUM',
          styleNotes: '  muted  '
        },
        'a lighthouse'
      )
    ).toEqual({
      prompt: 'a lighthouse',
      model: 'vertexai/gemini-nano-banana-2.1',
      aspectRatio: '16:9',
      imageSize: '2K',
      mimeType: 'image/png',
      temperature: 1,
      thinkingLevel: 'MEDIUM',
      system: 'muted'
    })
  })
})

describe('settingsFromRequest', () => {
  it('loads a past image back into the bar, seed included', () => {
    expect(
      settingsFromRequest(
        DEFAULT_DARKROOM_SETTINGS,
        request({
          model: 'vertexai/gemini-3-pro-image',
          aspectRatio: '9:16',
          imageSize: '4K',
          mimeType: 'image/jpeg',
          temperature: 0.4,
          thinkingLevel: 'HIGH',
          system: 'soft grain',
          seed: 1234
        })
      )
    ).toEqual({
      model: 'vertexai/gemini-3-pro-image',
      runs: 4,
      shape: '9:16',
      size: '4K',
      format: 'image/jpeg',
      seed: '1234',
      planning: 'HIGH',
      temperature: 0.4,
      styleNotes: 'soft grain'
    })
  })

  it('keeps the current choice where a past one is no longer offered', () => {
    const current = { ...DEFAULT_DARKROOM_SETTINGS, shape: '1:1' as const }
    expect(
      settingsFromRequest(
        current,
        request({
          model: 'vertexai/retired',
          aspectRatio: '5:4',
          imageSize: '8K',
          thinkingLevel: 'LOW'
        })
      )
    ).toMatchObject({
      model: current.model,
      shape: '1:1',
      size: current.size,
      planning: ''
    })
  })
})
