<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring',
        !isReadOnly && 'hover:bg-muted',
        widget.borderStyle
      )
    "
  >
    <div
      :class="
        cn(
          'flex size-full flex-col overflow-hidden rounded-md',
          !widget.options?.disabled && (isReadOnly ? 'bg-input/50' : 'bg-input')
        )
      "
    >
      <div class="flex h-6 shrink-0 items-center gap-2 px-3">
        <label
          v-if="!hideLayoutField"
          :for="id"
          class="min-w-0 truncate text-2xs text-muted-foreground"
        >
          {{ displayName }}
        </label>
        <div
          role="group"
          :aria-label="$t('g.actions')"
          class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
        >
          <span class="pr-1 text-2xs text-muted-foreground tabular-nums">
            {{ characterCount }}
          </span>
          <span aria-hidden="true" class="mr-1 h-3 w-px bg-border" />
          <Button
            variant="textonly"
            size="icon-sm"
            :class="actionButtonClass"
            :title="isCopied ? $t('g.copied') : $t('g.copyToClipboard')"
            :aria-label="isCopied ? $t('g.copied') : $t('g.copyToClipboard')"
            @click="handleCopy"
            @pointerdown.capture.stop
          >
            <i
              :class="
                cn(
                  'size-3',
                  isCopied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
                )
              "
            />
          </Button>
          <Button
            v-if="!widget.linkedUpstream"
            variant="textonly"
            size="icon-sm"
            :class="actionButtonClass"
            :title="$t('textEditor.expand')"
            :aria-label="$t('textEditor.expand')"
            @click="openTextEditor"
            @pointerdown.capture.stop
          >
            <i class="icon-[lucide--maximize-2] size-3" />
          </Button>
        </div>
      </div>
      <Textarea
        v-bind="filteredProps"
        :id
        ref="textAreaRef"
        :model-value="text"
        class="min-h-0 flex-1 resize-none overflow-hidden rounded-none bg-transparent pt-0 pr-4 font-mono text-(length:--comfy-textarea-font-size) leading-normal not-disabled:text-foreground hover:overflow-auto focus:overflow-auto focus-visible:ring-0"
        :placeholder
        :readonly="isReadOnly"
        data-capture-wheel="true"
        @pointerdown.capture.stop="trackFocus"
        @pointermove.capture.stop
        @pointerup.capture.stop
        @contextmenu.capture="handleContextMenu"
        @update:model-value="(value) => (modelValue = String(value))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { refAutoReset } from '@vueuse/core'
import { omit } from 'es-toolkit'
import { computed, onBeforeUnmount, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const actionButtonClass =
  'pointer-events-none rounded-sm hover:bg-muted group-hover:pointer-events-auto pointer-coarse:pointer-events-auto'

const {
  widget,
  nodeTitle,
  placeholder = ''
} = defineProps<{
  widget: SimplifiedWidget<string>
  nodeTitle?: string
  placeholder?: string
}>()

const textAreaRef = useTemplateRef('textAreaRef')

const modelValue = defineModel<string | number | null>({ default: '' })
const text = computed(() => String(modelValue.value ?? ''))

const isFocused = ref(false)
function trackFocus() {
  isFocused.value = document.activeElement === textAreaRef.value?.$el
}

const hideLayoutField = useHideLayoutField()
const { copyToClipboard } = useCopyToClipboard()
const isCopied = refAutoReset(false, 2000)

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const { t, n } = useI18n()
const characterCount = computed(() =>
  t(
    'textEditor.characterCount',
    { count: n(text.value.length) },
    text.value.length
  )
)
const id = useId()

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

function handleContextMenu(e: MouseEvent) {
  if (isNodeOptionsOpen() || isFocused.value) {
    e.stopPropagation()
    return
  }
  e.preventDefault()
}

async function handleCopy() {
  isCopied.value = await copyToClipboard(text.value, {
    toastOnSuccess: false
  })
}

let closeTextEditor: (() => void) | undefined

function openTextEditor() {
  closeTextEditor = showTextEditor({
    readText: () => text.value,
    widgetLabel: displayName.value,
    nodeTitle,
    readOnly: () => isReadOnly.value,
    onEdit: (text) => (modelValue.value = text),
    textareaAttributes: () => ({
      ...omit(filteredProps.value, ['disabled']),
      placeholder
    })
  })
}

onBeforeUnmount(() => closeTextEditor?.())
</script>
