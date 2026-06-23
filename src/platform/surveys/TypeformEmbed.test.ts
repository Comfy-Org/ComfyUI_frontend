import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import TypeformEmbed from './TypeformEmbed.vue'
import type * as SurveyIdentityModule from './surveyIdentity'

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

vi.mock('./surveyIdentity', async (importOriginal) => ({
  ...(await importOriginal<typeof SurveyIdentityModule>()),
  getSurveyIdentityTags: () => Promise.resolve({ anon_id: 'anon-1' })
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function renderEmbed(props: ComponentProps<typeof TypeformEmbed>) {
  return render(TypeformEmbed, { props, global: { plugins: [i18n] } })
}

describe('TypeformEmbed', () => {
  beforeEach(() => {
    embedState.typeformError = false
    embedState.isValidTypeformId = true
  })

  it('appends the survey identity to the caller hidden fields', async () => {
    renderEmbed({ typeformId: 'abc123', hiddenFields: 'source=topbar' })

    const embed = await screen.findByTestId('typeform-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'abc123')
    expect(embed).toHaveAttribute(
      'data-tf-hidden',
      'source=topbar,anon_id=anon-1'
    )
    expect(embed).not.toHaveAttribute('data-tf-redirect-target')
    expect(embed).not.toHaveAttribute('data-tf-auto-resize')
  })

  it('sends the survey identity even without caller hidden fields', async () => {
    renderEmbed({ typeformId: 'abc123' })

    expect(await screen.findByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-hidden',
      'anon_id=anon-1'
    )
  })

  it('keeps redirect-on-completion inside the iframe when requested', async () => {
    renderEmbed({ typeformId: 'abc123', redirectTarget: '_self' })

    expect(await screen.findByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-redirect-target',
      '_self'
    )
  })

  it('enables auto-resize when requested', async () => {
    renderEmbed({ typeformId: 'abc123', autoResize: true })

    expect(await screen.findByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-auto-resize'
    )
  })

  it('shows the load-error message instead of the embed when the script fails', () => {
    embedState.typeformError = true
    renderEmbed({ typeformId: 'abc123' })

    expect(screen.getByText('typeform.loadError')).toBeInTheDocument()
    expect(screen.queryByTestId('typeform-embed')).toBeNull()
  })

  it('shows the load-error message instead of the embed for an invalid form id', () => {
    embedState.isValidTypeformId = false
    renderEmbed({ typeformId: 'bad id!' })

    expect(screen.getByText('typeform.loadError')).toBeInTheDocument()
    expect(screen.queryByTestId('typeform-embed')).toBeNull()
  })
})
