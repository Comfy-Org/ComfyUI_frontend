<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  ContextMenuContent,
  ContextMenuItem,
  injectContextMenuRootContext,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import { defineComponent } from 'vue'

defineOptions({
  inheritAttrs: false
})

const {
  contentClass,
  collisionPadding = 8,
  closeOnScroll = false
} = defineProps<{
  contentClass?: string
  collisionPadding?: number
  closeOnScroll?: boolean
}>()

const ContextMenuContentProvider = defineComponent({
  name: 'ContextMenuContentProvider',
  props: {
    closeOnScroll: {
      type: Boolean,
      default: false
    }
  },
  setup(providerProps, { slots }) {
    const rootContext = injectContextMenuRootContext()

    function closeMenu() {
      rootContext.onOpenChange(false)
    }

    useEventListener(
      window,
      'scroll',
      () => {
        if (providerProps.closeOnScroll) {
          closeMenu()
        }
      },
      { capture: true, passive: true }
    )

    return () =>
      slots.default?.({
        close: closeMenu,
        itemComponent: ContextMenuItem,
        separatorComponent: ContextMenuSeparator
      })
  }
})
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :collision-padding="collisionPadding"
        v-bind="$attrs"
        :class="contentClass"
      >
        <ContextMenuContentProvider :close-on-scroll="closeOnScroll">
          <template #default="{ close, itemComponent, separatorComponent }">
            <slot
              name="content"
              :close="close"
              :item-component="itemComponent"
              :separator-component="separatorComponent"
            />
          </template>
        </ContextMenuContentProvider>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
