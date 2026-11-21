<template>
  <Teleport to="body" :disabled="!teleported">
    <div
      v-if="matches.length"
      ref="floating"
      :style="floatingStyles"
      class="z-overlay w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-background p-1 text-foreground shadow-lg"
      @pointerdown.prevent
      @mousedown.stop
    >
      <div class="px-3 py-2 text-xs text-muted-foreground">
        {{ $t('textEditor.suggestions') }}
      </div>
      <div
        :id="listId"
        role="listbox"
        :aria-label="$t('textEditor.suggestions')"
      >
        <div
          v-for="(match, index) in matches"
          :id="`${listId}-${index}`"
          :key="match"
          role="option"
          :aria-selected="index === active"
          :class="
            cn(
              'cursor-pointer rounded-sm px-3 py-2 text-sm',
              index === active && 'bg-accent'
            )
          "
          @pointermove="active = index"
          @click="accept(index)"
        >
          {{ match }}
        </div>
      </div>
    </div>
  </Teleport>
  <span role="status" class="sr-only">
    {{ matches.length ? $t('textEditor.suggestionCount', matches.length) : '' }}
  </span>
</template>

<script setup lang="ts">
import { useId, useTemplateRef, watch, watchEffect } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { useTextareaAutocomplete } from '@/renderer/extensions/textEditor/useTextareaAutocomplete'

const {
  element,
  enabled,
  suggest,
  providerKey,
  teleported = false
} = defineProps<{
  element: () => HTMLTextAreaElement | undefined
  enabled: boolean
  suggest: (query: string) => string[]
  providerKey: unknown
  teleported?: boolean
}>()

const listId = useId()
const { matches, active, floatingStyles, accept, close } =
  useTextareaAutocomplete({
    element,
    floating: useTemplateRef<HTMLElement>('floating'),
    enabled: () => enabled,
    suggest
  })

watch(() => providerKey, close)

watchEffect((onCleanup) => {
  const input = element()
  if (!input) return
  const attributes = {
    'aria-autocomplete': 'list',
    'aria-haspopup': 'listbox',
    'aria-controls': matches.value.length ? listId : null,
    'aria-activedescendant': matches.value.length
      ? `${listId}-${active.value}`
      : null
  }
  const previous = Object.keys(attributes).map(
    (name) => [name, input.getAttribute(name)] as const
  )
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }
  onCleanup(() => {
    for (const [name, value] of previous) {
      if (value === null) input.removeAttribute(name)
      else input.setAttribute(name, value)
    }
  })
})
</script>
