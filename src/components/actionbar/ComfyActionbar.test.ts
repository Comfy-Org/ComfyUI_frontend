import { render } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import { i18n } from '@/i18n'
import { coachmarkElements } from '@/platform/onboarding/coachmarkRegistry'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'

vi.mock(
  import('@/components/actionbar/ComfyRunButton/ComfyRunButton.vue'),
  async () => {
    const { defineComponent } = await import('vue')
    return {
      default: defineComponent({
        template: '<button type="button">Run</button><span />'
      })
    }
  }
)

const renderActionbar = (showRunProgressBar: boolean) => {
  const dockedProgressContainer = document.createElement('div')
  document.body.appendChild(dockedProgressContainer)

  const pinia = getActivePinia()!
  useSettingStore().settingValues = {
    'Comfy.UseNewMenu': 'Top',
    'Comfy.Queue.QPOV2': true,
    'Comfy.Queue.ShowRunProgressBar': showRunProgressBar
  }

  const rendered = render(ComfyActionbar, {
    container: document.body.appendChild(document.createElement('div')),
    props: {
      dockedProgressContainer,
      queueOverlayExpanded: false
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        Badge: true,
        QueueInlineProgress: true,
        FreeTierQuota: true,
        PartnerNodesRunCaption: true,
        DeploymentSwitcher: {
          template: '<div data-testid="deployment-switcher" />'
        }
      },
      directives: {
        coachmark: vCoachmark
      }
    }
  })

  return { dockedProgressContainer, rendered }
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('registers the resolved run button as a coachmark target', async () => {
    const { dockedProgressContainer, rendered } = renderActionbar(false)

    try {
      await rendered.findByText('Run')
      await nextTick()

      expect(coachmarkElements('first-run-run-button')).toHaveLength(1)
    } finally {
      dockedProgressContainer.remove()
    }
  })

  it('teleports inline progress when run progress bar is enabled', async () => {
    const { dockedProgressContainer } = renderActionbar(true)

    try {
      await nextTick()

      /* oxlint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        dockedProgressContainer.querySelector(
          '[data-testid="queue-inline-progress"]'
        )
      ).not.toBeNull()
      /* oxlint-enable testing-library/no-node-access */
    } finally {
      dockedProgressContainer.remove()
    }
  })

  it('does not teleport inline progress when run progress bar is disabled', async () => {
    const { dockedProgressContainer } = renderActionbar(false)

    try {
      await nextTick()

      /* oxlint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        dockedProgressContainer.querySelector(
          '[data-testid="queue-inline-progress"]'
        )
      ).toBeNull()
      /* oxlint-enable testing-library/no-node-access */
    } finally {
      dockedProgressContainer.remove()
    }
  })
})

describe('ComfyActionbar deployment switcher', () => {
  it('puts the engine button before the Run button', async () => {
    const { dockedProgressContainer, rendered } = renderActionbar(false)
    onTestFinished(() => dockedProgressContainer.remove())

    const run = await rendered.findByText('Run')
    expect(
      rendered.getByTestId('deployment-switcher').compareDocumentPosition(run) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('ComfyActionbar floating position', () => {
  it('pulls a bar parked at the right edge back on screen when it grows', async () => {
    const observedCallbacks = new Map<Element, ResizeObserverCallback>()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly callback: ResizeObserverCallback
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback
        }
        observe(target: Element) {
          observedCallbacks.set(target, this.callback)
        }
        unobserve() {}
        disconnect() {}
      }
    )
    let panelWidth = 200
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
      () => panelWidth
    )
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40)
    localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
    localStorage.setItem(
      'Comfy.MenuPosition.Floating',
      JSON.stringify({ x: window.innerWidth - panelWidth, y: 100 })
    )
    onTestFinished(() => {
      localStorage.clear()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })
    const { dockedProgressContainer, rendered } = renderActionbar(false)
    onTestFinished(() => dockedProgressContainer.remove())
    await rendered.findByText('Run')
    await nextTick()

    const panel = rendered.getByTestId('actionbar-panel')
    expect(observedCallbacks.has(panel)).toBe(true)
    panelWidth = 400
    observedCallbacks.get(panel)?.([], new ResizeObserver(() => {}))
    await nextTick()

    expect(panel.style.left).toBe(`${window.innerWidth - 400}px`)
  })
})
