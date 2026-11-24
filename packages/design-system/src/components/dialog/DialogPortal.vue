<script setup lang="ts">
import type { DialogPortalProps } from 'reka-ui'
import {
  ConfigProvider,
  DialogPortal,
  injectConfigProviderContext,
  injectDialogRootContext
} from 'reka-ui'
import { reactive, ref, useTemplateRef, watch } from 'vue'

const props = defineProps<DialogPortalProps>()
const { open, unmountOnHide, triggerElement } = injectDialogRootContext()
const config = reactive(injectConfigProviderContext(null) ?? {})
const portalTarget = useTemplateRef<HTMLDivElement>('portalTarget')
const openCount = ref(0)
watch(open, (isOpen) => {
  if (!isOpen) return
  if (unmountOnHide.value) {
    openCount.value++
    return
  }
  const opener = document.activeElement
  if (opener instanceof HTMLElement && opener !== document.body)
    triggerElement.value = opener
})
</script>

<template>
  <DialogPortal :key="openCount" v-bind="props">
    <div
      ref="portalTarget"
      data-slot="dialog-portal"
      class="pointer-events-none fixed inset-0 z-overlay *:pointer-events-auto empty:hidden"
    >
      <ConfigProvider
        v-if="portalTarget"
        v-bind="config"
        :teleport-to="portalTarget"
      >
        <slot />
      </ConfigProvider>
    </div>
  </DialogPortal>
</template>
