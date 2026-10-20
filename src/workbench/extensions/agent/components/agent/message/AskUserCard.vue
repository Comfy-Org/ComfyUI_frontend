<script setup lang="ts">
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

import type { AskUserPart } from '../../../services/agent/agentMessageParts'
import { choosableCount } from '../../../services/agent/agentMessageParts'
import AskUserAnswer from './AskUserAnswer.vue'
import AskUserCheckboxOptions from './AskUserCheckboxOptions.vue'
import AskUserRadioOptions from './AskUserRadioOptions.vue'

const { part, answering = false } = defineProps<{
  part: AskUserPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, answer: AgentAnswerRequest]
}>()

const { t } = useI18n()
const baseId = useId()

const selected = ref<string[]>([])
const otherText = ref('')

const replacesSelection = computed(() => part.maxSelections === 1)
const requiredSingleChoice = computed(
  () => replacesSelection.value && part.minSelections > 0
)
const trimmedOther = computed(() =>
  part.allowOther ? otherText.value.trim() : ''
)
const count = computed(
  () => selected.value.length + (trimmedOther.value ? 1 : 0)
)
const atMax = computed(() => count.value >= part.maxSelections)
const canSubmit = computed(
  () =>
    !answering &&
    count.value >= part.minSelections &&
    count.value <= part.maxSelections
)

function boundsHint(
  min: number,
  max: number,
  choosable: number
): string | undefined {
  if (min > 0) {
    if (min === max) return t('agent.askUser.chooseExactly', { min })
    return max >= choosable
      ? t('agent.askUser.chooseAtLeast', { min })
      : t('agent.askUser.chooseBetween', { min, max })
  }
  if (choosable === 1) return undefined
  if (max >= choosable) return t('agent.askUser.chooseAny')
  return max === 1
    ? t('agent.askUser.chooseOneOrNone')
    : t('agent.askUser.chooseUpTo', { max })
}

const hint = computed(() =>
  requiredSingleChoice.value || part.resolution
    ? undefined
    : boundsHint(part.minSelections, part.maxSelections, choosableCount(part))
)

const promptId = `${baseId}-prompt`
const hintId = `${baseId}-hint`
const otherId = `${baseId}-other`
const otherDescribedBy = computed(() =>
  hint.value ? `${promptId} ${hintId}` : promptId
)

const singleValue = computed(() => selected.value[0])

function chooseSingle(value: string | undefined): void {
  if (value === undefined) return
  selected.value = [value]
  otherText.value = ''
}

function chooseMany(next: string[]): void {
  if (!replacesSelection.value) {
    selected.value = next
    return
  }
  const added = next.filter((id) => !selected.value.includes(id))
  selected.value = added
  if (added.length > 0) otherText.value = ''
}

const otherModel = computed({
  get: () => otherText.value,
  set: (value: string | number | undefined) => {
    otherText.value = String(value ?? '')
    if (replacesSelection.value && otherText.value.trim()) selected.value = []
  }
})

const otherDisabled = computed(
  () =>
    answering ||
    (!replacesSelection.value && atMax.value && !trimmedOther.value)
)

const IME_PROCESS_KEY_CODE = 229
const composing = ref(false)

function onCompositionEnd(): void {
  setTimeout(() => {
    composing.value = false
  })
}

function onOtherEnter(event: KeyboardEvent): void {
  if (
    event.isComposing ||
    composing.value ||
    event.keyCode === IME_PROCESS_KEY_CODE
  )
    return
  event.preventDefault()
  submit()
}

function submit(): void {
  if (!canSubmit.value) return
  const chosen = part.options
    .map(({ id }) => id)
    .filter((id) => selected.value.includes(id))
  emit(
    'answer',
    part.askId,
    trimmedOther.value
      ? { selected: chosen, other_text: trimmedOther.value }
      : { selected: chosen }
  )
}
</script>

<template>
  <div
    role="group"
    :aria-label="t('agent.askUser.card')"
    class="flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-component-node-border bg-secondary-background p-4 shadow-interface"
  >
    <div class="flex min-w-0 flex-col gap-0.5 text-sm/5">
      <p
        :id="promptId"
        class="m-0 font-medium wrap-break-word whitespace-pre-line text-base-foreground"
      >
        {{ part.prompt }}
      </p>
      <p v-if="hint" :id="hintId" class="m-0 text-xs/5 text-muted-foreground">
        {{ hint }}
      </p>
    </div>

    <AskUserAnswer
      v-if="part.resolution"
      :resolution="part.resolution"
      :options="part.options"
    />

    <template v-else>
      <AskUserRadioOptions
        v-if="requiredSingleChoice"
        :model-value="singleValue"
        :options="part.options"
        :id-prefix="baseId"
        :labelled-by="promptId"
        :disabled="answering"
        @update:model-value="chooseSingle"
      />

      <AskUserCheckboxOptions
        v-else
        :model-value="selected"
        :options="part.options"
        :id-prefix="baseId"
        :labelled-by="promptId"
        :described-by="hint ? hintId : undefined"
        :disabled="answering"
        :full="!replacesSelection && atMax"
        @update:model-value="chooseMany"
      />

      <div v-if="part.allowOther" class="flex flex-col gap-1 px-2 text-sm/5">
        <label :for="otherId" class="text-base-foreground">
          {{ t('agent.askUser.other') }}
        </label>
        <Input
          :id="otherId"
          v-model="otherModel"
          type="text"
          :placeholder="t('agent.askUser.otherPlaceholder')"
          :disabled="otherDisabled"
          :aria-describedby="otherDescribedBy"
          class="h-8 bg-component-node-background px-3"
          @keydown.enter="onOtherEnter"
          @compositionstart="composing = true"
          @compositionend="onCompositionEnd"
        />
      </div>

      <div class="flex h-6 w-full justify-end gap-2">
        <Button
          variant="primary"
          size="sm"
          :disabled="!canSubmit"
          :aria-busy="answering || undefined"
          @click="submit"
        >
          {{ t('g.submit') }}
        </Button>
      </div>
    </template>
  </div>
</template>
