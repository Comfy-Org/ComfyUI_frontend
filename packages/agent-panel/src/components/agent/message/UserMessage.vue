<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Avatar from '@/components/ui/Avatar.vue'

const { text, name, avatarSrc } = defineProps<{
  text: string
  name?: string
  avatarSrc?: string
}>()

const { t } = useI18n()

const initials = computed(() =>
  (name ?? t('agent.you'))
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
)
</script>

<template>
  <div class="flex items-start justify-end gap-2">
    <div
      class="rounded-agent bg-agent-pill text-agent-fg max-w-sm px-3 py-2 text-sm whitespace-pre-wrap"
    >
      {{ text }}
    </div>
    <Avatar :src="avatarSrc" :alt="name" :fallback="initials" class="mt-0.5" />
  </div>
</template>
