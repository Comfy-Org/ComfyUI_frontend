<template>
  <div class="flex flex-col gap-2">
    <Button
      variant="muted-textonly"
      size="md"
      class="w-fit"
      :aria-expanded="open"
      aria-controls="release-build-log"
      @click="toggle"
    >
      <i
        :class="
          cn(
            'icon-[lucide--chevron-right] transition-transform',
            open && 'rotate-90'
          )
        "
        aria-hidden="true"
      />
      {{
        open
          ? $t('buildCustomNodes.building.hideLog')
          : $t('buildCustomNodes.building.showLog')
      }}
    </Button>
    <pre
      v-if="open"
      id="release-build-log"
      tabindex="0"
      :aria-label="$t('buildCustomNodes.building.logLabel')"
      class="m-0 max-h-48 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs/5 whitespace-pre-wrap"
      >{{ log ?? $t('buildCustomNodes.building.logEmpty') }}</pre>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { ref, watch } from 'vue'

import { useBuildCustomNodesStore } from '@/platform/workspace/buildCustomNodes/buildCustomNodesStore'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'

const { progress } = defineProps<{
  progress: ReleaseBuild | null
}>()

const store = useBuildCustomNodesStore()
const open = ref(false)
const log = ref<string | null>(null)

async function refreshLog() {
  log.value = (await store.fetchReleaseLog()) ?? log.value
}

function toggle() {
  open.value = !open.value
  if (open.value) void refreshLog()
}

watch(
  () => progress,
  () => {
    if (open.value) void refreshLog()
  }
)
</script>
