<template>
  <Badge
    v-tooltip.top.pt:pointer-events-none="tooltip"
    :label="firstName"
    severity="secondary"
    variant="label"
    class="h-4 px-1.5 text-2xs/none"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@/components/common/Badge.vue'

import type { AssetOwner } from '../composables/assetOwnerMock'

const OWNER_NAME_MAX_LENGTH = 12

const { owner } = defineProps<{
  owner: AssetOwner
}>()

const { t } = useI18n()

const tooltip = computed(() =>
  t('mediaAsset.sharedByWorkspace', { name: owner.name })
)

const firstName = computed(() => {
  const first = owner.name.trim().split(/\s+/)[0] ?? ''
  return first.length > OWNER_NAME_MAX_LENGTH
    ? `${first.slice(0, OWNER_NAME_MAX_LENGTH)}…`
    : first
})
</script>
