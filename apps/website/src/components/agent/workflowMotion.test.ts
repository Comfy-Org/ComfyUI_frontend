import { assert, describe, expect, it } from 'vitest'

import { peanutWorkflow } from './peanutWorkflow'
import { productWorkflow } from './productWorkflow'
import type { MotionStep, MotionWorkflow } from './workflowMotion'
import { createWorkflowMotion } from './workflowMotion'

type Motion = ReturnType<typeof createWorkflowMotion>

function animation(motion: Motion, name: string | undefined) {
  assert.isDefined(name)
  const match = motion.css.match(
    new RegExp(`@keyframes ${name}\\{((?:[\\d.]+%\\{[^}]*\\})+)\\}`)
  )
  assert.isNotNull(match)
  return Array.from(
    match[1].matchAll(/([\d.]+)%\{([^}]+)\}/g),
    ([, percentage, value]) => ({
      time: (Number(percentage) / 100) * motion.duration,
      value
    })
  )
}

function nodeMotion(motion: Motion, id: string) {
  const index = peanutWorkflow.nodes.findIndex((node) => node.id === id)
  assert.isAtLeast(index, 0)
  return motion.scenes[0].nodes[index]
}

function firstVisible(motion: Motion, name: string | undefined) {
  const frames = animation(motion, name)
  const index = frames.findIndex(
    (frame) =>
      frame.value.startsWith('opacity:1;') && !frame.value.includes('scale(0)')
  )
  assert.isAbove(index, 0)
  return { start: frames[index - 1].time, end: frames[index].time }
}

function cursorPoint(value: string) {
  const match = value.match(/left:([\d.e+-]+)cqw;top:([\d.e+-]+)cqw/)
  assert.isNotNull(match)
  return { x: Number(match[1]), y: Number(match[2]) }
}

