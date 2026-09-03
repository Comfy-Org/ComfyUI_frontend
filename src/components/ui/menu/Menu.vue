<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { nextTick, ref, useTemplateRef } from 'vue'
import type { ComponentPublicInstance } from 'vue'

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

const content = useTemplateRef<ComponentPublicInstance>('content')
const open = ref(false)
const showTimer = ref<number>()
const showRequest = ref(0)
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
  window.clearTimeout(showTimer.value)
  open.value = false
  const request = ++showRequest.value
  void nextTick(() => {
    if (request !== showRequest.value) return
    showTimer.value = window.setTimeout(() => {
      open.value = true
    })
  })
}

function hide() {
  showRequest.value++
  window.clearTimeout(showTimer.value)
  open.value = false
}

function toggle(event: Event) {
  const element = content.value?.$el
  if (
    element instanceof HTMLElement &&
    element.dataset.state === 'open' &&
    element.getClientRects().length > 0
  ) {
    hide()
    return
  }
  show(event)
}

function updateOpen(value: boolean) {
  if (!value) window.clearTimeout(showTimer.value)
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
        ref="content"
        v-bind="$attrs"
        :class="
          cn(
            menuContentClass,
            'max-h-(--reka-dropdown-menu-content-available-height)',
            $attrs.class
          )
        "
        :style="contentStyle"
        :side-offset="2"
        align="start"
        @close-auto-focus.prevent
      >
        <MenuItems :items="model" @select="hide">
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
