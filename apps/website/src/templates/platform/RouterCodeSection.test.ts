import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterCodeSection from './RouterCodeSection.vue'

describe('RouterCodeSection', () => {
  it('swaps the provider in the sample when a provider logo is chosen', async () => {
    render(RouterCodeSection, { props: { locale: 'en' } })
    const providers = screen.getByRole('radiogroup', { name: 'Provider' })

    expect(providers).toBeTruthy()
    expect(screen.getByText('fal')).toBeTruthy()

    await userEvent.click(screen.getByRole('radio', { name: 'WaveSpeed' }))

    expect(screen.getByText('wavespeed')).toBeTruthy()
    expect(screen.queryByText('fal')).toBeNull()
  })
})
