<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'

const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()
</script>

<template>
  <MenuItem @select="emit('select')">
    <i aria-hidden="true" class="icon-[lucide--key-round]" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate">
        {{ t('agent.account.getApiKey') }}
      </span>
      <span class="truncate text-xs/4 text-muted-foreground">
        {{ t('agent.account.getApiKeyHint') }}
      </span>
    </span>
    <i
      aria-hidden="true"
      class="icon-[lucide--external-link] text-muted-foreground"
    />
    <span class="sr-only">
      {{ t('agent.account.opensInNewTab') }}
    </span>
  </MenuItem>
</template>
