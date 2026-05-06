import { describe, expect, it } from 'vitest'

import { parsePreviewExposures } from './previewExposureSchema'

describe(parsePreviewExposures, () => {
  it('parses a valid array of preview exposure objects', () => {
    const input = [
      {
        name: 'preview',
        sourceNodeId: '5',
        sourcePreviewName: '$$canvas-image-preview'
      },
      {
        name: 'preview2',
        sourceNodeId: '7',
        sourcePreviewName: '$$canvas-image-preview'
      }
    ]
    expect(parsePreviewExposures(input)).toEqual(input)
  })

  it('parses JSON-string input', () => {
    const input = [
      {
        name: 'preview',
        sourceNodeId: '5',
        sourcePreviewName: '$$canvas-image-preview'
      }
    ]
    expect(parsePreviewExposures(JSON.stringify(input))).toEqual(input)
  })

  it('returns empty array for undefined', () => {
    expect(parsePreviewExposures(undefined)).toEqual([])
  })

  it('returns empty array for malformed JSON string', () => {
    expect(parsePreviewExposures('not-json{')).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(
      parsePreviewExposures({
        name: 'preview',
        sourceNodeId: '5',
        sourcePreviewName: '$$canvas-image-preview'
      })
    ).toEqual([])
    expect(parsePreviewExposures(42)).toEqual([])
  })

  it('returns empty array when entries are missing required fields', () => {
    expect(
      parsePreviewExposures([{ name: 'preview', sourceNodeId: '5' }])
    ).toEqual([])
    expect(
      parsePreviewExposures([
        { sourceNodeId: '5', sourcePreviewName: '$$canvas-image-preview' }
      ])
    ).toEqual([])
  })

  it('returns empty array when entries have wrong types', () => {
    expect(
      parsePreviewExposures([
        {
          name: 123,
          sourceNodeId: '5',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
    ).toEqual([])
    expect(
      parsePreviewExposures([
        {
          name: 'preview',
          sourceNodeId: 5,
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
    ).toEqual([])
  })
})
