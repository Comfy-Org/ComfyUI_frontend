import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useAskAgentPort } from '@/platform/workflowErrors/askAgentPort'
import type { ComfyApp } from '@/scripts/app'

import App from './App.vue'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/assetLoadErrorReporting'))

vi.mock(import('@/scripts/app'), () => ({ app: {} as ComfyApp }))

vi.mock(import('@/composables/useAgentExtensionNotices'), () => ({
  useAgentExtensionNotices: vi.fn()
}))

vi.mock(
  import('@/platform/customNodes/manager/composables/useConflictDetection')
)

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/createAskAgentPort'),
  () => ({
    createAskAgentPort: () => ({
      canAskAgent: ref(true),
      askAgentAboutIssues: vi.fn(async () => {})
    })
  })
)

function probe(testId: string) {
  return defineComponent({
    setup() {
      return { reached: useAskAgentPort().canAskAgent }
    },
    template: `<div data-testid="${testId}">{{ reached ? 'reached' : 'fallback' }}</div>`
  })
}

vi.mock(import('@/components/dialog/GlobalDialog.vue'), () => ({
  default: probe('dialog-subtree')
}))

describe('Ask agent port reachability', () => {
  it('reaches a dialog descendant, which injects the fallback without a provider above router-view', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: probe('router-subtree') } }
    })

    expect(screen.getByTestId('dialog-subtree')).toHaveTextContent('reached')
    expect(screen.getByTestId('router-subtree')).toHaveTextContent('reached')

    unmount()
  })
})
