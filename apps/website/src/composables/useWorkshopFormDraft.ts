import { useEventListener } from '@vueuse/core'
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  clearWorkshopFiles,
  packWorkshopFiles,
  restoreWorkshopFiles
} from '../config/workshop-draft-files'
import {
  deleteWorkshopDraft,
  readWorkshopDraft,
  storeWorkshopDraft
} from '../config/workshop-draft-storage'
import type { FieldSchema, FormValues } from '../config/workshop-playground'
import { restoreFormValues } from '../config/workshop-playground'
import { onBeforeSignInLeave } from '../config/workshop-return'
import { workshopIdempotencyKey } from '../config/workshop-snippets'

export function useWorkshopFormDraft(
  slug: string,
  schema: Readonly<Ref<readonly FieldSchema[]>>,
  values: Ref<FormValues>,
  nativeJson: Ref<boolean>,
  allowNativeJson: boolean
) {
  const key = `comfy-workshop-form:${slug}`
  const mediaKey = `${key}:media`
  const activity = ref<'idle' | 'restoring' | 'saving'>('idle')
  let restoration: Promise<void> | undefined
  let saving: Promise<void> | undefined
  const restoreFailed = ref(false)
  const controller = new AbortController()

  function persistScalars() {
    try {
      const scalars = Object.fromEntries(
        Object.entries(values.value)
          .filter(([, value]) => typeof value !== 'object')
          .map(([name, value]) => [name, value === undefined ? null : value])
      )
      sessionStorage.setItem(key, JSON.stringify(scalars))
      sessionStorage.setItem(`${key}:mode`, nativeJson.value ? 'json' : 'form')
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }

  async function saveFiles() {
    if (restoration) await restoration
    if (controller.signal.aborted) return
    activity.value = 'saving'
    persistScalars()
    try {
      const token = workshopIdempotencyKey()
      sessionStorage.setItem(mediaKey, token)
      const files = packWorkshopFiles(schema.value, values.value)
      if (!Object.keys(files).length) {
        sessionStorage.removeItem(mediaKey)
        return
      }
      await storeWorkshopDraft(token, files, controller.signal)
    } catch {
      restoreFailed.value = true
    } finally {
      activity.value = 'idle'
    }
  }

  function stash() {
    saving ??= saveFiles().finally(() => {
      saving = undefined
    })
    return saving
  }

  async function restore() {
    try {
      nativeJson.value =
        allowNativeJson && sessionStorage.getItem(`${key}:mode`) === 'json'
      const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      values.value = {
        ...values.value,
        ...restoreFormValues(schema.value, stored)
      }
      const token = sessionStorage.getItem(mediaKey)
      if (!token) return
      activity.value = 'restoring'
      const fields = schema.value
      const files = await readWorkshopDraft(token, controller.signal)
      controller.signal.throwIfAborted()
      if (schema.value !== fields)
        throw new Error('Form changed during restoration')
      const restored = restoreWorkshopFiles(fields, files)
      values.value = {
        ...values.value,
        ...clearWorkshopFiles(fields),
        ...restored
      }
      await deleteWorkshopDraft(token, controller.signal)
      if (
        !controller.signal.aborted &&
        sessionStorage.getItem(mediaKey) === token
      )
        sessionStorage.removeItem(mediaKey)
    } catch {
      if (!controller.signal.aborted) restoreFailed.value = true
    } finally {
      activity.value = 'idle'
    }
  }
  onMounted(() => {
    restoration = restore().finally(() => {
      restoration = undefined
    })
  })
  watch(
    [values, nativeJson],
    (_, __, onCleanup) => {
      const timer = setTimeout(persistScalars, 200)
      onCleanup(() => clearTimeout(timer))
    },
    { deep: true }
  )
  useEventListener('pagehide', persistScalars)
  const stop = onBeforeSignInLeave(stash)
  onScopeDispose(() => {
    persistScalars()
    stop()
    controller.abort()
  })
  return { pending: computed(() => activity.value !== 'idle'), restoreFailed }
}
