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

const content = useTemplateRef('content')
const visible = ref(false)
const generatedId = useId()
const triggerId = `${generatedId}-trigger`
const contentStyle = useModalLiftedZIndex(visible)

function show(event: Event) {
  const mouseEvent = event instanceof MouseEvent ? event : undefined
  const target = event.currentTarget ?? event.target
  const rect = target instanceof Element ? target.getBoundingClientRect() : null
  const clientX = mouseEvent?.clientX ?? rect?.left ?? 0
  const clientY = mouseEvent?.clientY ?? rect?.top ?? 0
  window.setTimeout(() => {
    document.getElementById(triggerId)?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        clientX,
        clientY
      })
    )
  })
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
    <ContextMenuTrigger
      :id="triggerId"
      class="pointer-events-none fixed size-px opacity-0"
    />
    <ContextMenuPortal>
      <ContextMenuContent as-child @close-auto-focus.prevent>
        <div
          :id="providedId ?? generatedId"
          ref="content"
          :class="
            cn(
              menuContentClass,
              'max-h-(--reka-context-menu-content-available-height)',
              $attrs.class
            )
          "
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
