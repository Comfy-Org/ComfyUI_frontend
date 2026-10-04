<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

import type { AgentAnswerRequest } from '../../../schemas/agentApiSchema'
import type { AskUserPart } from '../../../services/agent/agentMessageParts'
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

// One choice at a time: picking an option replaces the last one. A required
// single choice renders as radios; an optional one as checkboxes, so it can be
// cleared again.
const exclusive = computed(() => part.maxSelections === 1)
const single = computed(() => exclusive.value && part.minSelections > 0)
const trimmedOther = computed(() =>
  part.allowOther ? otherText.value.trim() : ''
)
// Mirrors the server rule: free text counts as one more selection.
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

const hint = computed(() => {
  if (single.value || part.resolution) return undefined
  const { minSelections: min, maxSelections: max } = part
  const choosable = part.options.length + (part.allowOther ? 1 : 0)
  if (min > 1 && min === max) return t('agent.askUser.chooseExactly', { min })
  if (max >= choosable)
    return min > 1
      ? t('agent.askUser.chooseAtLeast', { min })
      : t('agent.askUser.chooseAny')
  if (min > 1) return t('agent.askUser.chooseBetween', { min, max })
  return t('agent.askUser.chooseUpTo', { max })
})

const promptId = `${baseId}-prompt`
const hintId = `${baseId}-hint`
const otherId = `${baseId}-other`
// The Other box sits outside the option group, so it needs the prompt and
// the selection hint spelled out for assistive technology itself.
const otherDescribedBy = computed(() =>
  hint.value ? `${promptId} ${hintId}` : promptId
)

const singleValue = computed(() => selected.value[0])

function chooseSingle(value: unknown): void {
  if (typeof value !== 'string') return
  selected.value = [value]
  otherText.value = ''
}

function chooseMany(next: string[]): void {
  if (!exclusive.value) {
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
    if (exclusive.value && otherText.value.trim()) selected.value = []
  }
})

const otherDisabled = computed(
  () => answering || (!exclusive.value && atMax.value && !trimmedOther.value)
)

function onOtherEnter(event: KeyboardEvent): void {
  // Enter commits an IME candidate while composing; it must not submit.
  if (event.isComposing) return
  event.preventDefault()
  submit()
}

function submit(): void {
  if (!canSubmit.value) return
  // Built from the unique selection state the counts checked, in option order.
  const order = new Map(part.options.map(({ id }, index) => [id, index]))
  const chosen = [...selected.value].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  )
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
        v-if="single"
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
        :full="!exclusive && atMax"
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
