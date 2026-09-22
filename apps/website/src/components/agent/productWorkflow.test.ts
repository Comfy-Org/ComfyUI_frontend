import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, describe, expect, it } from 'vitest'

import {
  productWorkflow,
  productWorkflowAgentRest,
  productWorkflowHoldDuration,
  productWorkflowSize,
  productWorkflowUserRest
} from './productWorkflow'
import { createWorkflowMotion } from './workflowMotion'

function parseKeyframes(css: string) {
  return Array.from(
    css
      .replace(/\s+/g, '')
      .matchAll(/@keyframes([^{]+)\{((?:[\d.]+%\{[^}]*\})+)\}/g),
    ([, name, body]) => ({
      name,
      frames: Array.from(
        body.matchAll(/([\d.]+)%\{([^}]+)\}/g),
        ([, percentage, value]) => ({ percentage: Number(percentage), value })
      )
    })
  ).toSorted((a, b) => a.name.localeCompare(b.name))
}

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
  const motion = createWorkflowMotion([productWorkflow], {
    width: productWorkflowSize.width,
    holdDuration: productWorkflowHoldDuration,
    connectionSpeed: 2,
    agentRest: productWorkflowAgentRest,
    userRest: productWorkflowUserRest
  })
  const scene = motion.scenes[0]
  const connections = scene.timeline.flatMap((event) => {
    if (event.type === 'connect') return [event]
    if (event.type === 'connect-group') {
      return event.to.map((to) => ({ ...event, type: 'connect' as const, to }))
    }
    return []
  })

  it('keeps the supplied animation names and timing synchronized with media playback', () => {
    const imported = parseKeyframes(
      readFileSync(
        join(
          import.meta.dirname,
          '../../styles/product-workflow-keyframes.css'
        ),
        'utf8'
      )
    )
    const generated = parseKeyframes(motion.css)
    const cursors = [scene.userCursor.name, scene.agentCursor.name]

    expect(imported.map(({ name }) => name)).toEqual(
      generated.map(({ name }) => name)
    )
    expect(imported.filter(({ name }) => !cursors.includes(name))).toEqual(
      generated.filter(({ name }) => !cursors.includes(name))
    )
    expect(motion.duration).toBeCloseTo(23.52772575250836, 6)
  })

  it.for(['base', 'products', 'motionref'])(
    'reveals %s in place after one user click without carrying the card',
    (id) => {
      const index = productWorkflow.nodes.findIndex((node) => node.id === id)
      const point = productWorkflow.nodes[index].clickPoint
      const placement = scene.timeline.find(
        (event) => event.type === 'place' && event.node === id
      )
      assert.exists(point)
      assert.exists(placement)
      const nodeFrames = animationFrames(motion, scene.nodes[index].name)
      const clicks = animationFrames(motion, scene.userCursor.name).filter(
        (frame) =>
          frame.time >= placement.start &&
          frame.time <= placement.end &&
          frame.value.includes('scale(0.82)')
      )
      const visible = nodeFrames.find(
        (frame) =>
          frame.value.startsWith('opacity:1;') &&
          frame.value.includes('scale(1)')
      )
      assert.exists(visible)
      expect(clicks).toHaveLength(1)
      expect(clicks[0].value).toContain(
        `left:${(point.x / productWorkflowSize.width) * 100}cqw;top:${(point.y / productWorkflowSize.width) * 100}cqw;`
      )
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
    const userDrops = scene.timeline.filter(
      (event) => event.type === 'place' && event.actor === 'user'
    )
    const keyframeGeneration = scene.timeline.find(
      (event) => event.type === 'place' && event.node === 'keygen'
    )
    const keyframes = scene.timeline.find(
      (event) =>
        event.type === 'images' && event.nodes.includes('keyframe-white')
    )
    const videoGeneration = scene.timeline.find(
      (event) => event.type === 'place' && event.node === 'videogen'
    )
    const selection = scene.timeline.find((event) => event.type === 'select')
    const videoInputs = connections.filter((event) => event.to === 'videogen')
    assert.exists(keyframeGeneration)
    assert.exists(keyframes?.imagesAt)
    assert.exists(selection?.selectionAt)
    assert.exists(videoGeneration)
    expect(
      userDrops.map((event) => event.type === 'place' && event.node)
    ).toEqual(['base', 'products', 'motionref'])
    expect(userDrops[1].end).toBeLessThan(keyframeGeneration.start)
    expect(selection.node).toBe('keyframe-purple')
    expect(selection.start).toBeGreaterThan(keyframes.imagesAt + 0.2)
    expect(userDrops[2].start).toBeGreaterThanOrEqual(selection.end)
    expect(userDrops[2].end).toBeLessThanOrEqual(videoGeneration.start)
    expect(videoInputs.map((event) => event.from)).toEqual([
      'keyframe-purple',
      'motionref'
    ])
    expect(
      scene.nodes
        .filter((node) => node.selectionName)
        .map((node) => node.selectionName)
    ).toEqual(['wf-conditioner-keyframe-purple-selection'])
  })

  it.for([
    {
      processor: 'keygen',
      text: 'Create three product scenes from the base composition and bottle references.',
      output: 'keyframe-white',
      inputCount: 2,
      outputCount: 3
    },
    {
      processor: 'videogen',
      text: 'Use the reference video to create a stylish video ad.',
      output: 'result-purple',
      inputCount: 2,
      outputCount: 1
    }
  ])(
    'shows the full $processor prompt with its window, then generates the connected outputs',
    ({ processor, text, output, inputCount, outputCount }) => {
      const incoming = connections.filter((event) => event.to === processor)
      const placement = scene.timeline.find(
        (event) => event.type === 'place' && event.node === processor
      )
      const outgoing = connections.filter((event) => event.from === processor)
      const shells = scene.timeline.find(
        (event) => event.type === 'show' && event.nodes.includes(output)
      )
      const media = scene.timeline.find(
        (event) => event.type === 'images' && event.nodes.includes(output)
      )
      const processorIndex = productWorkflow.nodes.findIndex(
        (node) => node.id === processor
      )
      assert.exists(placement?.dropAt)
      assert.exists(shells)
      assert.exists(media?.imagesAt)
      assert.exists(incoming[0].drawStart)
      expect(incoming).toHaveLength(inputCount)
      expect(placement.dropAt).toBeLessThan(incoming[0].drawStart)
      expect(
        Math.max(...incoming.map((event) => event.end))
      ).toBeLessThanOrEqual(shells.start)
      expect(productWorkflow.nodes[processorIndex].text).toBe(text)
      expect(scene.nodes[processorIndex].promptName).toBeUndefined()
      expect(scene.nodes[processorIndex].characters).toBeUndefined()
      expect(shells.end).toBeLessThanOrEqual(outgoing[0].start)
      expect(outgoing).toHaveLength(outputCount)
      expect(Math.max(...outgoing.map((event) => event.end))).toBeLessThan(
        media.imagesAt
      )
    }
  )

  it('loops the final purple video in place during a ten-second hold', () => {
    const videos = scene.timeline.find(
      (event) =>
        event.type === 'images' && event.nodes.includes('result-purple')
    )
    const final = productWorkflow.nodes.find(
      (node) => node.id === 'result-purple'
    )
    assert.exists(videos?.imagesAt)
    assert.exists(final)
    expect(motion.duration - 0.25 - videos.end).toBeCloseTo(10)
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
    const placement = scene.timeline.find(
      (event) => event.type === 'place' && event.node === 'motionref'
    )
    const generation = scene.timeline.find(
      (event) => event.type === 'place' && event.node === 'videogen'
    )
    assert.exists(placement?.dropAt)
    assert.exists(generation)
    expect(scene.nodes[index].mediaAt).toBe(placement.dropAt)
    expect(scene.nodes[index].mediaAt).toBeLessThan(generation.start)
    expect(scene.nodes[index].imageName).toBeUndefined()
    expect(productWorkflow.nodes[index].video).toBe(
      'conditioner/motion-reference.mp4'
    )
    expect(productWorkflow.nodes[index].loopVideo).toBe(true)
  })

  it.for(['white', 'gold', 'purple'])(
    'keeps the %s keyframe the same size as other previews and smaller than the reference',
    (variant) => {
      const keyframe = productWorkflow.nodes.find(
        (node) => node.id === `keyframe-${variant}`
      )
      const reference = productWorkflow.nodes.find(
        (node) => node.id === 'motionref'
      )
      const firstKeyframe = productWorkflow.nodes.find(
        (node) => node.id === 'keyframe-white'
      )
      assert.exists(keyframe)
      assert.exists(reference)
      assert.exists(firstKeyframe)
      expect(keyframe.width).toBe(firstKeyframe.width)
      expect(keyframe.height).toBe(firstKeyframe.height)
      expect(keyframe.width).toBeLessThan(reference.width)
      expect(keyframe.height).toBeLessThan(reference.height)
    }
  )

  it('uses the supplied scene, motion, and final video with no pending frames or typed characters', () => {
    expect(productWorkflow.nodes.filter((node) => node.pending)).toEqual([])
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
    expect(scene.nodes.filter((node) => node.characters)).toEqual([])
  })

  it('fits every settled node in the compact canvas without overlapping cards', () => {
    const outside = productWorkflow.nodes.filter(
      (node) =>
        node.x < 0 ||
        node.y < 0 ||
        node.x + node.width > productWorkflowSize.width ||
        node.y + node.height > productWorkflowSize.height
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
    expect(reference.output.y).toBeCloseTo(
      reference.y + reference.height / 2,
      2
    )
  })

  it('connects every animated wire exactly once through its node ports', () => {
    const connectedWireIds = connections.map(
      (event) => `${event.from}:${event.to}`
    )
    const wireIds = productWorkflow.edges.map(
      (edge) => `${edge.from}:${edge.to}`
    )
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
    expect(connectedWireIds.toSorted()).toEqual(wireIds.toSorted())
    expect(new Set(connectedWireIds).size).toBe(wireIds.length)
  })

  it('connects right-side outputs to left-side inputs across the workflow', () => {
    const misplacedPorts = productWorkflow.nodes.flatMap((node) =>
      [node.input, node.output].filter(
        (point) =>
          point &&
          ((point.x !== node.x && point.x !== node.x + node.width) ||
            Math.abs(
              point.y -
                (node.y +
                  (node.id.startsWith('keyframe-') ? 16 : node.height / 2))
            ) > 0.01)
      )
    )
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
        !source ||
        !target ||
        source.output?.x !== source.x + source.width ||
        target.input?.x !== target.x ||
        target.x + target.width / 2 <= source.x + source.width / 2
      )
    })

    expect(misplacedPorts).toEqual([])
    expect(misplacedClicks).toEqual([])
    expect(reversedConnections).toEqual([])
  })
})
