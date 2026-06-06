import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import AssetRating from './AssetRating.vue'

const messages = {
  en: {
    assetRating: {
      label: 'Asset rating',
      rateAsset: 'Rate {rating} out of {max}',
      clearRating: 'Clear {rating} out of {max} rating'
    }
  }
}

interface RenderOptions {
  initialRating?: number | null
  disabled?: boolean
  readOnly?: boolean
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'stars' | 'paintbrushes' | 'comfy'
}

function renderRating(options: RenderOptions = {}) {
  const handleChange = vi.fn()
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages
  })

  const TestHarness = defineComponent({
    components: { AssetRating },
    setup() {
      const rating = ref<number | null>(options.initialRating ?? null)

      return {
        handleChange,
        options,
        rating
      }
    },
    template: `
      <div>
        <AssetRating
          v-model="rating"
          :disabled="options.disabled"
          :max="options.max"
          :read-only="options.readOnly"
          :size="options.size"
          :variant="options.variant"
          @change="handleChange"
        />
        <output data-testid="rating-value">
          {{ rating === null ? 'null' : rating }}
        </output>
      </div>
    `
  })

  return {
    handleChange,
    user,
    ...render(TestHarness, {
      global: {
        plugins: [i18n]
      }
    })
  }
}

describe('AssetRating', () => {
  it('renders an unrated asset rating control', () => {
    renderRating()

    expect(screen.getByRole('group', { name: 'Asset rating' })).toBeVisible()
    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(
      screen.getByRole('button', { name: 'Rate 1 out of 5' })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('rates an asset when a star is clicked', async () => {
    const { handleChange, user } = renderRating()

    await user.click(screen.getByRole('button', { name: 'Rate 4 out of 5' }))

    expect(screen.getByTestId('rating-value')).toHaveTextContent('4')
    expect(handleChange).toHaveBeenCalledWith(4)
    expect(
      screen.getByRole('button', { name: 'Clear 4 out of 5 rating' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears the rating when the selected star is clicked again', async () => {
    const { handleChange, user } = renderRating({ initialRating: 3 })

    await user.click(
      screen.getByRole('button', { name: 'Clear 3 out of 5 rating' })
    )

    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(handleChange).toHaveBeenCalledWith(null)
  })

  it('previews ratings on hover without committing a value', async () => {
    const { handleChange, user } = renderRating()

    await user.hover(screen.getByRole('button', { name: 'Rate 5 out of 5' }))

    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('updates the rating with arrow keys', async () => {
    const { handleChange, user } = renderRating()
    screen.getByRole('button', { name: 'Rate 1 out of 5' }).focus()

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}')

    expect(screen.getByTestId('rating-value')).toHaveTextContent('1')
    expect(handleChange).toHaveBeenLastCalledWith(1)
  })

  it('sets the rating from a number key', async () => {
    const { handleChange, user } = renderRating()
    screen.getByRole('button', { name: 'Rate 1 out of 5' }).focus()

    await user.keyboard('4')

    expect(screen.getByTestId('rating-value')).toHaveTextContent('4')
    expect(handleChange).toHaveBeenCalledWith(4)
  })

  it.for(['paintbrushes', 'comfy'] as const)(
    'supports the %s variant with the same rating behavior',
    async (variant) => {
      const { handleChange, user } = renderRating({ variant })

      await user.click(screen.getByRole('button', { name: 'Rate 5 out of 5' }))

      expect(screen.getByTestId('rating-value')).toHaveTextContent('5')
      expect(handleChange).toHaveBeenCalledWith(5)
    }
  )

  it('clears the rating with delete and backspace', async () => {
    const { handleChange, user } = renderRating({ initialRating: 4 })
    screen.getByRole('button', { name: 'Clear 4 out of 5 rating' }).focus()

    await user.keyboard('{Delete}')

    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(handleChange).toHaveBeenCalledWith(null)

    await user.click(screen.getByRole('button', { name: 'Rate 2 out of 5' }))
    await user.keyboard('{Backspace}')

    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(handleChange).toHaveBeenLastCalledWith(null)
  })

  it('does not update when disabled', async () => {
    const { handleChange, user } = renderRating({ disabled: true })
    const firstStar = screen.getByRole('button', {
      name: 'Rate 1 out of 5'
    })

    await user.click(firstStar)

    expect(firstStar).toBeDisabled()
    expect(screen.getByTestId('rating-value')).toHaveTextContent('null')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not update when read-only', async () => {
    const { handleChange, user } = renderRating({
      initialRating: 2,
      readOnly: true
    })
    const selectedStar = screen.getByRole('button', {
      name: 'Clear 2 out of 5 rating'
    })

    await user.click(selectedStar)

    expect(selectedStar).toBeDisabled()
    expect(screen.getByTestId('rating-value')).toHaveTextContent('2')
    expect(handleChange).not.toHaveBeenCalled()
  })
})
