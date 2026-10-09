import { omitBy } from 'es-toolkit'

import {
  isSsoRequiredRefusal,
  ssoRequiredOrganizationId
} from '@comfyorg/account-core/sso'

import { SELF_STYLED_PANEL_CONTENT_CLASS } from '@/components/ui/dialog/dialog.variants'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { reportError } from '@/platform/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

export interface SsoRequiredContext {
  readonly email?: string
  /** Where SSO sends the person back; the current page when absent. */
  readonly returnTo?: string
  /** The organization the refusal names; its SSO, not the email's. */
  readonly organizationId?: string
}

/**
 * Shows the one SSO-required screen. False while `sso_enabled` is off, so the
 * caller keeps the handling it has today. Several refusals can land at once;
 * a later caller only adds what it knows, so a request seam without context
 * never erases the email the sign-in page passed. A refusal always answers the
 * organization, so one that names none clears an earlier one.
 */
export function presentSsoRequired(context: SsoRequiredContext = {}): boolean {
  if (!useFeatureFlags().flags.ssoEnabled) return false
  const dialogStore = useDialogStore()
  const known = {
    ...omitBy(context, (value) => value === undefined),
    ...('organizationId' in context && {
      organizationId: context.organizationId
    })
  }
  void import('@/platform/auth/sso/SsoRequiredDialogContent.vue')
    .then(({ default: component }) => {
      if (dialogStore.isDialogOpen(SSO_REQUIRED_DIALOG_KEY)) {
        dialogStore.updateDialog({
          key: SSO_REQUIRED_DIALOG_KEY,
          contentProps: known
        })
        return
      }
      dialogStore.showDialog({
        key: SSO_REQUIRED_DIALOG_KEY,
        component,
        props: known,
        dialogComponentProps: {
          renderer: 'reka',
          headless: true,
          contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
        }
      })
    })
    .catch((error: unknown) => {
      reportError(error, {
        surface: 'auth',
        errorType: 'failure_loading_sso_required_dialog'
      })
      useToast().error(t('auth.sso.required.title'), {
        description: t('auth.sso.required.body')
      })
    })
  return true
}

export function presentForRefusal(status: number, body: unknown): boolean {
  return (
    isSsoRequiredRefusal(status, body) &&
    presentSsoRequired({ organizationId: ssoRequiredOrganizationId(body) })
  )
}

/** Reads a clone, and only of a 403 while `sso_enabled` is on. */
export async function presentForResponse(response: Response): Promise<boolean> {
  if (response.status !== 403 || !useFeatureFlags().flags.ssoEnabled) {
    return false
  }
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined)
  return presentForRefusal(response.status, body)
}
