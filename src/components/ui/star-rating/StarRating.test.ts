import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import StarRating from './StarRating.vue'
import {
  clampRating,
  getDefaultRevealForPresentation,
  getDisplayRating,
  getRatingFromDigitKey,
  getRatingFromStarClick,
  getStarRatingRevealState,
  isStarFilled
} from './starRating'
import StarRatingHostHarness from './StarRatingHostHarness.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      starRating: {
        groupLabel: 'Star rating',
        rateStars: 'Rate {count} star | Rate {count} stars'
      }
    }
  }
})

async function flush() {
  await nextTick()
  await nextTick()
}

function renderStarRating(props: Record<string, unknown> = {}) {
  return render(StarRating, {
    props: { modelValue: 0, ...props },
    global: { plugins: [i18n] }
  })
}

function getStarButtons() {
  return screen.getAllByRole('button')
}

function filledStarCount(container: HTMLElement) {
  return container.querySelectorAll('.text-warning-background').length
}

describe('starRating helpers', () => {
  it('clamps rating to 0 through max', () => {
    expect(clampRating(-1, 5)).toBe(0)
    expect(clampRating(3.7, 5)).toBe(4)
    expect(clampRating(9, 5)).toBe(5)
  })

  it('uses hover rating for display when hovering', () => {
    expect(getDisplayRating(1, 4)).toBe(4)
    expect(getDisplayRating(1, null)).toBe(1)
  })

  it('toggles off when clicking the current star', () => {
    expect(getRatingFromStarClick(3, 3)).toBe(0)
    expect(getRatingFromStarClick(2, 4)).toBe(4)
  })

  it('maps digit keys to ratings', () => {
    expect(getRatingFromDigitKey('0', 5)).toBe(0)
    expect(getRatingFromDigitKey('4', 5)).toBe(4)
    expect(getRatingFromDigitKey('6', 5)).toBeNull()
    expect(getRatingFromDigitKey('a', 5)).toBeNull()
  })

  it('fills stars up to the display rating', () => {
    expect(isStarFilled(1, 3)).toBe(true)
    expect(isStarFilled(4, 3)).toBe(false)
  })

  it('defaults reveal from presentation', () => {
    expect(getDefaultRevealForPresentation('inline')).toBe('always')
    expect(getDefaultRevealForPresentation('overlay')).toBe('host-hover')
  })
})

describe('getStarRatingRevealState', () => {
  it('is always visible and interactive when reveal is always', () => {
    expect(
      getStarRatingRevealState({
        reveal: 'always',
        hostHovered: false,
        selfHovered: false,
        rating: 0,
        disabled: false,
        explicitlyReadonly: false
      })
    ).toEqual({
      visible: true,
      opacityClass: 'opacity-100',
      pointerEventsClass: 'pointer-events-auto',
      effectivelyReadonly: false
    })
  })

  it('is hidden when unrated and host is not hovered', () => {
    expect(
      getStarRatingRevealState({
        reveal: 'host-hover',
        hostHovered: false,
        selfHovered: false,
        rating: 0,
        disabled: false,
        explicitlyReadonly: false
      }).visible
    ).toBe(false)
  })

  it('is dimmed and readonly when unrated and host is hovered', () => {
    expect(
      getStarRatingRevealState({
        reveal: 'host-hover',
        hostHovered: true,
        selfHovered: false,
        rating: 0,
        disabled: false,
        explicitlyReadonly: false
      })
    ).toMatchObject({
      visible: true,
      opacityClass: 'opacity-60',
      effectivelyReadonly: true
    })
  })

  it('is interactive when stars are hovered on host-hover reveal', () => {
    expect(
      getStarRatingRevealState({
        reveal: 'host-hover',
        hostHovered: true,
        selfHovered: true,
        rating: 0,
        disabled: false,
        explicitlyReadonly: false
      })
    ).toMatchObject({
      visible: true,
      opacityClass: 'opacity-100',
      effectivelyReadonly: false
    })
  })

  it('stays visible when rated even if host is not hovered', () => {
    expect(
      getStarRatingRevealState({
        reveal: 'host-hover',
        hostHovered: false,
        selfHovered: false,
        rating: 3,
        disabled: false,
        explicitlyReadonly: false
      })
    ).toMatchObject({
      visible: true,
      opacityClass: 'opacity-100',
      effectivelyReadonly: true
    })
  })
})

describe('StarRating', () => {
  it('sets rating when a star is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({ modelValue: 0, 'onUpdate:modelValue': onUpdate })
    await flush()

    await user.click(getStarButtons()[2])

    expect(onUpdate).toHaveBeenCalledWith(3)
  })

  it('clears rating when the active star is clicked again', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({ modelValue: 3, 'onUpdate:modelValue': onUpdate })
    await flush()

    await user.click(getStarButtons()[2])

    expect(onUpdate).toHaveBeenCalledWith(0)
  })

  it('sets rating from digit keys when focused', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({ modelValue: 0, 'onUpdate:modelValue': onUpdate })
    await flush()

    screen.getByRole('group').focus()
    await user.keyboard('4')

    expect(onUpdate).toHaveBeenCalledWith(4)
  })

  it('clears rating when 0 is pressed', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({ modelValue: 2, 'onUpdate:modelValue': onUpdate })
    await flush()

    screen.getByRole('group').focus()
    await user.keyboard('0')

    expect(onUpdate).toHaveBeenCalledWith(0)
  })

  it('does not update when disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({
      modelValue: 0,
      disabled: true,
      'onUpdate:modelValue': onUpdate
    })
    await flush()

    await user.click(getStarButtons()[2])

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not update when readonly', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({
      modelValue: 0,
      readonly: true,
      'onUpdate:modelValue': onUpdate
    })
    await flush()

    await user.click(getStarButtons()[2])

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows numeric count when showCount is enabled', async () => {
    renderStarRating({ modelValue: 3, showCount: true })
    await flush()

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides numeric count when showCount is disabled', async () => {
    renderStarRating({ modelValue: 3, showCount: false })
    await flush()

    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('previews hover fill without committing the rating', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    renderStarRating({
      modelValue: 1,
      'onUpdate:modelValue': onUpdate
    })
    await flush()

    const group = screen.getByRole('group')

    expect(filledStarCount(group)).toBe(1)

    await user.hover(getStarButtons()[3])
    await flush()

    expect(filledStarCount(group)).toBe(4)
    expect(onUpdate).not.toHaveBeenCalled()

    await user.unhover(group)
    await flush()

    expect(filledStarCount(group)).toBe(1)
  })

  it('is readonly on host-hover until the star group is hovered', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(StarRatingHostHarness, {
      props: {
        modelValue: 0,
        'onUpdate:modelValue': onUpdate
      },
      global: { plugins: [i18n] }
    })
    await flush()

    const host = screen.getByTestId('star-rating-host')
    const starButtons = () => screen.getAllByRole('button')

    await user.hover(host)
    await flush()

    expect(starButtons()[0]).toBeDisabled()

    await user.hover(screen.getByRole('group'))
    await flush()

    expect(starButtons()[0]).not.toBeDisabled()

    await user.click(starButtons()[2])
    expect(onUpdate).toHaveBeenCalledWith(3)
  })
})
