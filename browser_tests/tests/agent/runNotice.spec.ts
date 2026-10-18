import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// `agentComposerPerformanceTest` is reused here for one property: it restores a
// stored thread whose data factory leaves `workflow_id` empty, which is the only
// way the panel reaches the targetless state this notice depends on. If that
// conversation is ever bound to a workflow, this spec fails for a reason that has
// nothing to do with its title.
import { agentComposerPerformanceTest as test } from '@e2e/fixtures/agentPanelFixture'

test.describe(
  'PM-1236 targetless run-permissions notice',
  {
    tag: ['@cloud', '@agent'],
    annotation: {
      type: 'source',
      description:
        'https://linear.app/comfyorg/issue/PM-1236/clarify-and-defer-the-run-permissions-notice'
    }
  },
  () => {
    test('appears only after the user focuses the composer', async ({
      agentComposerPanel
    }, testInfo) => {
      const notice = agentComposerPanel.root
        .getByRole('note')
        .filter({ hasText: enMessages.agent.runNotice })

      // The panel is already targetless here (the restored thread's factory
      // leaves `workflow_id` empty), so this first check only rules out a
      // synchronous notice.
      await expect(notice).toHaveCount(0)

      // On its own that is vacuous for this spec's actual claim. The check
      // above resolves in ~20ms, well inside the deferral deadline, so a
      // regression that revealed the notice on a timer rather than on focus
      // left the spec green -- verified by injecting exactly that regression.
      // Idling past the deadline with the composer never touched is what
      // proves focus, not elapsed time, is the trigger. This is a real wait by
      // necessity: the assertion is that nothing happens for a period, which
      // has no condition to poll for. `page.clock` cannot stand in -- it can
      // only be installed after the panel has already mounted, so it does not
      // advance a timer a regression started at mount, and the spec goes green
      // again. The unit suite owns the exact 499/500 boundary; this owns the
      // user-visible claim.
      await new Promise((resolve) => setTimeout(resolve, 1_500))
      await expect(notice).toHaveCount(0)

      await testInfo.attach('before-composer-focus', {
        body: await agentComposerPanel.root.screenshot(),
        contentType: 'image/png'
      })

      await agentComposerPanel.composer.focus()
      await expect(notice).toBeVisible()
      await expect(notice).toHaveText(enMessages.agent.runNotice)
      // Same framing as the before shot so the two can be compared directly.
      await testInfo.attach('after-composer-focus', {
        body: await agentComposerPanel.root.screenshot(),
        contentType: 'image/png'
      })
    })
  }
)
