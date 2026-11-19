/**
 * The Ask-agent port has to be reachable from both of the subtrees that host an
 * error surface, and those subtrees are siblings: the Issues panel hangs under
 * `router-view`, while the execution-error dialog hangs under `GlobalDialog`.
 *
 * It was previously provided inside `router-view`'s subtree only, at
 * `TopMenuSection` and `PropertiesPanel`, so anything rendered from
 * `GlobalDialog` injected the no-op fallback and its CTA could never appear.
 * Component tests that provide the key themselves cannot catch that, which is
 * why this one renders the real `App` and probes the positions instead.
 */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useAskAgentPort } from '@/platform/workflowErrors/askAgentPort'

import App from './App.vue'

vi.mock(import('firebase/auth'))
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))
vi.mock(import('@/platform/telemetry/assetLoadErrorReporting'))
vi.mock<unknown>(import('@/composables/useAgentExtensionNotices'), () => ({
  useAgentExtensionNotices: vi.fn()
}))
vi.mock<unknown>(
  import('@/platform/customNodes/manager/composables/useConflictDetection'),
  () => ({
    useConflictDetection: () => ({ initializeConflictDetection: vi.fn() })
  })
)

/**
 * `canAskAgent` is `true` here and `false` in the port's own fallback, so a
 * probe reporting `true` proves it received what `App` provided rather than the
 * fallback it would inject with no provider above it.
 */
vi.mock<unknown>(
  import('@/workbench/extensions/agent/composables/agent/useAskAgentAboutIssues'),
  () => ({
    useAskAgentAboutIssues: () => ({
      canAskAgent: ref(true),
      askAgentAboutIssues: vi.fn()
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

/** Stands where the real `GlobalDialog` renders, a sibling of `router-view`. */
vi.mock<unknown>(import('@/components/dialog/GlobalDialog.vue'), () => ({
  default: probe('dialog-subtree')
}))

describe('Ask agent port reachability', () => {
  it('reaches the dialog subtree and the router subtree from one provider', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: probe('router-subtree') } }
    })

    expect(screen.getByTestId('dialog-subtree')).toHaveTextContent('reached')
    expect(screen.getByTestId('router-subtree')).toHaveTextContent('reached')

    unmount()
  })
})
