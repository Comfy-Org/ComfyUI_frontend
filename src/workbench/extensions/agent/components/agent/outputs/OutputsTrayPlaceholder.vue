<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

import { OUTPUTS_TRAY_GRID_CLASS } from './outputsTrayGrid'

defineProps<{ loading: boolean }>()
const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()

const SKELETON_COUNT = 9
</script>

<template>
  <div v-if="loading" :class="OUTPUTS_TRAY_GRID_CLASS">
    <Skeleton
      v-for="index in SKELETON_COUNT"
      :key="index"
      data-testid="agent-outputs-skeleton"
      class="aspect-square rounded-lg bg-accent"
    />
    <span role="status" class="sr-only">
      {{ t('agent.outputs.loading') }}
    </span>
  </div>
  <div v-else class="flex flex-col items-center gap-2 px-4 py-6 text-center">
    <p class="m-0 text-sm text-foreground">
      {{ t('agent.outputs.emptyTitle') }}
    </p>
    <p class="m-0 text-xs text-muted-foreground">
      {{ t('agent.outputs.emptyBody') }}
    </p>
    <Button type="button" variant="outline" size="md" @click="emit('refresh')">
      {{ t('agent.outputs.refresh') }}
    </Button>
  </div>
</template>
