<script setup lang="ts">
import type { DialogPortalProps } from 'reka-ui'
import {
  ConfigProvider,
  DialogPortal,
  injectConfigProviderContext,
  injectDialogRootContext
} from 'reka-ui'
import { reactive, useTemplateRef } from 'vue'

const props = defineProps<DialogPortalProps>()
const { open } = injectDialogRootContext()
const config = reactive(injectConfigProviderContext(null) ?? {})
const portalTarget = useTemplateRef<HTMLDivElement>('portalTarget')
</script>

<template>
  <DialogPortal v-if="open || props.forceMount" v-bind="props">
    <div
      ref="portalTarget"
      class="pointer-events-none fixed inset-0 z-overlay *:pointer-events-auto"
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