describe('scripted peanut workflow', () => {
  it('shows three empty preview frames together and waits for every connection before revealing images', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const shells = ['preview1', 'preview2', 'preview3'].map((id) =>
      firstVisible(motion, nodeMotion(motion, id).name)
    )
    const images = ['preview1', 'preview2', 'preview3'].map((id) =>
      firstVisible(motion, nodeMotion(motion, id).imageName)
    )
    const connections = motion.scenes[0].timeline.filter(
      (event) => event.type === 'connect' && event.from === 'variations'
    )
    const lastConnection = Math.max(
      ...connections.map((event) => event.drawEnd ?? Infinity)
    )

    expect(shells).toEqual([shells[0], shells[0], shells[0]])
    expect(images).toEqual([images[0], images[0], images[0]])
    expect(shells[0].end).toBeLessThan(connections[0].start)
    expect(images[0].start).toBeGreaterThan(lastConnection)
  })

  it('moves the user to the first preview and highlights their choice before building the second generation', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const selection = motion.scenes[0].timeline.find(
      (event) => event.type === 'select'
    )
    assert.isDefined(selection?.selectionAt)
    const cursor = animation(motion, motion.scenes[0].userCursor.name)
    const click = cursor.find(
      (frame) =>
        frame.value.includes('scale(0.82)') &&
        Math.abs(frame.time - selection.selectionAt!) < 0.00001
    )
    assert.isDefined(click)
    const highlight = firstVisible(
      motion,
      nodeMotion(motion, 'preview1').selectionName
    )
    const secondGeneration = firstVisible(
      motion,
      nodeMotion(motion, 'generate').name
    )

    expect(cursorPoint(click.value)).toEqual({ x: 41.25, y: 9.6875 })
    expect(highlight.end).toBeLessThan(secondGeneration.start)
    expect(
      cursor.filter((frame) => frame.value.includes('scale(0.82)'))
    ).toHaveLength(2)
  })

  it('keeps the final frame empty until connected and holds the complete image for four seconds', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const final = nodeMotion(motion, 'final')
    const shell = firstVisible(motion, final.name)
    const image = firstVisible(motion, final.imageName)
    const wire = motion.scenes[0].timeline.find(
      (event) => event.type === 'connect' && event.to === 'final'
    )
    assert.isDefined(wire?.drawStart)
    assert.isDefined(wire.drawEnd)
    const imageFrames = animation(motion, final.imageName)

    expect(shell.end).toBeLessThan(wire.drawStart)
    expect(image.start).toBeGreaterThan(wire.drawEnd)
    expect(imageFrames[3].time - image.end).toBeCloseTo(4, 5)
    expect(nodeMotion(motion, 'reference').imageName).toBeUndefined()
  })

  it('carries the reference node with the user cursor and drops both at the same moment', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const placement = motion.scenes[0].timeline[0]
    assert.isDefined(placement.dropAt)
    const nodeFrames = animation(motion, nodeMotion(motion, 'reference').name)
    const userFrames = animation(motion, motion.scenes[0].userCursor.name)
    const carriedNode = nodeFrames.find((frame) =>
      frame.value.includes('opacity:1;transform:translate(0cqw,-6.125cqw)')
    )
    assert.isDefined(carriedNode)
    const carryCursor = userFrames.find(
      (frame) => Math.abs(frame.time - carriedNode.time) < 0.00001
    )
    const dropCursor = userFrames.find(
      (frame) => Math.abs(frame.time - placement.dropAt!) < 0.00001
    )
    const droppedNode = nodeFrames.find(
      (frame) => frame.value === 'opacity:1;transform:translate(0,0) scale(1);'
    )
    assert.isDefined(carryCursor)
    assert.isDefined(dropCursor)
    assert.isDefined(droppedNode)

    expect(cursorPoint(carryCursor.value)).toEqual({ x: 8.125, y: 3 })
    expect(cursorPoint(dropCursor.value)).toEqual({ x: 8.125, y: 9.125 })
    expect(droppedNode.time).toBeCloseTo(dropCursor.time, 6)
    expect(placement.dropAt - placement.start).toBeCloseTo(0.9, 6)
  })

  it('traces all segments of the long preview wire at twice the original connection speed', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const connection = motion.scenes[0].timeline.find(
      (event) => event.type === 'connect' && event.to === 'preview3'
    )
    assert.isDefined(connection?.drawStart)
    assert.isDefined(connection.drawEnd)
    const samples = animation(motion, motion.scenes[0].agentCursor.name).filter(
      (frame) =>
        frame.time >= connection.drawStart! - 0.000001 &&
        frame.time <= connection.drawEnd! + 0.000001
    )

    expect(samples).toHaveLength(181)
    expect(cursorPoint(samples[0].value)).toEqual({ x: 32.3125, y: 9.8125 })
    expect(cursorPoint(samples[samples.length - 1].value)).toEqual({
      x: 46.40625,
      y: 11.125
    })
    expect(connection.drawEnd - connection.drawStart).toBeCloseTo(0.451505, 6)
  })

  it('types each prompt progressively before the next part of the workflow begins', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const typing = motion.scenes[0].timeline.find(
      (event) => event.type === 'type' && event.node === 'generate'
    )
    assert.isDefined(typing)
    assert.isDefined(typing.typingStart)
    assert.isDefined(typing.typingEnd)
    const characters = nodeMotion(motion, 'generate').characters
    assert.isDefined(characters)
    const first = firstVisible(motion, characters[0].name)
    const last = firstVisible(motion, characters[characters.length - 1].name)
    const final = firstVisible(motion, nodeMotion(motion, 'final').name)

    expect(first.end).toBeGreaterThan(typing.typingStart)
    expect(first.end).toBeLessThan(last.end)
    expect(last.end).toBeCloseTo(typing.typingEnd, 5)
    expect(last.end).toBeLessThan(final.start)
    expect(typing.typingEnd - typing.typingStart).toBeCloseTo(0.85, 6)
  })

  it('emits finite ordered keyframes and clears all visual states before the next loop', () => {
    const motion = createWorkflowMotion([peanutWorkflow], {
      width: 1600,
      holdDuration: 4,
      connectionSpeed: 2
    })
    const names = Array.from(
      motion.css.matchAll(/@keyframes ([^{]+)/g),
      ([, name]) => name
    )
    const frames = names.map((name) => animation(motion, name))
    const ordered = frames.every((animation) =>
      animation.every(
        (frame, index) =>
          Number.isFinite(frame.time) &&
          frame.time >= 0 &&
          frame.time <= motion.duration &&
          (index === 0 || frame.time >= animation[index - 1].time)
      )
    )

    expect(ordered).toBe(true)
    expect(
      frames.every((animation) =>
        /opacity:0;|scale\(0\)/.test(animation[animation.length - 1].value)
      )
    ).toBe(true)
    expect(motion.css).not.toMatch(/NaN|Infinity/)
  })

  it('rejects showing preview results before their input wires are connected', () => {
    const images = peanutWorkflow.steps.find(
      (step) => step.type === 'images' && step.nodes.includes('preview1')
    )
    assert.isDefined(images)
    const premature = {
      ...peanutWorkflow,
      steps: [...peanutWorkflow.steps.slice(0, 6), images]
    }

    expect(() => createWorkflowMotion([premature])).toThrow(
      'Workflow images must follow their connections'
    )
  })
})

