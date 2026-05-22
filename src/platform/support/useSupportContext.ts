import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  SupportForm,
  buildSupportUrl,
  normalizeOsName
} from '@/platform/support/config'
import type { SupportPrefill } from '@/platform/support/config'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

/**
 * Resolves Pylon prefill data from the current user session + system stats and
 * exposes a single `openSupport(form, extras?)` action that opens the best-fit
 * Pylon form in a new tab.
 *
 * Resolution is deferred until `openSupport`/`buildPrefill` is actually called
 * — call sites that never invoke them don't pay the cost of (or fail because
 * of) booting Firebase auth at component setup time.
 */
export function useSupportContext() {
  const buildPrefill = (extra?: Partial<SupportPrefill>): SupportPrefill => {
    const { userEmail, resolvedUserInfo } = useCurrentUser()
    const systemStatsStore = useSystemStatsStore()
    return {
      userEmail: userEmail.value ?? null,
      userId: resolvedUserInfo.value?.id ?? null,
      os: normalizeOsName(systemStatsStore.systemStats?.system?.os),
      version: __COMFYUI_FRONTEND_VERSION__,
      ...extra
    }
  }

  /**
   * Open a Pylon support form pre-filled with the user's context. Any field
   * we can't resolve is omitted from the URL — the form still opens.
   *
   * @param form - Which Pylon form best matches the entry-point. Defaults to
   *   the generic "Question" form.
   * @param extra - Per-callsite overrides (e.g. `productArea: 'Billing'`).
   */
  const openSupport = (
    form: SupportForm = SupportForm.Question,
    extra?: Partial<SupportPrefill>
  ): void => {
    const url = buildSupportUrl(form, buildPrefill(extra))
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    buildPrefill,
    openSupport
  }
}
