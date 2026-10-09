import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu() {
  const user = userEvent.setup()
  render(HeaderMainMobile, {
    props: { hubSections: { workflows: true, apps: true } }
  })
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
  return user
}

describe('HeaderMainMobile', () => {
  it('offers Hub, Products and Enterprise at the top level', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: /^Hub\b/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Products\b/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Enterprise\b/i })).toBeTruthy()
  })

  it('drills into the described Hub columns, each ending with its All link', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Hub\b/i }))

    expect(
      [
        'Models',
        'Run the latest AI models',
        'Workflows',
        'Ready-made recipes for a task',
        'Apps',
        'Full tools built on Comfy'
      ].filter((text) => !screen.queryByText(text, { exact: true }))
    ).toEqual([])
    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('/hub/'))
    ).toEqual([
      '/hub/models/seedream-5-0-pro-text-to-image/',
      '/hub/models/seedance-2-5-reference-to-video/',
      '/hub/models/nano-banana-2-image-edit/',
      '/hub/models/gpt-image-2-text-to-image/',
      '/hub/models/',
      '/hub/workflows/image-to-video/',
      '/hub/workflows/video-from-references/',
      '/hub/workflows/motion-transfer/',
      '/hub/workflows/edit-selected-region/',
      '/hub/workflows/',
      '/hub/apps/cinematic-studio/',
      '/hub/apps/reshoot/',
      '/hub/apps/'
    ])
    expect(screen.getByRole('link', { name: 'Re-shoot' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.getByRole('link', { name: 'All apps' })).not.toHaveAttribute(
      'target'
    )
  })

  it('leaves the models catalogue out of Products', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Products\b/i }))

    expect(screen.getByRole('link', { name: 'Comfy Cloud' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Browse Models\b/i })).toBeNull()
  })

  it('names each icon-only social link under Company', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Company\b/i }))

    const socialLinks = ['Discord', 'GitHub', 'YouTube', 'Reddit'].map(
      (label) => `${label} (opens in new tab)`
    )
    expect(
      socialLinks.map((name) =>
        screen.getByRole('link', { name }).textContent.trim()
      )
    ).toEqual(socialLinks)
  })

  it('shows no NEW badge on the top-level sections', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: /^Products$/i })).toBeTruthy()
    expect(screen.queryByText('NEW', { exact: true })).toBeNull()
  })

  it('shows the Enterprise links in one section', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: /^Enterprise\b/i }))

    const enterpriseLinks = [
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ]
    expect(
      enterpriseLinks.map(
        (label) => screen.getByRole('link', { name: label }).textContent
      )
    ).toEqual(enterpriseLinks)
  })
})
