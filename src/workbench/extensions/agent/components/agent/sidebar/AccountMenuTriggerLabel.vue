<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { workspaceName, firstName, planLabel } = defineProps<{
  workspaceName?: string
  firstName?: string
  planLabel?: string
}>()

const { t } = useI18n()
</script>

<template>
  <span
    v-if="workspaceName !== undefined"
    class="flex min-w-0 flex-1 flex-col text-left"
  >
    <span class="truncate">{{ workspaceName }}</span>
    <span v-if="planLabel" class="truncate text-xs/4 text-muted-foreground">
      {{ planLabel }}
    </span>
  </span>
  <span v-else class="min-w-0 flex-1 truncate text-left">
    <span>{{ firstName ?? t('agent.account.fallbackName') }}</span>
    <span v-if="planLabel" class="text-muted-foreground">
      · {{ planLabel }}
    </span>
  </span>
  <i
    aria-hidden="true"
    class="icon-[lucide--chevron-down] text-muted-foreground"
  />
</template>
