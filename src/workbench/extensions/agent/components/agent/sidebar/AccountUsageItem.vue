<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

const { creditBalance, loading } = defineProps<{
  creditBalance?: string
  loading: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()
</script>

<template>
  <MenuItem @select="emit('select')">
    <i aria-hidden="true" class="icon-[lucide--chart-column]" />
    <span class="min-w-0 flex-1 truncate">
      {{ t('agent.account.usage') }}
    </span>
    <Skeleton
      v-if="loading"
      data-testid="agent-account-balance-loading"
      class="h-4 w-10 shrink-0 bg-accent"
    />
    <template v-else-if="creditBalance !== undefined">
      <span aria-hidden="true" class="shrink-0 text-xs text-muted-foreground">
        {{ creditBalance }}
      </span>
      <span class="sr-only">
        {{ t('agent.account.creditBalance', { credits: creditBalance }) }}
      </span>
    </template>
  </MenuItem>
</template>
