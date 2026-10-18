import { describe, expect, it } from 'vitest'

import swapGraph from './swap.api.json'
import { resolveSeed, swapPrompt, swapWorkflow } from './workflow'

const request = {
  video: 'clip.mp4',
  character: 'hero.png',
  target: '  keep the glasses  ',
  start: 2.5,
  seconds: 5,
  size: '768p' as const,
  canvas: { width: 1344, height: 768 },
  result: { width: 1344, height: 756 },
  seed: 42
}

describe('swapWorkflow', () => {
  const graph = swapWorkflow(request)

  it('binds the clip and the character reference', () => {
    expect(graph['30'].inputs.file).toBe('clip.mp4')
    expect(graph['9'].inputs.image).toBe('hero.png')
    expect(graph['803'].inputs.reference).toEqual(['9', 0])
  })

  it('cuts the chosen part before preparing it, for the shot and for pricing', () => {
    expect(graph.trim.inputs).toMatchObject({
      video: ['30', 0],
      start_time: 2.5,
      duration: 5
    })
    expect(graph['31'].inputs.video).toEqual(['trim', 0])
    expect(graph['803'].inputs.source_video).toEqual(['trim', 0])
  })

  it.for([
    ['480p', 480],
    ['768p', 768]
  ] as const)(
    'asks PrepareVideo for %s as the number the app proxy prices by',
    ([size, resolution]) => {
      const sized = swapWorkflow({ ...request, size, seconds: 9.4 })

      expect(sized['31'].inputs).toMatchObject({
        resolution,
        duration_seconds: 9.4
      })
    }
  )

  it('runs the v1.5 swap LoRA after the 8-step Turbo LoRA', () => {
    expect(graph['850'].inputs).toMatchObject({
      lora_name: 'h3_character_swap_v1.5.safetensors',
      strength_model: 1,
      model: ['4', 0]
    })
    expect(graph['4'].inputs.lora_name).toContain('turbo_8step')
  })

  it('seeds the run and saves the result as a video the deployment reports', () => {
    expect(graph['801'].inputs.seed).toBe(42)
    expect(graph['808'].inputs).toMatchObject({
      images: ['807', 0],
      audio: ['807', 1]
    })
    expect(graph['809'].inputs.video).toEqual(['808', 0])
  })

  it('uses an anchor through a crop to the prepared size', () => {
    const anchored = swapWorkflow({ ...request, anchor: 'anchor.png' })

    expect(anchored.anchor_image.inputs.image).toBe('anchor.png')
    expect(anchored.anchor_fit.inputs).toMatchObject({
      image: ['anchor_image', 0],
      width: ['31', 2],
      height: ['31', 3],
      crop: 'center'
    })
    expect(anchored['803'].inputs).toMatchObject({
      anchor: ['anchor_fit', 0],
      use_anchor: true
    })
    expect(anchored['801'].inputs.prompt).toContain('<Picture 2>')
  })

  it('runs without anchor nodes when no anchor was made', () => {
    expect(graph.anchor_image).toBeUndefined()
    expect(graph.anchor_fit).toBeUndefined()
    expect(graph['803'].inputs.anchor).toBeUndefined()
    expect(graph['803'].inputs.use_anchor).toBe(false)
    expect(graph['801'].inputs.prompt).not.toContain('<Picture 2>')
  })

  it('leaves the stored graph untouched', () => {
    expect(swapGraph['30'].inputs.file).not.toBe('clip.mp4')
    expect(swapGraph.anchor_image).toBeDefined()
  })
})

describe('swapPrompt', () => {
  it("starts with the instruction and both references by their H3 tags, then the visitor's words", () => {
    expect(swapPrompt('  keep the glasses  ', false)).toBe(
      'Replace the selected person in <Video 1> with the character in <Picture 1>. Preserve the source performance, scene and audio timing. keep the glasses'
    )
  })

  it('names the anchor only when there is one, and stands alone without extra words', () => {
    expect(swapPrompt('', true)).toBe(
      'Replace the selected person in <Video 1> with the character in <Picture 1>. Preserve the source performance, scene and audio timing. Start from the first frame in <Picture 2>.'
    )
  })
})

describe('resolveSeed', () => {
  it('draws a seed when none is typed and keeps one that is, zero included', () => {
    expect(resolveSeed(undefined, () => 7)).toBe(7)
    expect(resolveSeed(0, () => 7)).toBe(0)
    expect(resolveSeed(2 ** 40)).toBe(2 ** 32 - 1)
  })
})
