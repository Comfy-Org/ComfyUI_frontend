import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import BatchNavigation from './BatchNavigation.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { batch: { index: '{current} / {total}' } } }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  props: { disabled: { type: Boolean, default: false } },
  template:
    '<button v-bind="$attrs" :disabled="disabled" type="button"><slot /></button>'
})

function renderBatch(count: number, initialIndex = 0) {
  const index = ref(initialIndex)
  const Harness = defineComponent({
    components: { BatchNavigation },
    setup: () => ({ index, count }),
    template: '<BatchNavigation v-model="index" :count="count" />'
  })
  const utils = render(Harness, {
    global: { plugins: [i18n], stubs: { Button: ButtonStub } }
  })
  return { ...utils, index }
}

describe('BatchNavigation', () => {
  describe('Visibility', () => {
    it('renders nothing when count is 1', () => {
      renderBatch(1)
      expect(screen.queryByTestId('batch-counter')).toBeNull()
    })

    it('renders nothing when count is 0', () => {
      renderBatch(0)
      expect(screen.queryByTestId('batch-counter')).toBeNull()
    })

    it('renders the counter when count is greater than 1', () => {
      renderBatch(3)
      expect(screen.getByTestId('batch-counter')).toBeInTheDocument()
    })
  })

  describe('Counter display', () => {
    it('formats counter as "current / total" using 1-based index', () => {
      renderBatch(5, 0)
      expect(screen.getByTestId('batch-counter')).toHaveTextContent('1 / 5')
    })

    it('updates the counter when index changes externally', () => {
      renderBatch(5, 3)
      expect(screen.getByTestId('batch-counter')).toHaveTextContent('4 / 5')
    })
  })

  describe('Navigation', () => {
    it('advances the index when the next button is clicked', async () => {
      const { index } = renderBatch(3, 0)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('batch-next'))
      expect(index.value).toBe(1)
    })

    it('decrements the index when the previous button is clicked', async () => {
      const { index } = renderBatch(3, 2)
      const user = userEvent.setup()
      await user.click(screen.getByTestId('batch-prev'))
      expect(index.value).toBe(1)
    })

    it('disables the previous button at the first item', () => {
      renderBatch(3, 0)
      expect(screen.getByTestId('batch-prev')).toBeDisabled()
      expect(screen.getByTestId('batch-next')).not.toBeDisabled()
    })

    it('disables the next button at the last item', () => {
      renderBatch(3, 2)
      expect(screen.getByTestId('batch-prev')).not.toBeDisabled()
      expect(screen.getByTestId('batch-next')).toBeDisabled()
    })

    it('enables both buttons in the middle of the range', () => {
      renderBatch(3, 1)
      expect(screen.getByTestId('batch-prev')).not.toBeDisabled()
      expect(screen.getByTestId('batch-next')).not.toBeDisabled()
    })
  })
})
