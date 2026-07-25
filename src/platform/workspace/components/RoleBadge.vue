<template>
  <span
    class="rounded-full bg-base-foreground px-1 py-0.5 text-2xs font-bold text-base-background uppercase"
  >
    {{ roleBadgeLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

const { role } = defineProps<{
  role: WorkspaceRole
}>()

const { t } = useI18n()

const roleBadgeLabel = computed(() => {
  if (role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (role === 'admin') return t('workspaceSwitcher.roleAdmin')
  return t('workspaceSwitcher.roleMember')
})
</script>
