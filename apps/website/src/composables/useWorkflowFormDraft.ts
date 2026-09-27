import { onMounted, onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import type { FieldSchema, FormValues } from '../config/workshop-playground'
import { onBeforeSignInLeave } from '../config/workshop-return'
import {
  transferWorkshopFormDraft,
  useWorkshopFormDraft
} from './useWorkshopFormDraft'

export function useWorkflowFormDraft(
  slug: string,
  scope: string,
  schema: Readonly<Ref<readonly FieldSchema[]>>,
  values: Ref<FormValues>,
  nativeJson: Ref<boolean>
) {
  const marker = `comfy-workflow-sign-in:${slug}`
  const draftSlug = `${slug}:${scope}`
  onMounted(() => {
    if (scope === 'anonymous') return
    try {
      const started = Number(sessionStorage.getItem(marker))
      sessionStorage.removeItem(marker)
      if (started > Date.now() - 3_600_000 && started <= Date.now())
        transferWorkshopFormDraft(`${slug}:anonymous`, draftSlug)
    } catch {
      draft.restoreFailed.value = true
    }
  })
  const draft = useWorkshopFormDraft(
    draftSlug,
    schema,
    values,
    nativeJson,
    false,
    { persistFiles: true }
  )
  const stop = onBeforeSignInLeave(async () => {
    if (scope !== 'anonymous') return
    await draft.stash()
    try {
      if (!draft.restoreFailed.value)
        sessionStorage.setItem(marker, String(Date.now()))
    } catch {
      draft.restoreFailed.value = true
    }
  })
  onScopeDispose(stop)
  return draft
}
