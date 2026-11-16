import { describe, expect, it, vi } from 'vitest'

import { useCompositedTransform } from './useCompositedTransform'

function keyframeTransforms(element: HTMLElement) {
  return element
    .getAnimations()
    .flatMap(({ effect }) =>
      effect instanceof KeyframeEffect
        ? [effect.getKeyframes().map(({ transform }) => transform)]
        : []
    )
}

describe('useCompositedTransform', () => {
  it('writes the transform inline and holds it in one paused animation', () => {
    const element = document.createElement('div')
    const animate = vi.spyOn(element, 'animate')
    const { setTransform } = useCompositedTransform(element)

    setTransform('translate(1px, 2px)')
    setTransform('translate(3px, 4px)')

    expect(element.style.transform).toBe('translate(3px, 4px)')
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.results[0].value.playState).toBe('paused')
    expect(keyframeTransforms(element)).toEqual([
      ['translate(3px, 4px)', 'translate(3px, 4px)']
    ])
  })

  it('animates the current element when the target changes', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    let target = first
    const { setTransform } = useCompositedTransform(() => target)

    setTransform('scale(1)')
    target = second
    setTransform('scale(2)')

    expect(keyframeTransforms(first)).toEqual([['scale(1)', 'scale(1)']])
    expect(keyframeTransforms(second)).toEqual([['scale(2)', 'scale(2)']])
  })

  it('keeps the inline transform and drops the animation when released', () => {
    const element = document.createElement('div')
    const { setTransform, releaseTransform } = useCompositedTransform(element)

    setTransform('scale(2)')
    releaseTransform()

    expect(element.style.transform).toBe('scale(2)')
    expect(keyframeTransforms(element)).toEqual([])
  })

  it('animates again after a release', () => {
    const element = document.createElement('div')
    const { setTransform, releaseTransform } = useCompositedTransform(element)

    setTransform('scale(2)')
    releaseTransform()
    setTransform('scale(3)')

    expect(keyframeTransforms(element)).toEqual([['scale(3)', 'scale(3)']])
  })

  it('does nothing without a target element', () => {
    const { setTransform, releaseTransform } = useCompositedTransform(undefined)

    expect(() => {
      setTransform('scale(1)')
      releaseTransform()
    }).not.toThrow()
  })
})
