import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { ListReturn } from '@/lib/workshop/shelf-memory'
import { rememberList } from '@/lib/workshop/shelf-memory'
import DetailTrail from './DetailTrail.vue'

const PAGE = '/hub/models/demo/'

afterEach(() => {
  history.replaceState(null, '', '/')
  sessionStorage.clear()
})

function trail() {
  const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
  return {
    crumbs: within(crumbs)
      .getAllByRole('listitem')
      .map((item) => item.textContent.replace('›', '').trim()),
    links: within(crumbs)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
    phone: screen.getByTestId('detail-back')
  }
}

describe('DetailTrail', () => {
  it.for([
    { section: 'models', list: 'Models', href: '/hub/models/' },
    { section: 'workflows', list: 'Workflows', href: '/hub/workflows/' }
  ] as const)(
    'falls back to the $section section when no list was left behind',
    ({ section, list, href }) => {
      history.replaceState(null, '', PAGE)
      render(DetailTrail, { props: { section, name: 'Demo' } })

      const { crumbs, links, phone } = trail()
      expect(crumbs).toEqual(['Hub', list, 'Demo'])
      expect(links).toEqual(['/hub/', href])
      expect(phone.textContent.trim()).toBe(list)
      expect(phone).toHaveAttribute('href', href)
      expect(phone).toHaveAccessibleName(`Back to ${list}`)
    }
  )

  it.for<{ list: ListReturn; label: string }>([
    {
      list: {
        href: '/hub/models/?useCase=generate-videos',
        label: 'Generate videos'
      },
      label: 'Generate videos'
    },
    {
      list: { href: '/hub/models/?tab=video', label: 'Video models' },
      label: 'Video models'
    },
    { list: { href: '/hub/models/?q=flux' }, label: 'Models' }
  ])('names the list at $list.href "$label"', async ({ list, label }) => {
    history.replaceState(null, '', PAGE)
    rememberList(list, PAGE)
    render(DetailTrail, { props: { section: 'models', name: 'Demo' } })

    await waitFor(() => {
      const { crumbs, links, phone } = trail()
      expect(crumbs).toEqual(['Hub', label, 'Demo'])
      expect(links).toEqual(['/hub/', list.href])
      expect(phone.textContent.trim()).toBe(label)
      expect(phone).toHaveAttribute('href', list.href)
    })
  })

  it('does not name the Hub twice when the page was opened from it', async () => {
    history.replaceState(null, '', PAGE)
    rememberList({ href: '/hub/', label: 'Hub' }, PAGE)
    render(DetailTrail, { props: { section: 'models', name: 'Demo' } })

    await waitFor(() => {
      const { crumbs, links, phone } = trail()
      expect(crumbs).toEqual(['Hub', 'Models', 'Demo'])
      expect(links).toEqual(['/hub/', '/hub/models/'])
      expect(phone.textContent.trim()).toBe('Hub')
      expect(phone).toHaveAttribute('href', '/hub/')
    })
  })

  it('leaves a list remembered for another page alone', async () => {
    history.replaceState(null, '', PAGE)
    rememberList({ href: '/hub/models/?tab=video' }, '/hub/models/other/')
    render(DetailTrail, { props: { section: 'models', name: 'Demo' } })
    await nextTick()

    expect(trail().links).toEqual(['/hub/', '/hub/models/'])
  })

  it('shows the breadcrumb from tablet up and the single link on phones', () => {
    render(DetailTrail, { props: { section: 'models', name: 'Demo' } })

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveClass(
      'max-sm:hidden'
    )
    expect(screen.getByTestId('detail-back')).toHaveClass('sm:hidden')
    expect(screen.getByText('Demo')).toHaveAttribute('aria-current', 'page')
  })
})
