import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { i18n } from '@/i18n'
import * as distribution from '@/platform/distribution/types'
import { coachmarkElements } from '@/platform/onboarding/coachmarkRegistry'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), { spy: true })

vi.mock(import('@/components/actionbar/ComfyRunButton'), async () => {
  const { defineComponent } = await import('vue')
  return {
    default: defineComponent({
      template: '<button type="button">Run</button><span />'
    })
  }
})

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
        StatusBadge: true,
        QueueInlineProgress: true
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
    vi.spyOn(distribution, 'isCloud', 'get').mockReturnValue(false)
  })

  it.for([
    { cloud: false, usedHeadlessly: false },
    { cloud: true, usedHeadlessly: true }
  ])(
    'hides the builder menu outside eligible local installs: %j',
    async ({ cloud, usedHeadlessly }) => {
      vi.spyOn(distribution, 'isCloud', 'get').mockReturnValue(cloud)
      Object.assign(useFeatureFlags().flags, { usedHeadlessly })
      const { dockedProgressContainer } = renderActionbar(false)

      try {
        await nextTick()
        expect(
          screen.queryByRole('button', {
            name: 'Runs on Local. Choose where it runs'
          })
        ).not.toBeInTheDocument()
      } finally {
        dockedProgressContainer.remove()
      }
    }
  )

  it('opens the builder from the eligible local Run bar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    Object.assign(useFeatureFlags().flags, { usedHeadlessly: true })
    vi.spyOn(window, 'open').mockReturnValue(null)
    const { dockedProgressContainer } = renderActionbar(false)

    try {
      await user.click(
        screen.getByRole('button', {
          name: 'Runs on Local. Choose where it runs'
        })
      )
      await user.click(
        screen.getByRole('menuitem', { name: 'Deploy to Cloud…' })
      )

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('/profile/builds/new?step=import'),
        '_blank',
        'noopener'
      )
    } finally {
      dockedProgressContainer.remove()
    }
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
