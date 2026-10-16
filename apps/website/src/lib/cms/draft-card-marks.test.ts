import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/vue'
import { markDraftCards } from './draft-card-marks'
import type { CatalogPreviewChange } from './preview-display'

const fixture: CatalogPreviewChange = {
  uid: 'workflow',
  title: 'Example',
  summary: 'A change',
  kind: 'modified',
  pagePath: '/hub/workflows/example/'
}
const root = document.createElement('div')
afterEach(() => root.replaceChildren())
function card(href: string) {
  const element = document.createElement('a')
  element.href = href
  element.dataset.testid = 'workshop-model-card'
  element.textContent = 'Example'
  root.append(element)
  return element
}

describe('Draft card annotations', () => {
  it.for([
    { name: 'new', change: { kind: 'added' as const }, expected: 'new' },
    { name: 'changed', change: {}, expected: 'updated' },
    {
      name: 'future schedule',
      change: { visibleFrom: '2026-12-01T00:00:00Z' },
      expected: 'scheduled'
    },
    {
      name: 'past schedule',
      change: { visibleFrom: '2026-01-01T00:00:00Z' },
      expected: 'updated'
    }
  ])(
    'labels a $name card, preserving its URL and existing classes',
    ({ change, expected }) => {
      const element = card('/zh-CN/hub/workflows/example/?source=hub')
      element.className = 'existing ring-2'
      const clean = markDraftCards(
        root,
        [{ ...fixture, ...change }],
        (state) => state,
        Date.parse('2026-10-15T00:00:00Z')
      )
      expect(element).toHaveAttribute('data-draft-mark', expected)
      expect(element).toHaveTextContent(`Example${expected}`)
      expect(element.getAttribute('href')).toBe(
        '/zh-CN/hub/workflows/example/?source=hub'
      )
      clean()
      expect(element.textContent).toBe('Example')
      expect(element.className).toBe('existing ring-2')
      expect(element).not.toHaveAttribute('data-draft-mark')
    }
  )

  it.for([
    { name: 'unrelated card', href: '/hub/workflows/other/', change: fixture },
    {
      name: 'external card',
      href: 'https://external.example/hub/workflows/example/',
      change: fixture
    },
    {
      name: 'deleted content',
      href: fixture.pagePath ?? '',
      change: { ...fixture, kind: 'deleted' as const }
    },
    {
      name: 'invalid route',
      href: '/admin/catalog',
      change: { ...fixture, pagePath: '/admin/catalog' }
    }
  ])('never annotates $name', ({ href, change }) => {
    const element = card(href)
    const clean = markDraftCards(root, [change], (state) => state)
    expect(element.textContent).toBe('Example')
    expect(element).not.toHaveAttribute('data-draft-mark')
    clean()
  })

  it('annotates island-loaded cards once and stops after cleanup', async () => {
    const clean = markDraftCards(root, [fixture], (state) => state)
    const element = card('/hub/workflows/example/')
    await waitFor(() => expect(element).toHaveTextContent('Exampleupdated'))
    element.append(document.createTextNode(' refreshed'))
    await waitFor(() =>
      expect(element.textContent).toBe('Exampleupdated refreshed')
    )
    clean()
    const second = card('/hub/workflows/example/')
    await Promise.resolve()
    expect(second.textContent).toBe('Example')
    expect(element.textContent).toBe('Example refreshed')
  })
})
