import { describe, expect, it } from 'vitest'
import { cameraGuidancePlan } from './camera-guidance'
import { cameraViewDefaults, cameraViewPrompt } from './editing'
const source = new File(['source'], 'source.png', { type: 'image/png' })
const assets = [
  {
    id: 'person',
    name: 'Mara',
    kind: 'character' as const,
    notes: 'Olive coat',
    file: new File(['portrait'], 'portrait.png', { type: 'image/png' })
  },
  {
    id: 'place',
    name: 'Lighthouse',
    kind: 'location' as const,
    notes: 'Brass door',
    file: new File(['place'], 'place.png', { type: 'image/png' })
  }
]
const frame = { mode: 'frame', assetIds: [], notes: '', scene: '' }
describe('camera reference guidance', () => {
  it('preserves the original single-frame prompt and source', () => {
    const plan = cameraGuidancePlan(
      source,
      frame,
      assets,
      1,
      cameraViewDefaults
    )
    expect(plan.prompt).toBe(cameraViewPrompt(cameraViewDefaults))
    expect(plan.sourceFile).toBe(source)
    expect(plan.sourceFiles).toEqual([])
  })
  it('keeps selected anchor order and numbers after the source frame', () => {
    const plan = cameraGuidancePlan(
      source,
      {
        ...frame,
        mode: 'anchored',
        assetIds: ['place', 'person'],
        notes: 'One lantern'
      },
      assets,
      3,
      cameraViewDefaults
    )
    expect(plan.sourceFiles).toEqual([assets[1].file, assets[0].file])
    expect(plan.prompt).toContain(
      'Image 2: location reference for "Lighthouse"'
    )
    expect(plan.prompt).toContain('Image 3: character reference for "Mara"')
    expect(plan.prompt).toContain('Details to keep: One lantern')
  })
  it('rebuilds a portrait using only the character image and explicit scene', () => {
    const plan = cameraGuidancePlan(
      source,
      {
        ...frame,
        mode: 'portrait',
        assetIds: ['person'],
        scene: 'Mara opens a lighthouse door.'
      },
      assets,
      1,
      { ...cameraViewDefaults, distance: 'close' }
    )
    expect(plan.sourceFile).toBe(assets[0].file)
    expect(plan.sourceFiles).toEqual([])
    expect(plan.prompt).toContain('original full frame is not supplied')
    expect(plan.prompt).toContain('Mara opens a lighthouse door.')
    expect(plan.prompt).toContain('Image 1: character reference')
    expect(plan.prompt).toContain('Tight close-up')
    expect(plan.prompt).not.toContain('same moment shown in image 1')
  })
  it('rejects wrong identities, missing scenes and unsupported reference counts', () => {
    for (const guidance of [
      { ...frame, assetIds: ['person'] },
      { ...frame, mode: 'anchored', assetIds: ['person', 'person'] },
      { ...frame, mode: 'anchored', assetIds: ['missing'] },
      { ...frame, mode: 'portrait', assetIds: ['place'], scene: 'Scene' },
      { ...frame, mode: 'portrait', assetIds: ['person'] }
    ])
      expect(() =>
        cameraGuidancePlan(source, guidance, assets, 3, cameraViewDefaults)
      ).toThrow()
    expect(() =>
      cameraGuidancePlan(
        source,
        { ...frame, mode: 'anchored', assetIds: ['person', 'place'] },
        assets,
        2,
        cameraViewDefaults
      )
    ).toThrow()
  })
})
