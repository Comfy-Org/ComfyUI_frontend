<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'

import type {
  AgentAskAnswer,
  AskUserOption,
  AskUserPart
} from '../../../services/agent/agentMessageParts'
import AskUserOptionLabel from './AskUserOptionLabel.vue'

const { part, answering = false } = defineProps<{
  part: AskUserPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, answer: AgentAskAnswer]
}>()

const { t } = useI18n()
const baseId = useId()

const selected = ref<string[]>([])
const otherText = ref('')

watch(
  () => part.askId,
  () => {
    selected.value = []
    otherText.value = ''
  }
)

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
  if (single.value) return undefined
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

const optionId = (index: number) => `${baseId}-option-${index}`
const describedBy = (option: AskUserOption, index: number) =>
  option.description ? `${optionId(index)}-description` : undefined
const promptId = `${baseId}-prompt`
const hintId = `${baseId}-hint`
const otherId = `${baseId}-other`

const singleValue = computed(() => selected.value[0] ?? null)

function chooseSingle(value: unknown): void {
  if (typeof value !== 'string') return
  selected.value = [value]
  otherText.value = ''
}

function toggle(id: string, checked: boolean): void {
  const others = selected.value.filter((value) => value !== id)
  if (!checked) {
    selected.value = others
    return
  }
  selected.value = exclusive.value ? [id] : [...others, id]
  if (exclusive.value) otherText.value = ''
}

const otherModel = computed({
  get: () => otherText.value,
  set: (value: string | number | undefined) => {
    otherText.value = String(value ?? '')
    if (exclusive.value && otherText.value.trim()) selected.value = []
  }
})

function optionDisabled(id: string): boolean {
  return (
    answering ||
    (!exclusive.value && atMax.value && !selected.value.includes(id))
  )
}

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
  const chosen = selected.value.toSorted(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  )
  emit(
    'answer',
    part.askId,
    trimmedOther.value
      ? { selected: chosen, otherText: trimmedOther.value }
      : { selected: chosen }
  )
}

const rowClass =
  'flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary-background-hover'
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

    <RadioGroupRoot
      v-if="single"
      :model-value="singleValue"
      :disabled="answering"
      :aria-labelledby="promptId"
      class="flex flex-col gap-0.5 text-sm/5"
      @update:model-value="chooseSingle"
    >
      <div
        v-for="(option, index) in part.options"
        :key="option.id"
        :class="rowClass"
      >
        <RadioGroupItem
          :id="optionId(index)"
          :value="option.id"
          :aria-labelledby="`${optionId(index)}-label`"
          :aria-describedby="describedBy(option, index)"
          :class="
            cn(
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-node-component-header-icon bg-transparent p-0 transition-colors',
              'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'data-[state=checked]:border-primary-background'
            )
          "
        >
          <RadioGroupIndicator class="flex items-center justify-center">
            <span class="size-2 rounded-full bg-primary-background" />
          </RadioGroupIndicator>
        </RadioGroupItem>
        <AskUserOptionLabel :option-id="optionId(index)" :option />
      </div>
    </RadioGroupRoot>

    <div
      v-else
      role="group"
      :aria-labelledby="promptId"
      :aria-describedby="hint ? hintId : undefined"
      class="flex flex-col gap-0.5 text-sm/5"
    >
      <div
        v-for="(option, index) in part.options"
        :key="option.id"
        :class="rowClass"
      >
        <Checkbox
          :id="optionId(index)"
          :model-value="selected.includes(option.id)"
          :disabled="optionDisabled(option.id)"
          :aria-labelledby="`${optionId(index)}-label`"
          :aria-describedby="describedBy(option, index)"
          class="mt-0.5 size-4"
          @update:model-value="(checked) => toggle(option.id, checked === true)"
        />
        <AskUserOptionLabel
          :option-id="optionId(index)"
          :option
          :disabled="optionDisabled(option.id)"
        />
      </div>
    </div>

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
        {{ t('agent.askUser.submit') }}
      </Button>
    </div>
  </div>
</template>
