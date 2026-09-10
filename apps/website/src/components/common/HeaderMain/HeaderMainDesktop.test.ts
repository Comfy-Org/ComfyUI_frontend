// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

async function modelsLink(path: string) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop)
  await nextTick()
  return screen.getByRole('link', { name: /^Models\b/i })
}

describe('HeaderMainDesktop', () => {
  it('renders the Models leaf link with its NEW badge', async () => {
    const link = await modelsLink('/pricing')
    expect(link.getAttribute('href')).toBe('/models')
    expect(link.textContent).toMatch(/new/i)
    expect(link.getAttribute('data-active')).toBeNull()
  })

  it('marks the leaf link active on its own page', async () => {
    const link = await modelsLink('/models')
    expect(link.getAttribute('data-active')).not.toBeNull()
  })

  it('keeps Products inactive on the Models page it also links to', async () => {
    await modelsLink('/models')
    const products = screen.getByRole('button', { name: /products/i })
    expect(products.getAttribute('data-active')).toBeNull()
  })
})
