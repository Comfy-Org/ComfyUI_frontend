<template>
  <div
    v-if="supportsPromptTagCatalog(augmentationTarget)"
    class="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-2"
  >
    <Button
      variant="secondary"
      size="sm"
      icon="icon-[lucide--upload]"
      :loading="importState === 'loading'"
      @click="catalogInput?.click()"
    >
      {{ $t('textEditor.importTags') }}
    </Button>
    <input
      ref="catalogInput"
      type="file"
      accept=".csv,.txt,text/csv,text/plain"
      class="hidden"
      :aria-label="$t('textEditor.importTags')"
      @change="importTags"
    />
    <span role="status" class="text-xs text-muted-foreground">
      {{
        catalog.tags.length
          ? $t('textEditor.tagsLoaded', catalog.tags.length)
          : $t('textEditor.importTagsHint')
      }}
    </span>
    <p
      v-if="importState === 'error'"
      role="alert"
      class="m-0 w-full text-sm text-destructive"
    >
      {{ $t('textEditor.importTagsError') }}
    </p>
  </div>
  <Textarea
    ref="textareaRef"
    v-bind="attributes()"
    :model-value="readText()"
    :aria-label="label"
    :readonly="readOnly()"
    class="h-150 min-h-40 flex-auto resize-none rounded-t-none rounded-b-2xl border-t border-solid border-border/50 bg-transparent px-[max(--spacing(4),calc((100%-34em)/2))] py-10 font-inter text-[15px] leading-6 focus-visible:ring-0"
    data-testid="text-editor-dialog-textarea"
    @compositionstart="isComposing = true"
    @compositionend="isComposing = false"
    @update:model-value="(value) => onEdit(String(value))"
  />
  <TextareaAugmentations
    :element="textareaElement"
    :enabled="!readOnly() && !attributes().disabled"
    :target="augmentationTarget"
    :value="readText()"
  />
</template>

<script setup lang="ts">
import type { TextareaHTMLAttributes } from 'vue'
import {
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import type { WidgetAugmentationTarget } from '@/platform/extensions/widgetAugmentation'
import TextareaAugmentations from '@/renderer/extensions/textEditor/components/TextareaAugmentations.vue'
import {
  supportsPromptTagCatalog,
  usePromptTagCatalogStore
} from '@/renderer/extensions/textEditor/promptTagCatalogStore'

defineOptions({ inheritAttrs: false })

const {
  readText,
  label,
  readOnly,
  onEdit,
  augmentationTarget,
  attributes = (): TextareaHTMLAttributes => ({})
} = defineProps<{
  readText: () => string
  label: string
  readOnly: () => boolean
  onEdit: (text: string) => void
  augmentationTarget?: WidgetAugmentationTarget
  attributes?: () => TextareaHTMLAttributes
}>()

const textareaRef = useTemplateRef('textareaRef')
const catalogInput = useTemplateRef('catalogInput')
const catalog = usePromptTagCatalogStore()
const importState = ref<'idle' | 'loading' | 'error'>('idle')
const isComposing = ref(false)
let disposed = false
onScopeDispose(() => (disposed = true))

async function importTags(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    importState.value = 'error'
    return
  }
  importState.value = 'loading'
  let text: string
  try {
    text = await file.text()
  } catch {
    if (disposed) return
    importState.value = 'error'
    return
  }
  if (disposed) return
  importState.value = catalog.importCatalog(text) ? 'idle' : 'error'
  textareaElement()?.focus()
}

function textareaElement(): HTMLTextAreaElement | undefined {
  const element: unknown = textareaRef.value?.$el
  return element instanceof HTMLTextAreaElement ? element : undefined
}

watch(
  () => readText(),
  async (text) => {
    const element = textareaElement()
    if (!element || isComposing.value || text === element.value) return
    const view = {
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection ?? undefined,
      scrollTop: element.scrollTop,
      selectedThrough: element.value.slice(0, element.selectionEnd)
    }
    await nextTick()
    const start = Math.min(view.start, text.length)
    const isSelectionIntact = text.startsWith(view.selectedThrough)
    element.setSelectionRange(
      start,
      isSelectionIntact ? view.end : start,
      view.direction
    )
    element.scrollTop = view.scrollTop
  }
)

onMounted(() => {
  const element = textareaElement()
  if (!element) return
  element.setSelectionRange(0, 0)
  element.focus()
})
</script>
