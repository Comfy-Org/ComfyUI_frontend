<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import MenuItems from './MenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { model } = defineProps<{
  model: MenuItem[]
}>()

const emit = defineEmits<{
  show: []
  hide: []
}>()

const content = useTemplateRef<HTMLElement>('content')
const open = ref(false)
const anchor = ref({ x: 0, y: 0 })
const visible = open
const overlayVisible = open
const contentStyle = useModalLiftedZIndex(open)

function show(event: Event) {
  const mouseEvent = event instanceof MouseEvent ? event : undefined
  const target = event.currentTarget
  const rect = target instanceof Element ? target.getBoundingClientRect() : null
  anchor.value = {
    x: mouseEvent?.clientX ?? rect?.left ?? 0,
    y: mouseEvent?.clientY ?? rect?.bottom ?? 0
  }
  open.value = false
  window.setTimeout(() => {
    open.value = true
  })
}

function hide() {
  open.value = false
}

function toggle(event: Event) {
  if (content.value?.isConnected) hide()
  else show(event)
}

function updateOpen(value: boolean) {
  open.value = value
  if (value) emit('show')
  else emit('hide')
}

defineExpose({ hide, overlayVisible, show, toggle, visible })
</script>

<template>
  <DropdownMenuRoot :open @update:open="updateOpen">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none fixed size-px opacity-0"
        :style="{ left: `${anchor.x}px`, top: `${anchor.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        as-child
        :side-offset="2"
        align="start"
        @close-auto-focus.prevent
      >
        <div
          ref="content"
          v-bind="$attrs"
          :class="cn(menuContentClass, $attrs.class)"
          :style="contentStyle"
        >
          <MenuItems :items="model">
            <template v-if="$slots.item" #item="slotProps">
              <slot name="item" v-bind="slotProps" />
            </template>
          </MenuItems>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
