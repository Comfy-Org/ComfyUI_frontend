<script setup lang="ts">
import Badge from '@comfyorg/design-system/badge/Badge'
import { useI18n } from 'vue-i18n'

import BatchNavigation from '@/renderer/extensions/vueNodes/widgets/components/BatchNavigation.vue'

const { count, navigable = true } = defineProps<{
  count: number
  navigable?: boolean
}>()

const index = defineModel<number>({ required: true })

const { t } = useI18n()
</script>

<template>
  <template v-if="count > 0">
    <Badge variant="pill" severity="muted">
      {{ t('superComfy.node.items', { count }, count) }}
    </Badge>
    <BatchNavigation
      v-if="navigable"
      v-model="index"
      :count
      class="text-2xs text-muted-foreground"
      data-no-drag
    />
  </template>
</template>
