import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import HeaderMainDesktop from './HeaderMainDesktop.vue'

async function modelsLink(path: string) {
  history.replaceState(null, '', path)
  render(HeaderMainDesktop, { props: { workshopInBuild: true } })
  await nextTick()
  return screen.getByRole('link', { name: /^Hub\b/i })
}

describe('HeaderMainDesktop', () => {
  it('does not add Hub navigation without a build opt-in', () => {
    render(HeaderMainDesktop)
    expect(screen.queryByRole('link', { name: /^Hub\b/i })).toBeNull()
  })
  it('renders the Hub leaf link with its NEW badge', async () => {
    const link = await modelsLink('/pricing')
    expect(link.getAttribute('href')).toBe('/hub/models/')
    expect(link.textContent).toMatch(/new/i)
    expect(link.getAttribute('data-active')).toBeNull()
  })

  it.for(['/hub/models/', '/hub/workflows/', '/hub/apps/'])(
    'marks the leaf link active on %s',
    async (path) => {
      const link = await modelsLink(path)
      expect(link.getAttribute('data-active')).not.toBeNull()
    }
  )

  it.for(['/hub/models/', '/hub/workflows/', '/hub/apps/'])(
    'keeps Products inactive on %s',
    async (path) => {
      await modelsLink(path)
      const products = screen.getByRole('button', { name: /products/i })
      expect(products.getAttribute('data-active')).toBeNull()
    }
  )
})
