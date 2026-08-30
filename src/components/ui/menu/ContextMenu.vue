<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'
import { nextTick, ref, useId, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import ContextMenuItems from './ContextMenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { id: providedId, model } = defineProps<{
  id?: string
  model: MenuItem[]
}>()
const emit = defineEmits<{ show: []; hide: [] }>()

const trigger = useTemplateRef('trigger')
const content = useTemplateRef('content')
const visible = ref(false)
const generatedId = useId()
const contentStyle = useModalLiftedZIndex(visible)

function show(event: Event) {
  if (!(event instanceof MouseEvent)) return
  const syntheticEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY
  })
  trigger.value?.dispatchEvent(syntheticEvent)
}

function hide() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  )
}

function toggle(event: Event) {
  if (visible.value) hide()
  else show(event)
}

function updateOpen(value: boolean) {
  visible.value = value
  void nextTick(() => {
    if (value) emit('show')
    else emit('hide')
  })
}

defineExpose({ container: content, hide, show, toggle, visible })
</script>

<template>
  <ContextMenuRoot :modal="false" @update:open="updateOpen">
    <ContextMenuTrigger as-child>
      <span ref="trigger" class="pointer-events-none fixed size-px opacity-0" />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent as-child>
        <div
          :id="providedId ?? generatedId"
          ref="content"
          :class="cn(menuContentClass, $attrs.class)"
          :style="contentStyle"
        >
          <ContextMenuItems :items="model">
            <template v-if="$slots.item" #item="slotProps">
              <slot name="item" v-bind="slotProps" />
            </template>
          </ContextMenuItems>
        </div>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
