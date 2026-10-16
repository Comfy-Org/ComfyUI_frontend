import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CatalogPagination from './CatalogPagination.vue'

describe('bounded catalogue pagination', () => {
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
