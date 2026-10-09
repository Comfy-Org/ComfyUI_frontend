<script setup lang="ts">
import { useCommunityDialog } from '@/platform/community/composables/useCommunityDialog'

import SidebarIcon from './SidebarIcon.vue'

const { isSmall = false } = defineProps<{ isSmall?: boolean }>()
const community = useCommunityDialog()
</script>

<template>
  <SidebarIcon
    icon="icon-[lucide--users]"
    :tooltip="$t('community.title')"
    :label="$t('community.title')"
    :is-small
    data-testid="community-tab-button"
    @click="community.show()"
  />
</template>
