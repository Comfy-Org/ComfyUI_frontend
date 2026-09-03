<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import { nextTick, ref, useId, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import MenuItems from './MenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { id: providedId, model } = defineProps<{
  id?: string
  model: MenuItem[]
}>()
const emit = defineEmits<{ show: []; hide: [] }>()

const content = useTemplateRef<ComponentPublicInstance>('content')
const visible = ref(false)
const generatedId = useId()
const anchor = ref({ x: 0, y: 0 })
const showRequest = ref(0)
const contentStyle = useModalLiftedZIndex(visible)

function show(event: Event) {
  const mouseEvent = event instanceof MouseEvent ? event : undefined
  const target = event.currentTarget ?? event.target
  const rect = target instanceof Element ? target.getBoundingClientRect() : null
  anchor.value = {
    x: mouseEvent?.clientX ?? rect?.left ?? 0,
    y: mouseEvent?.clientY ?? rect?.top ?? 0
  }
  visible.value = false
  const request = ++showRequest.value
  void nextTick(() => {
    if (request === showRequest.value) visible.value = true
  })
}

function hide() {
  showRequest.value++
  visible.value = false
}

function toggle(event: Event) {
  const wrapper = content.value?.$el
  const element =
    wrapper instanceof HTMLElement
      ? wrapper.querySelector<HTMLElement>('[data-state="open"]')
      : null
  if (element && element.getClientRects().length > 0) {
    hide()
    return
  }
  show(event)
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
  <DropdownMenuRoot :open="visible" :modal="false" @update:open="updateOpen">
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
        :id="providedId ?? generatedId"
        ref="content"
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
