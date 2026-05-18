import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import CreditTopUpOption from '@/components/dialog/content/credit/CreditTopUpOption.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

function renderOption(
  props?: Partial<{
    credits: number
    description: string
    selected: boolean
    onSelect: () => void
  }>
) {
  const user = userEvent.setup()
  const result = render(CreditTopUpOption, {
    props: {
      credits: 1000,
      description: '~100 videos*',
      selected: false,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
  return { user, ...result }
}

describe('CreditTopUpOption', () => {
  it('renders credit amount and description', () => {
    renderOption({ credits: 5000, description: '~500 videos*' })
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('~500 videos*')).toBeInTheDocument()
  })

  it('applies unselected styling when not selected', () => {
    const { container } = renderOption({ selected: false })
    // eslint-disable-next-line testing-library/no-node-access
    const rootDiv = container.firstElementChild as HTMLElement
    expect(rootDiv).toHaveClass(
      'bg-component-node-disabled',
      'border-transparent'
    )
  })

  it('emits select event when clicked', async () => {
    const selectSpy = vi.fn()
    const { user } = renderOption({ onSelect: selectSpy })
    await user.click(screen.getByText('1,000'))
    expect(selectSpy).toHaveBeenCalledOnce()
  })
})
