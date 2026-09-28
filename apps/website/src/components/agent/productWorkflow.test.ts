import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, describe, expect, it } from 'vitest'

import { productWorkflow } from './productWorkflow'
import { createWorkflowMotion } from './workflowMotion'

function animationFrames(
  motion: ReturnType<typeof createWorkflowMotion>,
  name: string
) {
  const match = motion.css.match(
    new RegExp(`@keyframes ${name}\\{((?:[\\d.]+%\\{[^}]*\\})+)\\}`)
  )
  assert.exists(match)
  return Array.from(
    match[1].matchAll(/([\d.]+)%\{([^}]+)\}/g),
    ([, percentage, value]) => ({
      time: (Number(percentage) / 100) * motion.duration,
      value
    })
  )
}

describe('conditioner workflow', () => {
  const motion = createWorkflowMotion(productWorkflow)
  const { scene } = motion

  it('keeps the animation duration synchronized with media playback', () => {
    expect(motion.duration).toBeCloseTo(23.52772575250836, 6)
  })

  it('ships only the two authored cursor overrides alongside generated CSS', () => {
    const overrides = readFileSync(
      join(import.meta.dirname, '../../styles/product-workflow-keyframes.css'),
      'utf8'
    )
    const names = Array.from(
      overrides.matchAll(/@keyframes ([^{\s]+)/g),
      ([, name]) => name
    )

    expect(names).toEqual([scene.userCursor.name, scene.agentCursor.name])
    expect(
      names.every((name) => motion.css.includes(`@keyframes ${name}{`))
    ).toBe(true)
  })

  it.for(['base', 'products', 'motionref'])(
    'reveals %s in place after one user click without carrying the card',
    (id) => {
      const index = productWorkflow.nodes.findIndex((node) => node.id === id)
      const point = productWorkflow.nodes[index].clickPoint
      assert.exists(point)
      const position = `left:${(point.x / productWorkflow.width) * 100}cqw;top:${(point.y / productWorkflow.width) * 100}cqw;`
      const nodeFrames = animationFrames(motion, scene.nodes[index].name)
      const clicks = animationFrames(motion, scene.userCursor.name).filter(
        (frame) =>
          frame.value.includes(position) && frame.value.includes('scale(0.82)')
      )
      const visible = nodeFrames.find(
        (frame) =>
          frame.value.startsWith('opacity:1;') &&
          frame.value.includes('scale(1)')
      )
      assert.exists(visible)
      expect(clicks).toHaveLength(1)
      expect(visible.time).toBeGreaterThan(clicks[0].time)
      expect([
        ...new Set(
          nodeFrames.map(
            (frame) => frame.value.match(/translate\(([^)]+)\)/)?.[1]
          )
        )
      ]).toEqual(['0,0'])
    }
  )

  it('lets the user choose purple after seeing all keyframes, then add the motion reference', () => {
    const selection = animationFrames(
      motion,
      'wf-conditioner-keyframe-purple-selection'
    ).find((frame) => frame.value === 'opacity:1;')
    const previews = ['white', 'gold', 'purple'].map((variant) =>
      animationFrames(motion, `wf-conditioner-keyframe-${variant}-image`).find(
        (frame) => frame.value === 'opacity:1;'
      )
    )
    const reference = animationFrames(motion, 'wf-conditioner-motionref').find(
      (frame) => frame.value.includes('scale(1)')
    )
    const generation = animationFrames(motion, 'wf-conditioner-videogen').find(
      (frame) => frame.value.includes('scale(1)')
    )
    assert.exists(selection)
    assert.exists(reference)
    assert.exists(generation)
    for (const preview of previews) {
      assert.exists(preview)
      expect(selection.time).toBeGreaterThan(preview.time)
    }
    expect(reference.time).toBeGreaterThan(selection.time)
    expect(generation.time).toBeGreaterThan(reference.time)
    expect(
      scene.nodes
        .filter((node) => node.selectionName)
        .map((node) => node.selectionName)
    ).toEqual(['wf-conditioner-keyframe-purple-selection'])
  })

  it.for([
    {
      processor: 'keygen',
      text: 'Create 3 product scenes from the base composition and bottle references.',
      output: 'keyframe-white',
      inputCount: 2,
      outputCount: 3
    },
    {
      processor: 'videogen',
      text: 'Use the motion reference and keyframe to render a video ad.',
      output: 'result-purple',
      inputCount: 2,
      outputCount: 1
    }
  ])(
    'shows the full $processor prompt with its window, then generates the connected outputs',
    ({ processor, text, output, inputCount, outputCount }) => {
      const incoming = scene.wires.filter((wire) =>
        wire.name.endsWith(`-${processor}`)
      )
      const outgoing = scene.wires.filter((wire) =>
        wire.name.startsWith(`wf-conditioner-${processor}-`)
      )
      const placement = animationFrames(
        motion,
        `wf-conditioner-${processor}`
      ).find((frame) => frame.value.includes('scale(1)'))
      const shell = animationFrames(motion, `wf-conditioner-${output}`).find(
        (frame) => frame.value.includes('scale(1)')
      )
      const media = animationFrames(
        motion,
        `wf-conditioner-${output}-image`
      ).find((frame) => frame.value === 'opacity:1;')
      const processorIndex = productWorkflow.nodes.findIndex(
        (node) => node.id === processor
      )
      assert.exists(placement)
      assert.exists(shell)
      assert.exists(media)
      expect(incoming).toHaveLength(inputCount)
      expect(productWorkflow.nodes[processorIndex].text).toBe(text)
      expect(outgoing).toHaveLength(outputCount)
      for (const wire of incoming) {
        const frames = animationFrames(motion, wire.name)
        const start = frames.find(
          (frame) => frame.value === 'stroke-dashoffset:1;opacity:1;'
        )
        const end = frames.find(
          (frame) => frame.value === 'stroke-dashoffset:0;opacity:1;'
        )
        assert.exists(start)
        assert.exists(end)
        expect(placement.time).toBeLessThan(start.time)
        expect(end.time).toBeLessThan(shell.time)
      }
      for (const wire of outgoing) {
        const frames = animationFrames(motion, wire.name)
        const start = frames.find(
          (frame) => frame.value === 'stroke-dashoffset:1;opacity:1;'
        )
        const end = frames.find(
          (frame) => frame.value === 'stroke-dashoffset:0;opacity:1;'
        )
        assert.exists(start)
        assert.exists(end)
        expect(shell.time).toBeLessThan(start.time)
        expect(end.time).toBeLessThan(media.time)
      }
    }
  )

  it('loops the final purple video in place during a ten-second hold', () => {
    const imageFrames = animationFrames(
      motion,
      'wf-conditioner-result-purple-image'
    ).filter((frame) => frame.value === 'opacity:1;')
    const final = productWorkflow.nodes.find(
      (node) => node.id === 'result-purple'
    )
    assert.exists(final)
    expect(imageFrames).toHaveLength(2)
    expect(imageFrames[1].time - imageFrames[0].time).toBeCloseTo(10, 5)
    const finalIndex = productWorkflow.nodes.indexOf(final)
    const holdFrame = animationFrames(
      motion,
      scene.nodes[finalIndex].name
    ).find((frame) => Math.abs(frame.time - (motion.duration - 0.25)) < 0.001)
    expect(holdFrame?.value).toBe(
      'opacity:1;transform:translate(0,0) scale(1);'
    )
    expect(final.width).toBeGreaterThan(
      Math.max(
        ...productWorkflow.nodes
          .filter((node) => node.id !== final.id)
          .map((node) => node.width)
      )
    )
    expect(
      productWorkflow.nodes
        .filter((node) => node.video && node.id.startsWith('result-'))
        .map((node) => ({
          video: node.video,
          poster: node.poster,
          loopVideo: node.loopVideo
        }))
    ).toEqual([
      {
        video: 'conditioner/result-purple.mp4',
        poster: 'conditioner/keyframe-purple.webp',
        loopVideo: true
      }
    ])
  })

  it('starts and loops the supplied motion reference after the user clicks it into place, before video generation', () => {
    const index = productWorkflow.nodes.findIndex(
      (node) => node.id === 'motionref'
    )
    const placement = animationFrames(motion, 'wf-conditioner-motionref').find(
      (frame) => frame.value.includes('scale(1)')
    )
    const generation = animationFrames(motion, 'wf-conditioner-videogen').find(
      (frame) => frame.value.includes('scale(1)')
    )
    assert.exists(placement)
    assert.exists(generation)
    expect(scene.nodes[index].mediaAt).toBeCloseTo(placement.time, 5)
    expect(scene.nodes[index].mediaAt).toBeLessThan(generation.time)
    expect(scene.nodes[index].imageName).toBeUndefined()
    expect(productWorkflow.nodes[index].video).toBe(
      'conditioner/motion-reference.mp4'
    )
    expect(productWorkflow.nodes[index].loopVideo).toBe(true)
  })

  it.for(['white', 'gold', 'purple'])(
    'keeps the %s keyframe the same size as the other keyframes',
    (variant) => {
      const keyframe = productWorkflow.nodes.find(
        (node) => node.id === `keyframe-${variant}`
      )
      const firstKeyframe = productWorkflow.nodes.find(
        (node) => node.id === 'keyframe-white'
      )
      assert.exists(keyframe)
      assert.exists(firstKeyframe)
      expect(keyframe.width).toBe(firstKeyframe.width)
      expect(keyframe.height).toBe(firstKeyframe.height)
    }
  )

  it('uses the supplied scene, motion, and final video', () => {
    expect(
      productWorkflow.nodes.find((node) => node.id === 'base')?.image
    ).toBe('conditioner/base-scene.webp')
    expect(
      productWorkflow.nodes
        .filter((node) => node.video)
        .map((node) => node.video)
    ).toEqual([
      'conditioner/motion-reference.mp4',
      'conditioner/result-purple.mp4'
    ])
  })

  it('fits every settled node in the compact canvas without overlapping cards', () => {
    const outside = productWorkflow.nodes.filter(
      (node) =>
        node.x < 0 ||
        node.y < 0 ||
        node.x + node.width > productWorkflow.width ||
        node.y + node.height > productWorkflow.height
    )
    const overlaps = productWorkflow.nodes.flatMap((node, index) =>
      productWorkflow.nodes
        .slice(index + 1)
        .filter(
          (other) =>
            node.x < other.x + other.width &&
            node.x + node.width > other.x &&
            node.y < other.y + other.height &&
            node.y + node.height > other.y
        )
    )
    expect(outside).toEqual([])
    expect(overlaps).toEqual([])
  })

  it('places generation diagonally right below the reference center and a separate final output on the right', () => {
    const reference = productWorkflow.nodes.find(
      (node) => node.id === 'motionref'
    )
    const generation = productWorkflow.nodes.find(
      (node) => node.id === 'videogen'
    )
    const final = productWorkflow.nodes.find(
      (node) => node.id === 'result-purple'
    )
    assert.exists(reference?.output)
    assert.exists(generation)
    assert.exists(final)
    expect(generation.x).toBeGreaterThan(reference.x + reference.width)
    expect(generation.y).toBeGreaterThan(reference.y + reference.height / 2)
    expect(final.x).toBeGreaterThan(
      Math.max(
        ...productWorkflow.nodes
          .filter((node) => node.id !== final.id)
          .map((node) => node.x + node.width)
      )
    )
    expect(reference.output.x).toBe(reference.x + reference.width)
    expect(reference.output.y).toBeGreaterThan(reference.y)
    expect(reference.output.y).toBeLessThan(reference.y + reference.height)
  })

  it('connects every animated wire exactly once through its node ports', () => {
    expect(scene.wires).toHaveLength(productWorkflow.edges.length)
    for (const wire of scene.wires) {
      const starts = animationFrames(motion, wire.name).filter(
        (frame) => frame.value === 'stroke-dashoffset:1;opacity:1;'
      )
      expect(starts).toHaveLength(1)
    }
    for (const edge of productWorkflow.edges) {
      const source = productWorkflow.nodes.find((node) => node.id === edge.from)
      const target = productWorkflow.nodes.find((node) => node.id === edge.to)
      const from = edge.curves?.[0].from
      const to = edge.curves?.at(-1)?.to
      assert.exists(source?.output)
      assert.exists(target)
      assert.exists(from)
      assert.exists(to)
      expect(from).toEqual(source.output)
      expect([target.input, ...(target.extraPorts ?? [])]).toContainEqual(to)
    }
  })

  it('connects right-side outputs to left-side inputs across the workflow', () => {
    // Dots may sit slightly inside or outside the card edge, never mid-card.
    const edgeTolerance = 12
    const nearEdge = (x: number, edge: number) =>
      Math.abs(x - edge) <= edgeTolerance
    const misplacedPorts = productWorkflow.nodes.flatMap((node) => [
      ...(node.input &&
      (!nearEdge(node.input.x, node.x) ||
        node.input.y <= node.y ||
        node.input.y >= node.y + node.height)
        ? [node.input]
        : []),
      ...(node.output &&
      (!nearEdge(node.output.x, node.x + node.width) ||
        node.output.y <= node.y ||
        node.output.y >= node.y + node.height)
        ? [node.output]
        : [])
    ])
    const misplacedClicks = productWorkflow.nodes.filter(
      (node) =>
        !node.clickPoint ||
        node.clickPoint.x <= node.x ||
        node.clickPoint.x >= node.x + node.width ||
        node.clickPoint.y <= node.y ||
        node.clickPoint.y >= node.y + node.height
    )
    const reversedConnections = productWorkflow.edges.filter((edge) => {
      const source = productWorkflow.nodes.find((node) => node.id === edge.from)
      const target = productWorkflow.nodes.find((node) => node.id === edge.to)
      return (
        !source?.output ||
        !target?.input ||
        target.input.x <= source.output.x ||
        target.x + target.width / 2 <= source.x + source.width / 2
      )
    })

    expect(misplacedPorts).toEqual([])
    expect(misplacedClicks).toEqual([])
    expect(reversedConnections).toEqual([])
  })
})
