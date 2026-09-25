import { whenever } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, reactive, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@/platform/telemetry/reportError'

import { publishSkillPack, SkillPacksApiError } from '../api/skillsApi'
import { useSkillPacksStore } from '../stores/skillPacksStore'
import type { SkillPack } from '../types'
import {
  CONTROL_CHARACTERS,
  codePointLength,
  MAX_DESCRIPTION_CODE_POINTS,
  MAX_NAME_LENGTH,
  PACK_NAME_PATTERN,
  RESERVED_PACK_NAMES,
  utf8ByteLength
} from '../types'

interface SkillPackFormState {
  name: string
  description: string
  body: string
}

interface SkillPackFormErrors {
  name: string
  description: string
  body: string
}

interface UseSkillPackFormOptions {
  /** The pack being edited; absent for a new one. */
  pack?: MaybeRefOrGetter<SkillPack | undefined>
  visible: { value: boolean }
  onSaved: () => void
}

function isReservedName(name: string): boolean {
  return RESERVED_PACK_NAMES.some((reserved) => reserved === name)
}

export function useSkillPackForm(options: UseSkillPackFormOptions) {
  const { t } = useI18n()
  const { pack: packRef, visible, onSaved } = options
  const store = useSkillPacksStore()

  const loading = ref(false)
  /** A 400: the request can be edited into a valid one. */
  const fieldError = ref<string | null>(null)
  /**
   * A 409: nothing about this pack can be edited to make it fit, another pack
   * has to go. The server message names the limit and the overage, so it is
   * surfaced verbatim rather than restated in invented copy.
   */
  const budgetError = ref<string | null>(null)

  const form = reactive<SkillPackFormState>({
    name: '',
    description: '',
    body: ''
  })

  const errors = reactive<SkillPackFormErrors>({
    name: '',
    description: '',
    body: ''
  })

  const isReplacing = computed(() =>
    store.packs.some((existing) => existing.name === form.name.trim())
  )

  const bodyBytes = computed(() => utf8ByteLength(form.body))
  const descriptionCodePoints = computed(() =>
    codePointLength(form.description)
  )

  function resetForm() {
    const pack = toValue(packRef)
    form.name = pack?.name ?? ''
    form.description = pack?.description ?? ''
    form.body = pack?.body ?? ''
    errors.name = ''
    errors.description = ''
    errors.body = ''
    fieldError.value = null
    budgetError.value = null
  }

  resetForm()
  whenever(() => visible.value, resetForm)

  function validateName(): boolean {
    const name = form.name.trim()
    if (!name) {
      errors.name = t('skillPacks.errors.nameRequired')
      return false
    }
    if (name.length > MAX_NAME_LENGTH) {
      errors.name = t('skillPacks.errors.nameTooLong', {
        max: MAX_NAME_LENGTH
      })
      return false
    }
    if (!PACK_NAME_PATTERN.test(name)) {
      errors.name = t('skillPacks.errors.nameCharset')
      return false
    }
    if (isReservedName(name)) {
      errors.name = t('skillPacks.errors.nameReserved', { name })
      return false
    }
    if (!toValue(packRef) && isReplacing.value) {
      errors.name = t('skillPacks.errors.nameAlreadyExists', { name })
      return false
    }
    return true
  }

  function validateDescription(): boolean {
    if (!form.description.trim()) {
      errors.description = t('skillPacks.errors.descriptionRequired')
      return false
    }
    if (CONTROL_CHARACTERS.test(form.description)) {
      errors.description = t('skillPacks.errors.descriptionSingleLine')
      return false
    }
    if (descriptionCodePoints.value > MAX_DESCRIPTION_CODE_POINTS) {
      errors.description = t('skillPacks.errors.descriptionTooLong', {
        max: MAX_DESCRIPTION_CODE_POINTS
      })
      return false
    }
    return true
  }

  function validateBody(): boolean {
    if (!form.body.trim()) {
      errors.body = t('skillPacks.errors.bodyRequired')
      return false
    }
    return true
  }

  function validate(): boolean {
    errors.name = ''
    errors.description = ''
    errors.body = ''
    fieldError.value = null
    budgetError.value = null

    if (!validateName() || !validateDescription() || !validateBody()) {
      return false
    }
    return true
  }

  async function handleSubmit() {
    if (!validate()) return

    loading.value = true
    try {
      const saved = await publishSkillPack({
        name: form.name.trim(),
        description: form.description,
        body: form.body
      })
      store.upsertPack(saved)
      onSaved()
      visible.value = false
    } catch (error) {
      if (error instanceof SkillPacksApiError && error.status === 409) {
        budgetError.value = error.message
      } else if (error instanceof SkillPacksApiError && error.status === 404) {
        store.markUnavailable()
        visible.value = false
      } else if (error instanceof SkillPacksApiError) {
        fieldError.value = error.message
      } else {
        reportError(error, {
          errorType: 'error_publishing_agent_skill_pack'
        })
        fieldError.value = t('g.unknownError')
      }
    } finally {
      loading.value = false
    }
  }

  return {
    form,
    errors,
    loading,
    fieldError,
    budgetError,
    bodyBytes,
    handleSubmit
  }
}