describe('node window entrances', () => {
  it.for(['base', 'keyframe-white'])(
    'grows the %s window from zero to full size in 250ms without fading',
    (id) => {
      const motion = createWorkflowMotion([productWorkflow])
      const nodeIndex = productWorkflow.nodes.findIndex(
        (node) => node.id === id
      )
      const frames = animation(motion, motion.scenes[0].nodes[nodeIndex].name)
      const fullSizeIndex = frames.findIndex((frame) =>
        frame.value.includes('scale(1)')
      )
      assert.isAbove(fullSizeIndex, 0)
      const entranceStart = frames[fullSizeIndex - 1]
      const entranceEnd = frames[fullSizeIndex]

      expect(
        frames
          .slice(0, fullSizeIndex + 1)
          .every((frame) => frame.value.includes('opacity:1;'))
      ).toBe(true)
      expect(entranceStart.value).toContain('scale(0)')
      expect(entranceStart.value).toContain(
        'animation-timing-function:ease-out;'
      )
      expect(entranceEnd.time - entranceStart.time).toBeCloseTo(0.25, 5)
      expect(frames.at(-1)?.value).toContain('scale(0)')
    }
  )
})

describe('grouped workflow connections', () => {
  const grouped: MotionWorkflow = {
    ...peanutWorkflow,
    steps: peanutWorkflow.steps.flatMap<MotionStep>((step) => {
      if (step.type !== 'connect' || step.from !== 'variations') return [step]
      return step.to === 'preview1'
        ? [
            {
              type: 'connect-group',
              from: 'variations',
              to: ['preview1', 'preview2', 'preview3']
            }
          ]
        : []
    })
  }

  it('draws all three preview wires together before revealing their images', () => {
    const motion = createWorkflowMotion([grouped])
    const serial = createWorkflowMotion([peanutWorkflow])
    const group = motion.scenes[0].timeline.find(
      (event) => event.type === 'connect-group'
    )
    assert.isDefined(group?.drawStart)
    assert.isDefined(group.drawEnd)
    const draws = motion.scenes[0].wires
      .filter((wire) => wire.name.includes('-variations-preview'))
      .map((wire) => {
        const frames = animation(motion, wire.name)
        return {
          start: frames.find(
            (frame) => frame.value === 'stroke-dashoffset:1;opacity:1;'
          )?.time,
          end: frames.find(
            (frame) => frame.value === 'stroke-dashoffset:0;opacity:1;'
          )?.time
        }
      })
    const imageStarts = ['preview1', 'preview2', 'preview3'].map(
      (id) => firstVisible(motion, nodeMotion(motion, id).imageName).start
    )

    expect(draws).toHaveLength(3)
    expect(draws).toEqual([draws[0], draws[0], draws[0]])
    expect(draws[0].start).toBeCloseTo(group.drawStart, 5)
    expect(draws[0].end).toBeCloseTo(group.drawEnd, 5)
    expect(group.drawEnd - group.drawStart).toBeCloseTo(0.451505, 6)
    expect(Math.min(...imageStarts)).toBeGreaterThan(group.drawEnd)
    expect(imageStarts).toEqual([
      imageStarts[0],
      imageStarts[0],
      imageStarts[0]
    ])
    expect(serial.duration - motion.duration).toBeCloseTo(1.772575, 6)
  })

  it('keeps the agent at the shared source for the entire simultaneous draw', () => {
    const motion = createWorkflowMotion([grouped])
    const group = motion.scenes[0].timeline.find(
      (event) => event.type === 'connect-group'
    )
    assert.isDefined(group?.drawStart)
    assert.isDefined(group.drawEnd)
    const { drawStart, drawEnd } = group
    const cursorFrames = animation(
      motion,
      motion.scenes[0].agentCursor.name
    ).filter(
      (frame) =>
        frame.time >= drawStart - 0.00001 && frame.time <= drawEnd + 0.00001
    )

    expect(cursorFrames.map((frame) => cursorPoint(frame.value))).toEqual([
      { x: 32.3125, y: 9.8125 },
      { x: 32.3125, y: 9.8125 }
    ])
    expect(cursorFrames[0].time).toBeCloseTo(drawStart, 5)
    expect(cursorFrames[1].time).toBeCloseTo(drawEnd, 5)
  })

  it.for([
    { name: 'empty', targets: [] },
    { name: 'duplicate', targets: ['preview1', 'preview1'] }
  ])('rejects $name grouped destinations', ({ targets }) => {
    const invalid = {
      ...grouped,
      steps: grouped.steps.map((step) =>
        step.type === 'connect-group' ? { ...step, to: targets } : step
      )
    }

    expect(() => createWorkflowMotion([invalid])).toThrow(
      'Workflow connections need distinct targets'
    )
  })
})

