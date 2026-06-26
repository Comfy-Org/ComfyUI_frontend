<!-- A button that shows workspace icon (Cloud) or user avatar -->
<template>
  <DropdownMenu v-if="isLoggedIn" v-model:open="isOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        class="p-1 hover:bg-transparent"
        variant="muted-textonly"
        :aria-label="$t('g.currentUser')"
      >
        <div
          :class="
            cn(
              'flex items-center justify-center gap-1 rounded-full hover:bg-interface-button-hover-surface',
              compact && 'size-full'
            )
          "
        >
          <Skeleton
            v-if="showWorkspaceSkeleton"
            shape="circle"
            width="32px"
            height="32px"
          />
          <WorkspaceProfilePic
            v-else-if="showWorkspaceIcon"
            :workspace-name="workspaceName"
            :class="compact && 'size-full'"
          />
          <UserAvatar
            v-else
            :photo-url="photoURL"
            :class="compact && 'h-full w-auto'"
          />

          <i v-if="showArrow" class="icon-[lucide--chevron-down] size-4 px-1" />
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent size="lg" align="end" :side-offset="4" class="w-80">
      <CurrentUserPopoverWorkspace
        v-if="teamWorkspacesEnabled && initState === 'ready'"
        @close="isOpen = false"
      />
      <CurrentUserPopoverLegacy
        v-else-if="!teamWorkspacesEnabled"
        @close="isOpen = false"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Skeleton from 'primevue/skeleton'
import { computed, defineAsyncComponent, ref } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const CurrentUserPopoverWorkspace = defineAsyncComponent(
  () =>
    import('../../platform/workspace/components/CurrentUserPopoverWorkspace.vue')
)

const { showArrow = true, compact = false } = defineProps<{
  showArrow?: boolean
  compact?: boolean
}>()

const { flags } = useFeatureFlags()
const teamWorkspacesEnabled = computed(() => flags.teamWorkspacesEnabled)

const { isLoggedIn, userPhotoUrl } = useCurrentUser()

const photoURL = computed<string | undefined>(
  () => userPhotoUrl.value ?? undefined
)

const {
  workspaceName: teamWorkspaceName,
  initState,
  isInPersonalWorkspace
} = storeToRefs(useTeamWorkspaceStore())

const showWorkspaceSkeleton = computed(
  () => isCloud && teamWorkspacesEnabled.value && initState.value === 'loading'
)
const showWorkspaceIcon = computed(
  () =>
    isCloud &&
    teamWorkspacesEnabled.value &&
    initState.value === 'ready' &&
    !isInPersonalWorkspace.value
)

const workspaceName = computed(() => {
  if (!showWorkspaceIcon.value) return ''
  return teamWorkspaceName.value
})

const isOpen = ref(false)
</script>
