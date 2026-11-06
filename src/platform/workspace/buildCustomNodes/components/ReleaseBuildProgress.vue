<template>
  <BuildDialogStep
    :title="
      version === null
        ? $t('buildCustomNodes.building.titleStarting')
        : $t('buildCustomNodes.building.title', { version })
    "
    :description="
      $t(
        'buildCustomNodes.building.body',
        { count: session.picks.length, build: session.build.build.name },
        session.picks.length
      )
    "
  >
    <div class="flex flex-col gap-2 text-sm">
      <div class="flex justify-between gap-3">
        <span class="font-medium">
          {{ $t(`buildCustomNodes.building.step.${step.key}`) }}
        </span>
        <span
          v-if="elapsedMinutes !== null"
          class="text-muted-foreground tabular-nums"
        >
          {{ $t('buildCustomNodes.building.elapsed', elapsedMinutes) }}
        </span>
      </div>
      <div
        role="progressbar"
        :aria-label="$t('buildCustomNodes.building.progressLabel')"
        aria-valuemin="0"
        :aria-valuemax="RELEASE_BUILD_STEP_COUNT"
        :aria-valuenow="step.number"
        :aria-valuetext="stepText"
        class="h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div
          class="h-full rounded-full bg-foreground transition-[width]"
          :style="{ width: `${barPercent}%` }"
        />
      </div>
      <span class="text-muted-foreground">{{ stepText }}</span>
    </div>
    <ReleaseBuildLog :progress />
    <p class="m-0 text-sm text-muted-foreground">
      {{
        $t('buildCustomNodes.building.note', {
          deployment: session.deploymentName
        })
      }}
    </p>
    <template #actions>
      <Button variant="secondary" size="lg" @click="emit('close')">
        {{ $t('g.close') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import ReleaseBuildLog from '@/platform/workspace/buildCustomNodes/components/ReleaseBuildLog.vue'
import {
  RELEASE_BUILD_STEP_COUNT,
  releaseBuildStep
} from '@/platform/workspace/buildCustomNodes/releaseBuildStep'

const ELAPSED_TICK_MS = 15_000
const MINUTE_MS = 60_000

const { session, version, progress, startedAt } = defineProps<{
  session: BuildSession
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
const stepText = computed(() =>
  step.value.number === 0
    ? t('buildCustomNodes.building.step.queued')
    : t('buildCustomNodes.building.stepOf', {
        step: step.value.number,
        count: RELEASE_BUILD_STEP_COUNT
      })
)
const barPercent = computed(() =>
  Math.max(4, ((step.value.number - 0.5) / RELEASE_BUILD_STEP_COUNT) * 100)
)
const elapsedMinutes = computed(() =>
  startedAt === null
    ? null
    : Math.floor((now.value.getTime() - startedAt) / MINUTE_MS)
)
</script>
