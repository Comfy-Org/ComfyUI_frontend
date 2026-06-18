import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import TypeformEmbed from './TypeformEmbed.vue'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({ t: (key: string) => key }))
}))

const embedState = vi.hoisted(() => ({
  typeformError: false,
  isValidTypeformId: true
}))

vi.mock('./useTypeformEmbed', () => ({
  useTypeformEmbed: vi.fn(() => ({
    typeformError: ref(embedState.typeformError),
    isValidTypeformId: ref(embedState.isValidTypeformId)
  }))
}))

describe('TypeformEmbed', () => {
  beforeEach(() => {
    embedState.typeformError = false
    embedState.isValidTypeformId = true
  })

  it('forwards hidden fields and leaves redirect target to Typeform by default', () => {
    render(TypeformEmbed, {
      props: { typeformId: 'abc123', hiddenFields: 'source=topbar' }
    })

    const embed = screen.getByTestId('typeform-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'abc123')
    expect(embed).toHaveAttribute('data-tf-hidden', 'source=topbar')
    expect(embed).not.toHaveAttribute('data-tf-redirect-target')
    expect(embed).not.toHaveAttribute('data-tf-auto-resize')
  })

  it('keeps redirect-on-completion inside the iframe when requested', () => {
    render(TypeformEmbed, {
      props: { typeformId: 'abc123', redirectTarget: '_self' }
    })

    expect(screen.getByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-redirect-target',
      '_self'
    )
  })

  it('enables auto-resize when requested', () => {
    render(TypeformEmbed, { props: { typeformId: 'abc123', autoResize: true } })

    expect(screen.getByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-auto-resize'
    )
  })

  it('shows the load-error message instead of the embed when the script fails', () => {
    embedState.typeformError = true
    render(TypeformEmbed, { props: { typeformId: 'abc123' } })

    expect(screen.getByText('typeform.loadError')).toBeInTheDocument()
    expect(screen.queryByTestId('typeform-embed')).toBeNull()
  })

  it('shows the load-error message instead of the embed for an invalid form id', () => {
    embedState.isValidTypeformId = false
    render(TypeformEmbed, { props: { typeformId: 'bad id!' } })

    expect(screen.getByText('typeform.loadError')).toBeInTheDocument()
    expect(screen.queryByTestId('typeform-embed')).toBeNull()
  })
})
