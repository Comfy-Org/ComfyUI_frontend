import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import AppRepoLink from './AppRepoLink.vue'

describe('AppRepoLink', () => {
  it('opens the app repository on GitHub in a new tab', () => {
    render(AppRepoLink, {
      props: { repo: 'https://github.com/Comfy-Org/comfy-examples' }
    })

    const link = screen.getByRole('link', { name: 'View on GitHub' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/Comfy-Org/comfy-examples'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders no link until the repository exists', () => {
    render(AppRepoLink)

    expect(screen.getByText(/GitHub/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
