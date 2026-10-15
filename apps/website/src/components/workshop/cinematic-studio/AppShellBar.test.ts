import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import AppShellBar from './AppShellBar.vue'

describe('AppShellBar', () => {
  it('names the app beside the logo and the way back to the apps', () => {
    render(AppShellBar, { props: { name: 'Re-shoot a video' } })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Re-shoot a video' })
    ).toBeVisible()
    expect(screen.getByText('Beta')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Comfy home' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveAttribute(
      'href',
      '/hub/apps/'
    )
  })

  it.for([
    { repo: 'https://github.com/Comfy-Org/comfy-reshoot', links: 3 },
    { repo: undefined, links: 2 }
  ])('offers GitHub only when the app has a repository', ({ repo, links }) => {
    render(AppShellBar, { props: { name: 'Re-shoot a video', repo } })

    expect(screen.getAllByRole('link')).toHaveLength(links)
    expect(screen.queryByText('GitHub · Coming soon')).toBeNull()
  })
})
