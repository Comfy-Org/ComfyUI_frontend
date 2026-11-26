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
    <Spinner v-if="isBusy" class="size-4 text-foreground" />
    <i
      v-else-if="store.phase === 'failed'"
      class="icon-[lucide--circle-alert] text-destructive"
      aria-hidden="true"
    />
    <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Spinner from '@comfyorg/design-system/spinner/Spinner'
import { useLocalBuildPrototypeStore } from '@/platform/openOnCloud/localBuildPrototype/localBuildPrototypeStore'

const store = useLocalBuildPrototypeStore()
const isBusy = computed(() => store.isRunning || store.phase === 'fixing')
</script>
