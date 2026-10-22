import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

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

afterEach(() => {
  remoteConfig.value = {}
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
      remoteConfig.value = { subscription_required: subscriptionRequired }

      render(ComfyRunButton)

      expect(await screen.findByRole('button', { name: label })).toBeVisible()
    }
  )

  it('switches to the subscription run button when remote config enables it after render', async () => {
    remoteConfig.value = { subscription_required: false }
    render(ComfyRunButton)
    expect(
      await screen.findByRole('button', { name: 'queue run' })
    ).toBeVisible()

    remoteConfig.value = { subscription_required: true }
    await nextTick()

    expect(
      await screen.findByRole('button', { name: 'cloud subscription run' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'queue run' })).toBeNull()
  })
})
