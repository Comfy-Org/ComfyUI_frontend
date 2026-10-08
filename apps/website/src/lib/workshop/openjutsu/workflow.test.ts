import { describe, expect, it } from 'vitest'

import swapGraph from './swap.api.json'
import { resolveSeed, swapPrompt, swapWorkflow } from './workflow'

const request = {
  video: 'clip.mp4',
  character: 'hero.png',
  target: 'the man in the purple shirt.',
  start: 2.5,
  seconds: 5,
  canvas: { width: 768, height: 1344 },
  seed: 42
}

describe('swapWorkflow', () => {
  const graph = swapWorkflow(request)

  it('binds the two uploads, with the image ahead of the video', () => {
    expect(graph.video.inputs.file).toBe('clip.mp4')
    expect(graph.character.inputs.image).toBe('hero.png')
    expect(graph['136'].inputs['ref_images.ref_image_0']).toEqual([
      'character',
      0
    ])
  })

  it('shows H3 the chosen part and generates the next grid length up', () => {
    expect(graph.trim.inputs).toMatchObject({ start_time: 2.5, duration: 5 })
    expect(graph.sample.inputs.num_frames).toBe(120)
    expect(graph.frames.inputs.value).toBe(124)
    expect(graph['136'].inputs.length).toEqual(['frames', 0])
  })

  it('cuts the result back to the chosen length before saving', () => {
    expect(graph.cut.inputs).toMatchObject({ start_time: 0, duration: 5 })
    expect(graph.out.inputs.video).toEqual(['cut', 0])
  })

  it('sizes the canvas and seeds the run', () => {
    expect(graph['136'].inputs).toMatchObject({ width: 768, height: 1344 })
    expect(graph['129'].inputs.noise_seed).toBe(42)
  })

  it("puts the source clip's own sound on the result", () => {
    expect(graph['130'].inputs.audio).toEqual(['components', 1])
    expect(graph.components.inputs.video).toEqual(['trim', 0])
  })

  it('runs the swap LoRA at full strength on the Ref2VA base', () => {
    expect(graph['145'].inputs.strength_model).toBe(1)
    expect(graph['127'].inputs.unet_name).toContain('ref2va')
  })

  it('leaves the stored graph untouched', () => {
    expect(swapGraph.video.inputs.file).not.toBe('clip.mp4')
  })
})

describe('swapPrompt', () => {
  it('names the target once and both references by their H3 tags', () => {
    const prompt = swapPrompt(' the man in the purple shirt. ')
    expect(prompt).toMatch(
      /^Replace only the man in the purple shirt in <Video 1> with the character in <Picture 1>\./
    )
    expect(prompt).toContain('all other people')
  })
})

describe('resolveSeed', () => {
  it('draws a seed when none is typed and keeps one that is, zero included', () => {
    expect(resolveSeed(undefined, () => 7)).toBe(7)
    expect(resolveSeed(0, () => 7)).toBe(0)
    expect(resolveSeed(2 ** 40)).toBe(2 ** 32 - 1)
  })
})
