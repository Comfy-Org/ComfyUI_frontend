<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import Textarea from '@comfyorg/design-system/textarea/Textarea'

import { useSkillDraft } from '@/platform/skills/composables/useSkillDraft'
import { useSkillPackForm } from '@/platform/skills/composables/useSkillPackForm'
import type { SkillPack } from '@/platform/skills/types'
import { CONTROL_CHARACTERS, MAX_NAME_LENGTH } from '@/platform/skills/types'

const CONTROL_RUN = `${CONTROL_CHARACTERS.source}+`
const CONTROL_RUNS = new RegExp(CONTROL_RUN, 'gu')
const CONTROL_RUNS_AT_EDGES = new RegExp(
  `^${CONTROL_RUN}|${CONTROL_RUN}$`,
  'gu'
)

const { skill } = defineProps<{ skill?: SkillPack }>()

const emit = defineEmits<{ close: [savedName?: string] }>()

const { t } = useI18n()
const nameId = useId()
const descriptionId = useId()
const bodyId = useId()
const saveButtonId = useId()

const visible = ref(true)
const savedName = ref<string>()

const {
  form,
  errors,
  loading,
  fieldError,
  budgetError,
  bodyBytes,
  handleSubmit
} = useSkillPackForm({
  pack: () => skill,
  visible,
  onSaved: (saved) => {
    savedName.value = saved.name
  }
})

const draft = useSkillDraft({ pack: skill, form })

watch(visible, (isVisible) => {
  if (isVisible) return
  if (savedName.value) draft.settle()
  emit('close', savedName.value)
})

const isEditing = computed(() => skill !== undefined)

const bodySizeLabel = computed(() =>
  t('agent.skillSize', { bytes: bodyBytes.value })
)

function focusElement(id: string | undefined): void {
  if (id) document.getElementById(id)?.focus()
}

function firstInvalidFieldId(): string | undefined {
  if (errors.name) return nameId
  if (errors.description) return descriptionId
  if (errors.body) return bodyId
  return undefined
}

async function onSubmit(): Promise<void> {
  await handleSubmit()
  await nextTick()
  const serverRefused = fieldError.value || budgetError.value
  focusElement(
    firstInvalidFieldId() ?? (serverRefused ? saveButtonId : undefined)
  )
}

const description = computed({
  get: () => form.description,
  set: (value: string | number | undefined) => {
    form.description = String(value ?? '')
      .replace(CONTROL_RUNS_AT_EDGES, '')
      .replace(CONTROL_RUNS, ' ')
  }
})

function onDescriptionBeforeInput(event: InputEvent): void {
  if (event.inputType !== 'insertLineBreak') return
  event.preventDefault()
  void onSubmit()
}

function keepShortcutEnterInForm(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) event.stopPropagation()
}

function requestClose(): void {
  visible.value = false
}

onMounted(async () => {
  await nextTick()
  focusElement(isEditing.value ? descriptionId : nameId)
})
</script>

<template>
  <form
    class="flex h-full flex-col overflow-hidden"
    @submit.prevent="onSubmit"
    @keydown.enter="keepShortcutEnterInForm"
  >
    <div class="flex h-10 shrink-0 items-center gap-1 px-2">
      <Button
        :tooltip="t('agent.backToSkills')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.backToSkills')"
        :disabled="loading"
        class="size-6 shrink-0"
        @click="requestClose"
      >
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
      </Button>
      <h2 class="m-0 text-xs font-normal text-muted-foreground">
        {{ isEditing ? t('agent.editSkill') : t('agent.addSkill') }}
      </h2>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <div class="flex flex-col gap-1">
        <label :for="nameId" class="text-sm font-medium">
          {{ t('agent.skillName') }}
        </label>
        <Input
          :id="nameId"
          v-model="form.name"
          :placeholder="t('agent.skillNamePlaceholder')"
          :disabled="isEditing || loading"
          :aria-invalid="!!errors.name || undefined"
          :aria-describedby="`${nameId}-help`"
          :maxlength="MAX_NAME_LENGTH"
        />
        <small
          v-if="errors.name"
          :id="`${nameId}-help`"
          role="alert"
          class="text-xs text-destructive"
        >
          {{ errors.name }}
        </small>
        <small
          v-else
          :id="`${nameId}-help`"
          class="text-xs text-muted-foreground"
        >
          {{
            isEditing ? t('agent.skillNameLocked') : t('agent.skillNameHint')
          }}
        </small>
      </div>

      <div class="flex flex-col gap-1">
        <label :for="descriptionId" class="text-sm font-medium">
          {{ t('agent.skillWhenToUse') }}
        </label>
        <Textarea
          :id="descriptionId"
          v-model="description"
          class="field-sizing-content min-h-10 resize-none px-4"
          :placeholder="t('agent.skillWhenToUsePlaceholder')"
          :disabled="loading"
          :aria-invalid="!!errors.description || undefined"
          :aria-describedby="`${descriptionId}-help`"
          @beforeinput="onDescriptionBeforeInput"
        />
        <small
          v-if="errors.description"
          :id="`${descriptionId}-help`"
          role="alert"
          class="text-xs text-destructive"
        >
          {{ errors.description }}
        </small>
        <small
          v-else
          :id="`${descriptionId}-help`"
          class="text-xs text-muted-foreground"
        >
          {{ t('agent.skillWhenToUseHint') }}
        </small>
      </div>

      <div class="flex flex-1 flex-col gap-1">
        <label :for="bodyId" class="text-sm font-medium">
          {{ t('agent.skillInstructions') }}
        </label>
        <Textarea
          :id="bodyId"
          v-model="form.body"
          class="min-h-40 flex-1 resize-none font-mono"
          :placeholder="t('agent.skillInstructionsPlaceholder')"
          :disabled="loading"
          :aria-invalid="!!errors.body || undefined"
          :aria-describedby="`${bodyId}-help`"
        />
        <small
          v-if="errors.body"
          :id="`${bodyId}-help`"
          role="alert"
          class="text-xs text-destructive"
        >
          {{ errors.body }}
        </small>
        <small
          v-else
          :id="`${bodyId}-help`"
          class="text-xs text-muted-foreground"
        >
          {{ bodySizeLabel }}
        </small>
      </div>
    </div>

    <div
      v-if="budgetError"
      role="alert"
      class="mx-3 mb-2 flex shrink-0 flex-col gap-1 rounded-lg border border-destructive p-3 text-sm text-muted-foreground"
    >
      <span class="font-medium text-destructive">
        {{ t('agent.skillLimitTitle') }}
      </span>
      <span>{{ budgetError }}</span>
      <span>{{ t('agent.skillLimitHint') }}</span>
    </div>
    <p
      v-else-if="fieldError"
      role="alert"
      class="m-0 mx-3 mb-2 shrink-0 text-sm text-destructive"
    >
      {{ fieldError }}
    </p>

    <div
      class="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 px-3 py-2"
    >
      <Button
        type="button"
        variant="secondary"
        size="md"
        :disabled="loading"
        @click="requestClose"
      >
        {{ t('g.cancel') }}
      </Button>
      <Button
        :id="saveButtonId"
        type="submit"
        variant="primary"
        size="md"
        :loading="loading"
      >
        {{ t('g.save') }}
      </Button>
    </div>
  </form>
</template>
