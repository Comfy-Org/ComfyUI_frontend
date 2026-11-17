<template>
  <PointLayer :host :config />
</template>

<script setup lang="ts">
import { provide } from 'vue'

import type { PointConfig } from './config'
import { HISTORY_KEEPER } from './historyKeeper'
import type { HistoryKeeper } from './historyKeeper'
import type { PointHost } from './pointHost'
import PointLayer from './PointLayer.vue'

const { host, config, history } = defineProps<{
  host: PointHost
  config: PointConfig
  /** Keeps each workflow's history; the layer's session takes it from here. */
  history: HistoryKeeper
}>()

provide(HISTORY_KEEPER, history)
</script>
