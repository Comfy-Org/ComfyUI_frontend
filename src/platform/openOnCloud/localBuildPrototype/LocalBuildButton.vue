<template>
  <Button
    variant="secondary"
    size="icon"
    :tooltip="$t('localBuildPrototype.buttonLabel')"
    tooltip-side="bottom"
    :aria-label="$t('localBuildPrototype.buttonLabel')"
    :aria-busy="isBusy || undefined"
    data-testid="local-build-button"
    @click="store.openDialog()"
  >
    <Transition
      mode="out-in"
      enter-from-class="scale-50 opacity-0"
      leave-to-class="scale-50 opacity-0"
      enter-active-class="transition duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
    >
      <i
        v-if="isBusy"
        key="busy"
        class="icon-[lucide--loader-circle] animate-spin"
        aria-hidden="true"
      />
      <i
        v-else-if="store.phase === 'failed'"
        key="failed"
        class="icon-[lucide--circle-alert] text-destructive"
        aria-hidden="true"
      />
      <i v-else key="idle" class="icon-[lucide--cloud]" aria-hidden="true" />
    </Transition>
  </Button>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import {
  LOCAL_BUILD_DIALOG_KEY,
  useLocalBuildPrototypeStore
} from '@/platform/openOnCloud/localBuildPrototype/localBuildPrototypeStore'
import { openCardDialog } from '@/platform/workspace/openCustomDeploymentDialog'

const store = useLocalBuildPrototypeStore()
const isBusy = computed(() => store.isRunning || store.phase === 'fixing')

watch(
  () => store.dialogRequests,
  () =>
    void openCardDialog(
      LOCAL_BUILD_DIALOG_KEY,
      () =>
        import('@/platform/openOnCloud/localBuildPrototype/LocalBuildDialog.vue'),
      {}
    )
)
</script>