describe('final output focus', () => {
  const focus: MotionStep = {
    type: 'focus',
    node: 'final',
    offset: { x: -514, y: -41.5 },
    scale: 2,
    duration: 0.8
  }
  const focused: MotionWorkflow = {
    ...peanutWorkflow,
    steps: [...peanutWorkflow.steps, focus]
  }

  it('moves and enlarges the completed output above the graph for the full hold, then resets', () => {
    const motion = createWorkflowMotion([focused], { holdDuration: 10 })
    const original = createWorkflowMotion([peanutWorkflow], {
      holdDuration: 10
    })
    const event = motion.scenes[0].timeline.at(-1)
    assert.isDefined(event)
    const final = nodeMotion(motion, 'final')
    const image = firstVisible(motion, final.imageName)
    const frames = animation(motion, final.name)
    const focusedFrames = frames.filter(
      (frame) =>
        frame.value.startsWith('opacity:1;') && frame.value.includes('scale(2)')
    )
    const startFrame = frames.find(
      (frame) => Math.abs(frame.time - event.start) < 0.00001
    )

    expect(event.type).toBe('focus')
    expect(event.start).toBeCloseTo(image.end, 5)
    expect(event.end - event.start).toBeCloseTo(0.8, 6)
    expect(startFrame?.value).toContain(
      'z-index:3;animation-timing-function:ease-in-out;'
    )
    expect(focusedFrames).toHaveLength(2)
    expect(focusedFrames[0].value).toBe(
      'opacity:1;transform:translate(-32.125cqw,-2.59375cqw) scale(2);z-index:3;'
    )
    expect(focusedFrames[0].time).toBeCloseTo(event.end, 5)
    expect(focusedFrames[1].time - focusedFrames[0].time).toBeCloseTo(10, 5)
    expect(final.mediaAt).toBe(nodeMotion(original, 'final').mediaAt)
    expect(frames.at(-1)?.value).toBe(
      'opacity:1;transform:translate(0,0) scale(0);z-index:0;'
    )
  })

  it('fades the focused output in place before resetting its position invisibly', () => {
    const motion = createWorkflowMotion([focused], { holdDuration: 10 })
    const frames = animation(motion, nodeMotion(motion, 'final').name)
    const exit = frames.filter(
      (frame) => frame.time >= motion.duration - 0.25 - 0.00001
    )
    const transform = (value: string) => value.match(/transform:([^;]+);/)?.[1]

    expect(exit).toHaveLength(4)
    expect(
      exit.map((frame) => frame.value.match(/opacity:([^;]+);/)?.[1])
    ).toEqual(['1', '0', '0', '1'])
    expect(transform(exit[0].value)).toBe(
      'translate(-32.125cqw,-2.59375cqw) scale(2)'
    )
    expect(transform(exit[1].value)).toBe(transform(exit[0].value))
    expect(exit[1].time - exit[0].time).toBeCloseTo(0.15, 5)
    expect(transform(exit[2].value)).toBe('translate(0,0) scale(0)')
    expect(transform(exit[3].value)).toBe(transform(exit[2].value))
  })

  it('dims other cards and hides all wires and cursors together before the showcase settles', () => {
    const motion = createWorkflowMotion([focused])
    const scene = motion.scenes[0]
    const event = scene.timeline.at(-1)
    assert.isDefined(event)
    const dimFrames = scene.nodes
      .filter((node) => node.name !== nodeMotion(motion, 'final').name)
      .map((node) =>
        animation(motion, node.name).find((frame) =>
          frame.value.startsWith('opacity:0.25;')
        )
      )
    const hiddenFrames = [
      ...scene.wires,
      scene.agentCursor,
      scene.userCursor
    ].map(({ name }) =>
      animation(motion, name).find(
        (frame) =>
          frame.time > event.start && frame.value.includes('opacity:0;')
      )
    )

    expect(dimFrames).toHaveLength(6)
    expect(
      dimFrames.every(
        (frame) => frame && Math.abs(frame.time - event.start - 0.15) < 0.00001
      )
    ).toBe(true)
    expect(hiddenFrames).toHaveLength(8)
    expect(
      hiddenFrames.every(
        (frame) => frame && Math.abs(frame.time - event.start - 0.15) < 0.00001
      )
    ).toBe(true)
    expect(event.start + 0.15).toBeLessThan(event.end)
  })

  it('rejects focusing an empty output before its image is revealed', () => {
    const premature = {
      ...peanutWorkflow,
      steps: [...peanutWorkflow.steps.slice(0, -1), focus]
    }

    expect(() => createWorkflowMotion([premature])).toThrow(
      'Workflow focus needs a completed image reveal'
    )
  })

  it('rejects continuing the workflow after the terminal focus', () => {
    const continued: MotionWorkflow = {
      ...focused,
      steps: [...focused.steps, { type: 'pause', duration: 1 }]
    }

    expect(() => createWorkflowMotion([continued])).toThrow(
      'Workflow focus must be the final step'
    )
  })
})
