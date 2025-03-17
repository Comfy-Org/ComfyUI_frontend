<template>
  <div class="w-[100%] flex justify-between items-center">
    <div class="flex justify-start items-center">
      <div class="w-1 h-6 rounded-md" />
      <div class="w-6 h-6 relative overflow-hidden">
        <i class="pi pi-box text-xl text-muted" style="opacity: 0.6" />
      </div>
      <div class="px-3 py-2 rounded-md flex justify-start items-start gap-2.5">
        <div class="text-right justify-start text-sm font-bold leading-none">
          {{ $t('manager.nodePack') }}
        </div>
      </div>
    </div>
    <div class="inline-flex justify-start items-center gap-3">
      <div
        v-if="nodePack.downloads"
        class="flex items-center text-sm text-muted tracking-tighter"
      >
        <i class="pi pi-download mr-2" />
        {{ $n(nodePack.downloads) }}
      </div>
      <template v-if="isInstalled">
        <PackEnableToggle :node-pack="nodePack" />
      </template>
      <template v-else>
        <PackInstallButton :node-packs="[nodePack]" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack?.id))
</script>
