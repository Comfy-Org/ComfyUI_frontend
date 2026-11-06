<template>
  <BuildDialogStep
    :title="
      version === null
        ? $t('buildCustomNodes.building.titleStarting')
        : $t('buildCustomNodes.building.title', { version })
    "
    :description="$t('buildCustomNodes.building.bodyShort')"
  >
    <div class="flex flex-col gap-2.5 text-sm">
      <div
        role="progressbar"
        :aria-label="$t('buildCustomNodes.building.progressLabel')"
        aria-valuemin="0"
        :aria-valuemax="RELEASE_BUILD_STEP_COUNT"
        :aria-valuenow="step.number"
        :aria-valuetext="stepLabel"
        class="h-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          class="h-full rounded-full bg-foreground transition-[width]"
          :style="{ width: `${barPercent}%` }"
        />
      </div>
      <div class="flex justify-between gap-3">
        <span>{{ stepLabel }}</span>
        <span
          v-if="elapsedMinutes !== null"
          class="text-muted-foreground tabular-nums"
        >
          {{ $t('buildCustomNodes.building.elapsedShort', elapsedMinutes) }}
        </span>
      </div>
    </div>
    <template #actions>
      <Button variant="inverted" size="lg" @click="emit('close')">
        {{ $t('buildCustomNodes.building.keepWorking') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import {
  RELEASE_BUILD_STEP_COUNT,
  releaseBuildStep
} from '@/platform/workspace/buildCustomNodes/releaseBuildStep'

const ELAPSED_TICK_MS = 15_000
const MINUTE_MS = 60_000

const { version, progress, startedAt } = defineProps<{
  version: number | null
  progress: ReleaseBuild | null
  startedAt: number | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const now = useNow({ interval: ELAPSED_TICK_MS })

const step = computed(() => releaseBuildStep(progress))
const stepLabel = computed(() =>
  t(`buildCustomNodes.building.step.${step.value.key}`)
)
const barPercent = computed(() =>
  Math.max(4, ((step.value.number - 0.5) / RELEASE_BUILD_STEP_COUNT) * 100)
)
const elapsedMinutes = computed(() =>
  startedAt === null
    ? null
    : Math.max(0, Math.floor((now.value.getTime() - startedAt) / MINUTE_MS))
)
</script>
