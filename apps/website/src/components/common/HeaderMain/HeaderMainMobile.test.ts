import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HeaderMainMobile from './HeaderMainMobile.vue'

async function openMenu(workshopInBuild: boolean) {
  const user = userEvent.setup()
  render(HeaderMainMobile, { props: { workshopInBuild } })
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
}

describe('HeaderMainMobile', () => {
  it('omits Models when the workshop is not in the build', async () => {
    await openMenu(false)

    expect(screen.queryByRole('link', { name: /^Models\b/i })).toBeNull()
  })

  it('offers Models when the workshop is in the build', async () => {
    await openMenu(true)

    expect(screen.getByRole('link', { name: /^Models\b/i })).toBeTruthy()
  })

  it('renders top-level nav content with NEW badge sizing and external links', async () => {
    const user = userEvent.setup()
    render(HeaderMainMobile, { props: { workshopInBuild: false } })
    await user.click(screen.getByRole('button', { name: 'Toggle menu' }))

    const productsButton = screen.getByRole('button', {
      name: /^Products\s*NEW$/i
    })

    expect(productsButton).toHaveTextContent('Products')
    const productsBadge = within(productsButton).getByText('NEW')
    expect(productsBadge).toBeVisible()
    expect(productsBadge.closest('[data-slot="badge"]')).toHaveAttribute(
      'data-size',
      'xs'
    )

    await user.click(productsButton)

    const docsLink = screen.getByRole('link', { name: /Docs/i })
    expect(docsLink).toBeVisible()
    expect(docsLink).toHaveAttribute('target', '_blank')
  })

  it('labels a new top-level section with a NEW badge', async () => {
    await openMenu(false)

    expect(
      screen.getByRole('button', { name: /^Products\s*NEW$/i })
    ).toBeTruthy()
  })
})
