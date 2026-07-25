import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudTemplate from './CloudTemplate.vue'

const renderWithMeta = async (meta: Record<string, unknown>) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'test', component: CloudTemplate, meta }]
  })
  await router.push('/')
  await router.isReady()
  return render(CloudTemplate, {
    global: {
      plugins: [router],
      stubs: {
        CloudHeroCarousel: { template: '<div data-testid="hero" />' },
        CloudTemplateFooter: true
      }
    }
  })
}

describe('CloudTemplate', () => {
  it('shows the hero carousel when the route does not hide it', async () => {
    await renderWithMeta({})
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('hides the hero carousel when route.meta.hideHero is set', async () => {
    await renderWithMeta({ hideHero: true })
    expect(screen.queryByTestId('hero')).not.toBeInTheDocument()
  })
})
