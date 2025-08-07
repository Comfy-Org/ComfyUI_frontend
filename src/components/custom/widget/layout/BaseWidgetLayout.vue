<template>
  <div class="base-widget-layout rounded-2xl overflow-hidden relative">
    <IconButton class="absolute top-4 right-6" @click="closeDialog">
      <i class="pi pi-times text-sm"></i>
    </IconButton>
    <div class="flex w-full h-full">
      <nav v-if="$slots.leftPanel">
        <slot name="leftPanel"></slot>
      </nav>

      <div class="flex-1 flex bg-neutral-50 dark-theme:bg-neutral-900">
        <div class="flex-1 flex flex-col">
          <header v-if="$slots.header" class="w-full h-16 px-6 py-4">
            <slot name="header"> </slot>
          </header>
          <main class="flex-1">
            <slot name="content"></slot>
          </main>
        </div>

        <!-- <aside v-if="$slots.rightPanel">
          <slot name="rightPanel"></slot>
        </aside> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import { OnCloseKey } from '@/types/custom_components/widgetTypes'

const closeDialog = inject(OnCloseKey, () => {})
</script>
<style scoped>
.base-widget-layout {
  height: 80vh;
  width: 90vw;
  max-width: 1280px;
  aspect-ratio: 20/13;
}

@media (min-width: 1450px) {
  .base-widget-layout {
    max-width: 1724px;
  }
}
</style>
