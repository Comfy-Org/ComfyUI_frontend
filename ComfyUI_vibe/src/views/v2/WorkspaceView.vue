<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import WorkspaceLayout from '@/components/v2/layout/WorkspaceLayout.vue'

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string)
</script>

<template>
  <WorkspaceLayout>
    <RouterView :key="route.fullPath" />
  </WorkspaceLayout>
</template>
