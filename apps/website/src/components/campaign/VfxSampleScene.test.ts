import { render, screen, within } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import VfxSampleScene from './VfxSampleScene.vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

it('names the sample picker separately from the original footage', () => {
  stubIntersectionObserver()
  render(
    defineComponent({
      setup: () => () =>
        h(VfxSampleScene, {
          variants: [
            { id: 'relight_golden', label: 'Golden hour' },
            { id: 'relight_night', label: 'Night' }
          ],
          originalLabel: 'Original footage',
          choicesLabel: 'Comparison',
          sliderLabel: 'Compare footage',
          selected: 'relight_golden',
          time: 0,
          paused: true
        })
    })
  )

  const choices = screen.getByRole('group', { name: 'Comparison' })
  expect(
    within(choices)
      .getAllByRole('button')
      .map((button) => button.textContent.trim())
  ).toEqual(['Golden hour', 'Night'])
  expect(screen.queryByRole('group', { name: 'Original footage' })).toBeNull()
  expect(screen.getByText('Original footage')).toBeVisible()
})
