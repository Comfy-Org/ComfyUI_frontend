import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterCodeSection from './RouterCodeSection.vue'

describe('RouterCodeSection', () => {
  it('swaps the provider in the sample when a provider logo is chosen', async () => {
    render(RouterCodeSection, { props: { locale: 'en' } })
    const providers = screen.getByRole('radiogroup', { name: 'Provider' })

    expect(providers).toBeTruthy()
    const code = () =>
      screen.getByText((_, element) => element?.tagName === 'CODE').textContent

    expect(code()).not.toContain('model_provider')

    await userEvent.click(screen.getByRole('radio', { name: 'fal' }))

    expect(code()).toContain('model_provider="fal"')

    await userEvent.click(screen.getByRole('radio', { name: 'Runware' }))

    expect(code()).toContain('model_provider="runware"')
    expect(code()).not.toContain('"fal"')
  })
})
