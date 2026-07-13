import { describe, expect, it } from 'vitest'

import { detectNodeTypeFromFilename } from './loaderNodeUtil'

describe('detectNodeTypeFromFilename', () => {
  it.for([
    ['image.png', { nodeType: 'LoadImage', widgetName: 'image' }],
    ['clip.mp4', { nodeType: 'LoadVideo', widgetName: 'file' }],
    ['sound.mp3', { nodeType: 'LoadAudio', widgetName: 'audio' }],
    ['mesh.glb', { nodeType: null, widgetName: null }],
    ['notes.txt', { nodeType: null, widgetName: null }]
  ] as const)('maps %s to its loader node', ([filename, expected]) => {
    expect(detectNodeTypeFromFilename(filename)).toEqual(expected)
  })
})
