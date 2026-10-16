import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CatalogPagination from './CatalogPagination.vue'

describe('bounded catalogue pagination', () => {
  it('updates results in place for ordinary clicks but retains modified-click links', () => {
    const { emitted } = render(CatalogPagination, {
      props: {
        section: 'workflows',
        page: {
          mode: 'cursor',
          page: 2,
          pageSize: 24,
          count: 24,
          hasNext: true,
          hasPrevious: false,
          nextCursor: 'next'
        }
      }
    })
    const link = screen.getByTestId('catalog-next')
    const modified = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true
    })
    link.dispatchEvent(modified)
    expect(modified.defaultPrevented).toBe(false)
    expect(emitted('navigate')).toBeUndefined()
    const ordinary = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    link.dispatchEvent(ordinary)
    expect(ordinary.defaultPrevented).toBe(true)
    expect(emitted('navigate')).toEqual([['p=3&cursor=next']])
  })

  it('uses signed page cursors while preserving repeated filters and omitting unknown totals', () => {
    render(CatalogPagination, {
      props: {
        section: 'workflows',
        initialSearch: '?p=3&cursor=old&category=video&category=audio',
        page: {
          mode: 'cursor',
          page: 3,
          pageSize: 24,
          count: 7,
          hasPrevious: true,
          hasNext: true,
          nextCursor: 'next+/=',
          previousCursor: 'previous',
          reset: true
        }
      }
    })
    const next = new URL(
      screen.getByTestId('catalog-next').getAttribute('href') ?? '',
      'https://example.test'
    )
    const previous = new URL(
      screen.getByTestId('catalog-previous').getAttribute('href') ?? '',
      'https://example.test'
    )
    expect(next.searchParams.get('cursor')).toBe('next+/=')
    expect(next.searchParams.getAll('category')).toEqual(['video', 'audio'])
    expect(previous.searchParams.get('cursor')).toBe('previous')
    expect(previous.searchParams.get('p')).toBe('2')
    expect(screen.getByTestId('catalog-pagination')).not.toHaveTextContent(
      ' of '
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing the first page'
    )
  })

  it('removes the old cursor when returning to the first page', () => {
    render(CatalogPagination, {
      props: {
        section: 'models',
        initialSearch: '?p=2&cursor=old',
        page: {
          mode: 'cursor',
          page: 2,
          pageSize: 24,
          count: 1,
          hasPrevious: true,
          hasNext: false
        }
      }
    })
    const url = new URL(
      screen.getByTestId('catalog-previous').getAttribute('href') ?? '',
      'https://example.test'
    )
    expect(url.searchParams.has('cursor')).toBe(false)
    expect(url.searchParams.get('p')).toBe('1')
    expect(screen.queryByTestId('catalog-next')).toBeNull()
  })

  it.for(['catalog-previous', 'catalog-next'])(
    'does not speculatively request %s before navigation',
    (testId) => {
      render(CatalogPagination, {
        props: {
          section: 'workflows',
          page: {
            page: 2,
            pageSize: 24,
            total: 72,
            totalPages: 3,
            hasPrevious: true,
            hasNext: true
          }
        }
      })
      expect(screen.getByTestId(testId)).toHaveAttribute(
        'data-astro-prefetch',
        'false'
      )
    }
  )

  it('shows the selected range and preserves repeated filters in localized links', () => {
    render(CatalogPagination, {
      props: {
        locale: 'zh-CN',
        section: 'workflows',
        initialSearch:
          '?category=video&category=audio&q=portrait&sort=name&p=2',
        page: {
          page: 2,
          pageSize: 24,
          total: 60,
          totalPages: 3,
          hasPrevious: true,
          hasNext: true
        }
      }
    })
    for (const [testId, page] of [
      ['catalog-previous', '1'],
      ['catalog-next', '3']
    ]) {
      const url = new URL(
        screen.getByTestId(testId).getAttribute('href') ?? '',
        'https://example.test'
      )
      expect(url.pathname).toBe('/zh-CN/hub/workflows/')
      expect(url.searchParams.getAll('category')).toEqual(['video', 'audio'])
      expect(url.searchParams.get('q')).toBe('portrait')
      expect(url.searchParams.get('sort')).toBe('name')
      expect(url.searchParams.get('p')).toBe(page)
    }
    expect(screen.getByTestId('catalog-pagination').textContent).toContain('25')
    expect(screen.getByTestId('catalog-pagination').textContent).toContain('48')
    expect(screen.getByTestId('catalog-pagination').textContent).toContain('60')
  })

  it('offers no navigation for an empty result', () => {
    render(CatalogPagination, {
      props: {
        section: 'models',
        page: {
          page: 1,
          pageSize: 24,
          total: 0,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false
        }
      }
    })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('catalog-pagination').textContent).toContain('0')
  })
})
