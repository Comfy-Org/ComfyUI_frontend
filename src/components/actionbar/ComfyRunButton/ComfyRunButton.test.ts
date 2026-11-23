import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ComfyRunButton from './ComfyRunButton.vue'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock<unknown>(import('./CloudRunButtonWrapper.vue'), () => ({
  __esModule: true,
  default: { template: '<button>cloud subscription run</button>' }
}))
vi.mock<unknown>(import('./ComfyQueueButton.vue'), () => ({
  __esModule: true,
  default: { template: '<button>queue run</button>' }
}))
vi.mock<unknown>(import('./LocalRunButtonWrapper.vue'), () => ({
  __esModule: true,
  default: { template: '<button>local run</button>' }
}))

const originalConfig = window.__CONFIG__

afterEach(() => {
  window.__CONFIG__ = originalConfig
  distribution.isCloud = true
})

describe('ComfyRunButton', () => {
  it.for([
    {
      isCloud: true,
      subscriptionRequired: true,
      label: 'cloud subscription run'
    },
    { isCloud: true, subscriptionRequired: false, label: 'queue run' },
    { isCloud: false, subscriptionRequired: true, label: 'local run' }
  ])(
    'renders the $label button when isCloud=$isCloud and subscription_required=$subscriptionRequired is set after import',
    async ({ isCloud, subscriptionRequired, label }) => {
      distribution.isCloud = isCloud
      window.__CONFIG__ = { subscription_required: subscriptionRequired }

      render(ComfyRunButton)

      expect(await screen.findByRole('button', { name: label })).toBeVisible()
    }
  )
})
