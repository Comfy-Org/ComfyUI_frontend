import { assert, describe, expect, it } from 'vitest'

import { productWorkflow } from './productWorkflow'
import type { MotionWorkflow } from './workflowMotion'
import { createWorkflowMotion } from './workflowMotion'

function animation(
  motion: ReturnType<typeof createWorkflowMotion>,
  name: string
) {
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

describe('workflow motion', () => {
  it.for([
    { type: 'pause', duration: -0.01 },
    { type: 'pause', duration: NaN },
    { type: 'pause', duration: Infinity },
    { type: 'place', node: 'base', actor: 'agent', duration: 0.099 },
    { type: 'images', nodes: [], delay: -0.01 }
  ] satisfies MotionWorkflow['steps'])(
    'rejects invalid $type duration',
    (step) => {
      expect(() =>
        createWorkflowMotion({ ...productWorkflow, steps: [step] })
      ).toThrow('Workflow duration')
    }
  )

  it.for([
    { step: { type: 'pause', duration: 0 }, duration: 10.4 },
    {
      step: { type: 'place', node: 'base', actor: 'agent', duration: 0.1 },
      duration: 10.85
    },
    { step: { type: 'images', nodes: [], delay: 0 }, duration: 10.7 }
  ] satisfies { step: MotionWorkflow['steps'][number]; duration: number }[])(
    'accepts the minimum $step.type duration',
    ({ step, duration }) => {
      expect(
        createWorkflowMotion({ ...productWorkflow, steps: [step] }).duration
      ).toBeCloseTo(duration)
    }
  )

  it.for(['base', 'keyframe-white'])(
    'grows the %s window from zero to full size in 250ms without fading',
    (id) => {
      const motion = createWorkflowMotion(productWorkflow)
      const nodeIndex = productWorkflow.nodes.findIndex(
        (node) => node.id === id
      )
      const frames = animation(motion, motion.scene.nodes[nodeIndex].name)
      const fullSizeIndex = frames.findIndex((frame) =>
        frame.value.includes('scale(1)')
      )
      assert.isAbove(fullSizeIndex, 0)
      const start = frames[fullSizeIndex - 1]
      const end = frames[fullSizeIndex]

      expect(start.value).toContain('opacity:1;')
      expect(start.value).toContain('scale(0)')
      expect(start.value).toContain('animation-timing-function:ease-out;')
      expect(end.time - start.time).toBeCloseTo(0.25, 5)
      expect(frames.at(-1)?.value).toContain('scale(0)')
    }
  )

  it('draws grouped connections together from their shared source', () => {
    const motion = createWorkflowMotion(productWorkflow)
    const groupedWires = motion.scene.wires.filter((wire) =>
      wire.name.includes('-keygen-keyframe-')
    )

    expect(groupedWires).toHaveLength(3)
    const [white, gold, purple] = groupedWires.map((wire) =>
      animation(motion, wire.name)
    )
    expect(gold).toEqual(white)
    expect(purple).toEqual(white)
  })

  it('rejects duplicate grouped destinations', () => {
    const invalid: MotionWorkflow = {
      ...productWorkflow,
      steps: productWorkflow.steps.map((step) =>
        step.type === 'connect-group'
          ? { ...step, to: [step.to[0], step.to[0]] }
          : step
      )
    }

    expect(() => createWorkflowMotion(invalid)).toThrow(
      'Workflow connections need distinct targets'
    )
  })

  it('emits finite ordered keyframes that reset before the next loop', () => {
    const motion = createWorkflowMotion(productWorkflow)
    const names = Array.from(
      motion.css.matchAll(/@keyframes ([^{]+)/g),
      ([, name]) => name
    )

    for (const name of names) {
      const frames = animation(motion, name)
      expect(
        frames.every(
          (frame, index) =>
            Number.isFinite(frame.time) &&
            frame.time >= 0 &&
            frame.time <= motion.duration &&
            (index === 0 || frame.time >= frames[index - 1].time)
        )
      ).toBe(true)
    }
    expect(motion.css).not.toMatch(/NaN|Infinity/)
  })
})
