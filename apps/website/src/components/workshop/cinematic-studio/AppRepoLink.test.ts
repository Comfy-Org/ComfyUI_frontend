import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { captureWorkshopEvent } from '@/scripts/posthog'
import AppRepoLink from './AppRepoLink.vue'

vi.mock(import('@/scripts/posthog'))

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

  it('reports a click on the repository link with the app it belongs to', () => {
    render(AppRepoLink, {
      props: {
        repo: 'https://github.com/Comfy-Org/comfy-examples',
        appSlug: 'apps/cinematic-studio'
      }
    })

    const link = screen.getByRole('link', { name: 'View on GitHub' })
    link.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    link.click()

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'github_clicked',
      properties: { app_slug: 'apps/cinematic-studio', page_type: 'app' }
    })
  })
})
