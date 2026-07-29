import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { clearCoachmarks, registerCoachmark } from './coachmarkRegistry'
import type { CoachId, CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'

function step(coachId: CoachId): CoachStep {
  return { name: 'step', placement: 'right', coachId }
}

function laidOut(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => new DOMRect(10, 10, 80, 30)
  return el
}

function hidden(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0)
  return el
}

function mountNode(): HTMLElement {
  const node = laidOut()
  node.setAttribute('data-node-id', '7')
  document.body.append(node)
  return node
}

function movingTarget(nodeId = '7') {
  const listeners = new Set<() => void>()
  return {
    selector: `[data-node-id="${nodeId}"]`,
    onMove: (notify: () => void) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    move: () => listeners.forEach((notify) => notify()),
    listenerCount: () => listeners.size
  }
}

describe('useCoachmarkTarget', () => {
  afterEach(() => {
    clearCoachmarks()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  function setup(coachId: CoachId) {
    const scope = effectScope()
    const stepRef = ref<CoachStep | null>(step(coachId))
    const cardRef = ref<HTMLElement | null>(null)
    const api = scope.run(() => useCoachmarkTarget(stepRef, cardRef))!
    return { scope, api }
  }

  it('resolves the first laid-out candidate for the step target', () => {
    const el = laidOut()
    registerCoachmark('outputs', el)
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBe(el)
    scope.stop()
  })

  it('skips a registered target that is not laid out', () => {
    registerCoachmark('outputs', hidden())
    const laid = laidOut()
    registerCoachmark('outputs', laid)
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBe(laid)
    scope.stop()
  })

  it('picks up a target that registers after the step starts', () => {
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBeNull()

    const el = laidOut()
    registerCoachmark('outputs', el)
    expect(api.targetEl.value).toBe(el)
    scope.stop()
  })

  it('leaves the document unwatched for a step targeting an element', async () => {
    const el = laidOut()
    registerCoachmark('outputs', el)
    const { scope, api } = setup('outputs')
    expect(api.targetEl.value).toBe(el)

    const measure = vi.spyOn(el, 'getBoundingClientRect')
    document.body.append(document.createElement('div'))
    await nextTick()

    expect(
      measure,
      'only a selector can be swapped without the registry noticing, so only it needs watching'
    ).not.toHaveBeenCalled()
    scope.stop()
  })

  describe('a target the camera carries', () => {
    it('anchors to the node its selector names', () => {
      const node = mountNode()
      registerCoachmark('outputs', movingTarget())
      const { scope, api } = setup('outputs')

      expect(
        api.targetEl.value,
        'Floating UI has to be handed the node, not a stand-in for it'
      ).toBe(node)
      scope.stop()
    })

    it('subscribes to its motion, which fires no DOM event', async () => {
      mountNode()
      const target = movingTarget()
      registerCoachmark('outputs', target)
      const { scope } = setup('outputs')
      await nextTick()

      expect(target.listenerCount()).toBe(1)

      scope.stop()
      expect(
        target.listenerCount(),
        'a subscription outliving its tour follows the node forever'
      ).toBe(0)
    })

    it('has nothing to anchor to while its node is unmounted', () => {
      registerCoachmark('outputs', movingTarget())
      const { scope, api } = setup('outputs')

      expect(
        api.targetEl.value,
        'the engine waits for the node, so a card is never placed against nothing'
      ).toBeNull()
      expect(
        api.targetMoves.value,
        'a step with nothing on screen has no motion to describe'
      ).toBe(false)
      scope.stop()
    })

    it('follows the node through a remount the camera never announces', async () => {
      const first = mountNode()
      registerCoachmark('outputs', movingTarget())
      const { scope, api } = setup('outputs')
      expect(api.targetEl.value).toBe(first)

      first.remove()
      const second = mountNode()
      await nextTick()

      expect(
        api.targetEl.value,
        'a card anchored to a detached node measures zero and flies off screen'
      ).toBe(second)
      scope.stop()
    })

    it('leaves the DOM alone while the camera moves', () => {
      mountNode()
      const target = movingTarget()
      registerCoachmark('outputs', target)
      const { scope, api } = setup('outputs')
      expect(api.targetEl.value).not.toBeNull()

      const querySelector = vi.spyOn(document, 'querySelector')
      target.move()

      expect(
        querySelector,
        're-resolving the selector every camera frame forces a layout flush per frame'
      ).not.toHaveBeenCalled()
      scope.stop()
    })

    it('follows only the candidate it anchored to', () => {
      mountNode()
      const anchored = movingTarget()
      const elsewhere = movingTarget('8')
      registerCoachmark('outputs', anchored)
      registerCoachmark('outputs', elsewhere)
      const { scope, api } = setup('outputs')

      expect(api.targetEl.value).not.toBeNull()
      expect(anchored.listenerCount()).toBe(1)
      expect(
        elsewhere.listenerCount(),
        'a candidate the card is not anchored to must not reposition it'
      ).toBe(0)
      scope.stop()
    })

    it('reports the motion of the candidate it anchored to', () => {
      const el = laidOut()
      registerCoachmark('outputs', el)
      mountNode()
      registerCoachmark('outputs', movingTarget())
      const { scope, api } = setup('outputs')

      expect(api.targetEl.value).toBe(el)
      expect(
        api.targetMoves.value,
        'a still target sharing a coach id loses its glide if an unrelated one moves'
      ).toBe(false)
      scope.stop()
    })
  })
})
