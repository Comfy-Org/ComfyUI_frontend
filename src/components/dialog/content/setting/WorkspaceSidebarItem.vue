<template>
  <div class="flex items-center gap-2">
    <UserAvatar class="size-6" :photo-url="userPhotoUrl" />

    <span>{{ workspaceName ?? 'Personal' }}</span>
  </div>
</template>

<script setup lang="ts">
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'

const { userPhotoUrl } = useCurrentUser()
const { workspaceName } = useWorkspace()
</script>
