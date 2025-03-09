<template>
  <div class="flex flex-col items-center mb-6">
    <slot name="thumbnail">
      <PackIcon :node-pack="nodePack" width="24" height="24" />
    </slot>
    <h2
      class="text-2xl font-bold text-center mt-4 mb-2"
      style="word-break: break-all"
    >
      <slot name="title">{{ nodePack?.name }}</slot>
    </h2>
    <div class="mt-2 mb-4 w-full max-w-xs flex justify-center">
      <slot name="install-button">
        <PackInstallButton
          :full-width="installButtonFullWidth"
          :multi="multi"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import PackInstallButton from '@/components/dialog/content/manager/PackInstallButton.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { components } from '@/types/comfyRegistryTypes'

defineProps<{
  nodePack?: components['schemas']['Node']
  multi?: boolean
  installButtonFullWidth?: boolean
}>()
</script>
