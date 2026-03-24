<template>
  <span
    class="rounded-full bg-base-foreground px-1 py-0.5 text-[10px] font-bold text-base-background uppercase"
  >
    {{ roleBadgeLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { role } = defineProps<{
  role: 'owner' | 'member'
}>()

const { t } = useI18n()

const roleBadgeLabel = computed(() =>
  role === 'owner'
    ? t('workspaceSwitcher.roleOwner')
    : t('workspaceSwitcher.roleMember')
)
</script>
