import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { onScopeDispose, watch } from 'vue'

import {
  sameDraftFields,
  useSkillDraftStore
} from '@/platform/skills/stores/skillDraftStore'
import type {
  SkillDraftFields,
  SkillDraftTarget
} from '@/platform/skills/stores/skillDraftStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

const SAVE_DELAY_MS = 300

export function useSkillDraft(options: {
  pack: SkillPack | undefined
  form: SkillDraftFields
}) {
  const { pack, form } = options
  const drafts = useSkillDraftStore()
  const scope = useSkillPacksStore().scope
  const target: SkillDraftTarget = pack
    ? { kind: 'edit', name: pack.name }
    : { kind: 'new' }
  const saved: SkillDraftFields = {
    name: pack?.name ?? '',
    description: pack?.description ?? '',
    body: pack?.body ?? ''
  }
  let settled = false

  const restored = pack ? drafts.editDraftFor(pack.name) : drafts.newSkillDraft
  if (restored) Object.assign(form, restored)

  function persist(): void {
    if (settled) return
    const changed = !sameDraftFields(form, saved)
    drafts.setDraft(scope, target, changed ? { ...form } : null)
  }

  const { start: persistSoon } = useTimeoutFn(persist, SAVE_DELAY_MS, {
    immediate: false
  })
  watch(
    () => ({ ...form }),
    () => persistSoon()
  )
  useEventListener(window, 'pagehide', persist)
  onScopeDispose(persist)

  function settle(submitted: SkillDraftFields): void {
    settled = true
    drafts.clearDraftIfUnchanged(scope, target, submitted)
  }

  return { flush: persist, settle }
}
