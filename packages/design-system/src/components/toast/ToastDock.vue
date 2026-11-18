<script setup lang="ts">
import { ConfigProvider, injectConfigProviderContext } from 'reka-ui'
import { reactive, useTemplateRef } from 'vue'

const config = reactive(injectConfigProviderContext(null) ?? {})
const portalTarget = useTemplateRef<HTMLDivElement>('portalTarget')
</script>

<template>
  <div data-toast-dock class="pointer-events-none fixed inset-0 z-toast">
    <div ref="portalTarget" class="contents *:pointer-events-auto" />
    <ConfigProvider
      v-if="portalTarget"
      v-bind="config"
      :teleport-to="portalTarget"
    >
      <div
        class="pointer-events-none fixed inset-x-4 bottom-6 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto *:pointer-events-auto *:shrink-0 sm:inset-x-0"
      >
        <slot />
      </div>
    </ConfigProvider>
  </div>
</template>
