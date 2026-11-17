<template>
  <div
    v-if="hints.length || actions.length"
    class="order-last flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2"
    @pointerdown.stop
    @mousedown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <span
      v-for="hint in hints"
      :key="hint.key"
      class="text-xs text-muted-foreground"
    >
      {{ hint.text }}
    </span>
    <Button
      v-for="action in actions"
      :key="action.key"
      variant="secondary"
      size="sm"
      :disabled="!enabled"
      @click="apply(action)"
    >
      {{ action.augmentation.label }}
    </Button>
  </div>
  <TextareaAutocomplete
    :element
    :enabled
    :teleported
    :suggest
    :provider-key="registrations"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useToast } from '@/components/ui/toast/toastStore'
import { useWidgetAugmentations } from '@/platform/extensions/useWidgetAugmentations'
import type { WidgetAugmentationTarget } from '@/platform/extensions/widgetAugmentation'
import TextareaAutocomplete from '@/renderer/extensions/textEditor/components/TextareaAutocomplete.vue'
import {
  supportsPromptTagCatalog,
  usePromptTagCatalogStore
} from '@/renderer/extensions/textEditor/promptTagCatalogStore'
import { useTextareaEdit } from '@/renderer/extensions/textEditor/useTextareaEdit'

const {
  element,
  enabled,
  target,
  value,
  teleported = false
} = defineProps<{
  element: () => HTMLTextAreaElement | undefined
  enabled: boolean
  target?: WidgetAugmentationTarget
  value: string
  teleported?: boolean
}>()

const { registrations, contributions, evaluate } = useWidgetAugmentations(
  () => target
)
const catalog = usePromptTagCatalogStore()
const edit = useTextareaEdit(element, () => enabled)
const { t } = useI18n()
const toast = useToast()

function requireText(result: unknown): string {
  if (typeof result !== 'string')
    throw new TypeError('Widget augmentation must return a string')
  return result
}

const hints = computed(() =>
  contributions.value.flatMap((item) => {
    const augmentation = item.augmentation
    if (augmentation.kind !== 'hint') return []
    const text = evaluate(item, () => requireText(augmentation.text(value)))
    return text ? [{ key: item.key, text }] : []
  })
)
const actions = computed(() =>
  contributions.value.flatMap((item) =>
    item.augmentation.kind === 'text-action'
      ? [{ ...item, augmentation: item.augmentation }]
      : []
  )
)

function apply(action: (typeof actions.value)[number]) {
  const previous = edit.snapshot()
  if (!previous) return
  const text = evaluate(action, () =>
    requireText(action.augmentation.transform(previous.value))
  )
  if (text === undefined || text === previous.value) return
  const result = edit.replace(
    previous,
    { from: 0, to: previous.value.length },
    text
  )
  if (!result.ok)
    toast.warning(
      t(
        result.reason === 'maxlength'
          ? 'textEditor.actionTooLong'
          : 'textEditor.actionUnavailable'
      )
    )
}

function suggest(query: string): string[] {
  const suggestions = contributions.value.flatMap((item) => {
    const augmentation = item.augmentation
    if (augmentation.kind !== 'text-completion') return []
    return (
      evaluate(item, () => {
        const result: unknown = augmentation.suggest(query)
        if (
          !Array.isArray(result) ||
          !result.every((entry) => typeof entry === 'string')
        )
          throw new TypeError('Widget completion must return string[]')
        return result.slice(0, 8)
      }) ?? []
    )
  })
  const catalogSuggestions = supportsPromptTagCatalog(target)
    ? catalog.suggest(query)
    : []
  return [...new Set([...suggestions, ...catalogSuggestions])].slice(0, 8)
}
</script>
