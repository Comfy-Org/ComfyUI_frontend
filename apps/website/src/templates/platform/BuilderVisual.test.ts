// @vitest-environment happy-dom
// The subject is a decorative aria-hidden SVG, so there is nothing to query
// by role or text: the assertion is a count of animated nodes.
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUse from '@vueuse/core'

import BuilderVisual from './BuilderVisual.vue'

// The gate reads element and document visibility, neither of which happy-dom
// drives on its own, so both are stubbed to make the two states reachable.
const hoisted = vi.hoisted(() => ({
  onScreen: true,
  documentVisibility: 'visible' as DocumentVisibilityState
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  const { computed } = await import('vue')
  return {
    ...actual,
    useElementVisibility: () => computed(() => hoisted.onScreen),
    useDocumentVisibility: () => computed(() => hoisted.documentVisibility)
  }
})

/** Every animation in the diagram, each of which costs main-thread work. */
const ANIMATION_CLASSES = [
  'animate-dash-flow',
  'animate-platform-builder-float',
  'animate-platform-builder-float-slow',
  'animate-platform-builder-float-delayed',
  'animate-platform-builder-pulse'
]

function countAnimated(container: Element) {
  return ANIMATION_CLASSES.reduce(
    (total, cls) => total + container.querySelectorAll(`.${cls}`).length,
    0
  )
}

describe('BuilderVisual', () => {
  beforeEach(() => {
    hoisted.onScreen = true
    hoisted.documentVisibility = 'visible'
  })

  it('animates while on screen in a visible tab', () => {
    const { container } = render(BuilderVisual)

    expect(countAnimated(container)).toBe(9)
  })

  it('parks every animation once scrolled out of view', () => {
    hoisted.onScreen = false
    const { container } = render(BuilderVisual)

    // None of these can be composited, so off-screen they would otherwise
    // keep doing main-thread work every frame.
    expect(countAnimated(container)).toBe(0)
    // The diagram itself still renders; only the motion stops.
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('parks every animation while the tab is hidden', () => {
    hoisted.documentVisibility = 'hidden'
    const { container } = render(BuilderVisual)

    expect(countAnimated(container)).toBe(0)
  })
})
