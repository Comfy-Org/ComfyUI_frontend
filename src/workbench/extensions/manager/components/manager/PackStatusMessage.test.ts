import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'

import PackStatusMessage from './PackStatusMessage.vue'

function renderStatus(
  statusType: PackStatusType,
  opts: { hasCompatibilityIssues?: boolean; importFailed?: boolean } = {}
) {
  return render(PackStatusMessage, {
    props: {
      statusType,
      hasCompatibilityIssues: opts.hasCompatibilityIssues,
      hasImportFailed: opts.importFailed
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('PackStatusMessage', () => {
  it('renders flagged and banned differently', async () => {
    const { rerender } = renderStatus('NodeVersionStatusFlagged')

    // The regression this component was written for. Asserted directly rather
    // than left to a reader diffing two snapshots, because "these two files
    // happen to differ" is not the same claim as "these two states are
    // distinguishable to a user".
    expect(screen.getByRole('alert')).toHaveTextContent('Flagged')
    expect(screen.getByRole('alert')).toHaveClass('bg-warning-background/15')

    await rerender({ statusType: 'NodeVersionStatusBanned' })

    expect(screen.getByRole('alert')).toHaveTextContent('Banned')
    expect(screen.getByRole('alert')).toHaveClass(
      'bg-destructive-background/10'
    )
  })

  it('shows the security status rather than "conflicting" when both apply', () => {
    // A flagged pack usually ALSO trips compatibility detection, and the old
    // code let 'conflicting' win -- which is why flagged packs read as a
    // generic conflict and users had no way to learn a scan had found
    // something. The security status is the reason for the conflict, so it
    // outranks it.
    renderStatus('NodeVersionStatusFlagged', {
      hasCompatibilityIssues: true
    })
    const alert = screen.getByRole('alert')

    expect(alert).toHaveTextContent('Flagged')
    expect(alert).not.toHaveTextContent('Conflicting')
    expect(alert).toHaveClass('bg-warning-background/15')
  })

  it('still shows "conflicting" for a non-security status with issues', () => {
    renderStatus('NodeVersionStatusActive', {
      hasCompatibilityIssues: true
    })
    const alert = screen.getByRole('alert')

    expect(alert).toHaveTextContent('Conflicting')
    expect(alert).toHaveClass('bg-destructive-background/10')
  })

  it('lets an import failure outrank every status', () => {
    // Import failure is observed locally and is the only one of these the user
    // can act on immediately, so it wins even over banned.
    renderStatus('NodeVersionStatusBanned', {
      importFailed: true
    })
    const alert = screen.getByRole('alert')

    expect(alert).toHaveClass('bg-destructive-background/10')
    expect(alert).not.toHaveTextContent('Banned')
  })
})
