import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'
import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'

import PackStatusMessage from './PackStatusMessage.vue'

/**
 * Snapshots of the rendered badge, not of the presentation function.
 *
 * `packStatusPresentation.test.ts` already pins the label/severity pairs as
 * data. What that cannot catch is the badge losing the severity on the way to
 * the DOM: PrimeVue turns `severity` into a class, and a wrong class is the
 * whole bug this component exists to fix. Flagged and banned previously
 * rendered identically -- both red, both labelled "Conflicting" -- and a unit
 * test on the resolver would have passed throughout.
 *
 * So these assert on markup, and the meaningful diff in any snapshot churn is
 * the `p-message-{warn,error,success}` class and the label text.
 */
function renderStatus(
  statusType: PackStatusType,
  opts: { hasCompatibilityIssues?: boolean; importFailed?: boolean } = {}
) {
  return render(PackStatusMessage, {
    props: {
      statusType,
      hasCompatibilityIssues: opts.hasCompatibilityIssues
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      provide: {
        // The component injects this rather than taking a prop, so an absent
        // provider is the normal case and must not throw.
        ...(opts.importFailed === undefined
          ? {}
          : {
              [ImportFailedKey as symbol]: {
                importFailed: { value: opts.importFailed }
              }
            })
      }
    }
  })
}

/**
 * PrimeVue stamps a per-mount instance counter (`pc1=""`, `pc2=""`, ...) onto
 * the root element. It is global to the run, so adding a test above these --
 * or reordering them -- renumbers every snapshot and produces a diff that
 * looks like a rendering change and is not one. Strip it so the snapshots
 * record only what the user sees.
 */
function stableHtml(html: string): string {
  return html.replace(/ pc\d+=""/g, '')
}

describe('PackStatusMessage', () => {
  it.for([
    'NodeVersionStatusActive',
    'NodeVersionStatusPending',
    'NodeVersionStatusFlagged',
    'NodeVersionStatusBanned',
    'NodeVersionStatusDeleted',
    'NodeStatusActive',
    'NodeStatusBanned',
    'NodeStatusDeleted'
  ] as const)('renders %s', (statusType) => {
    const { container } = renderStatus(statusType)
    expect(stableHtml(container.innerHTML)).toMatchSnapshot()
  })

  it('renders flagged and banned differently', () => {
    const flagged = stableHtml(
      renderStatus('NodeVersionStatusFlagged').container.innerHTML
    )
    const banned = stableHtml(
      renderStatus('NodeVersionStatusBanned').container.innerHTML
    )

    // The regression this component was written for. Asserted directly rather
    // than left to a reader diffing two snapshots, because "these two files
    // happen to differ" is not the same claim as "these two states are
    // distinguishable to a user".
    expect(flagged).not.toEqual(banned)
    expect(flagged).toContain('p-message-warn')
    expect(banned).toContain('p-message-error')
    expect(flagged).toContain('Flagged')
    expect(banned).toContain('Banned')
  })

  it('shows the security status rather than "conflicting" when both apply', () => {
    // A flagged pack usually ALSO trips compatibility detection, and the old
    // code let 'conflicting' win -- which is why flagged packs read as a
    // generic conflict and users had no way to learn a scan had found
    // something. The security status is the reason for the conflict, so it
    // outranks it.
    const { container } = renderStatus('NodeVersionStatusFlagged', {
      hasCompatibilityIssues: true
    })

    expect(container.innerHTML).toContain('Flagged')
    expect(container.innerHTML).not.toContain('Conflicting')
    expect(container.innerHTML).toContain('p-message-warn')
  })

  it('still shows "conflicting" for a non-security status with issues', () => {
    const { container } = renderStatus('NodeVersionStatusActive', {
      hasCompatibilityIssues: true
    })

    expect(container.innerHTML).toContain('Conflicting')
    expect(container.innerHTML).toContain('p-message-error')
  })

  it('lets an import failure outrank every status', () => {
    // Import failure is observed locally and is the only one of these the user
    // can act on immediately, so it wins even over banned.
    const { container } = renderStatus('NodeVersionStatusBanned', {
      importFailed: true
    })

    expect(container.innerHTML).toContain('p-message-error')
    expect(container.innerHTML).not.toContain('Banned')
  })
})
