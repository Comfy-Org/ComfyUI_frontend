<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { DropdownMenuContentProps } from 'reka-ui'
import { useEventListener } from '@vueuse/core'
import { nextTick, ref, useId, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import MenuItems from './MenuItems.vue'
import { getMenuAnchorPosition } from './menuAnchor'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const {
  id: providedId,
  model,
  reference
} = defineProps<{
  id?: string
  model: MenuItem[]
  reference?: DropdownMenuContentProps['reference']
}>()
const emit = defineEmits<{ show: []; hide: [] }>()

const trigger = useTemplateRef<HTMLElement>('trigger')
const visible = ref(false)
const generatedId = useId()
const ownerId = `context-menu-${generatedId}`
const anchor = ref<EventTarget | null>(null)
const anchorPointerDownWhileOpen = ref(false)
const anchorPosition = ref({ x: 0, y: 0 })
const showRequest = ref(0)
const contentStyle = useModalLiftedZIndex(visible)

function setOpen(value: boolean) {
  if (visible.value === value) return
  visible.value = value
  void nextTick(() => {
    if (value) emit('show')
    else emit('hide')
  })
}

function show(event: Event) {
  if (event.type === 'contextmenu') event.preventDefault()
  anchor.value = event.currentTarget ?? event.target
  anchorPosition.value = getMenuAnchorPosition(event)
  if (!visible.value) {
    setOpen(true)
    return
  }
  setOpen(false)
  const request = ++showRequest.value
  void nextTick(() => {
    if (request === showRequest.value) setOpen(true)
  })
}

function hide() {
  showRequest.value++
  setOpen(false)
}

useEventListener(
  document,
  'pointerdown',
  (event) => {
    const target = event.target
    anchorPointerDownWhileOpen.value =
      visible.value &&
      target instanceof Node &&
      anchor.value instanceof Node &&
      anchor.value.contains(target)
    if (anchorPointerDownWhileOpen.value) return
    if (
      !visible.value ||
      !(target instanceof Element) ||
      trigger.value?.contains(target) ||
      target.closest('[data-menu-owner]')?.getAttribute('data-menu-owner') ===
        ownerId
    )
      return
    hide()
  },
  { capture: true }
)

function toggle(event: Event) {
  if (
    visible.value ||
    (event instanceof MouseEvent &&
      event.detail > 0 &&
      anchorPointerDownWhileOpen.value)
  ) {
    anchorPointerDownWhileOpen.value = false
    hide()
    return
  }
  show(event)
}

function updateOpen(value: boolean) {
  setOpen(value)
}

defineExpose({ hide, show, toggle, visible })
</script>

<template>
  <DropdownMenuRoot :open="visible" :modal="false" @update:open="updateOpen">
    <DropdownMenuTrigger as-child>
      <button
        ref="trigger"
        :data-menu-owner="ownerId"
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none fixed size-px opacity-0"
        :style="{ left: `${anchorPosition.x}px`, top: `${anchorPosition.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :id="providedId ?? generatedId"
        :reference
        :data-menu-owner="ownerId"
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
        update-position-strategy="always"
        @close-auto-focus.prevent
        @focus-outside.prevent
      >
        <MenuItems :items="model" :owner-id @select="hide">
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
