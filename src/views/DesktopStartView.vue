<template>
  <div
    class="font-sans w-screen h-screen mx-0 grid items-center justify-center text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto overflow-y-auto"
  >
    <div
      class="max-w-screen-sm w-screen p-8 relative col-start-1 row-start-1 mx-auto"
    >
      <!-- TODO: Impl. progress updates once added to desktop. -->
      <ProgressBar mode="indeterminate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import router from '@/router'
import { electronAPI } from '@/utils/envUtil'
import { InstallValidation } from '@comfyorg/comfyui-electron-types'
import ProgressBar from 'primevue/progressbar'
import { onMounted, ref } from 'vue'

const progress = ref(0)

function onUpdate(update: InstallValidation) {
  if (Object.values(update).includes('error')) {
    electronAPI().Validation.dispose()
    router.push('maintenance')
  }
}

onMounted(async () => {
  // Validation calls this for each validation step
  electronAPI().Validation.onUpdate(onUpdate)
  // Avoid desync if backend validation complete before frontend ready
  const update = await electronAPI().Validation.getStatus()
  if (update) onUpdate(update)
})
</script>
