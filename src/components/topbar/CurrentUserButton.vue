<!-- A button that shows workspace icon (Cloud) or user avatar -->
<template>
  <div>
    <Button
      v-if="isLoggedIn"
      class="p-1 hover:bg-transparent"
      variant="muted-textonly"
      :aria-label="$t('g.currentUser')"
      @click="popover?.toggle($event)"
    >
      <div
        :class="
          cn(
            'flex items-center gap-1 rounded-full hover:bg-interface-button-hover-surface justify-center',
            compact && 'size-full '
          )
        "
      >
        <WorkspaceProfilePic
          v-if="showWorkspaceIcon"
          :workspace-name="workspaceName"
          :class="compact && 'size-full'"
        />
        <UserAvatar
          v-else
          :photo-url="photoURL"
          :class="compact && 'size-full'"
        />

        <i v-if="showArrow" class="icon-[lucide--chevron-down] size-3 px-1" />
      </div>
    </Button>

    <Popover
      ref="popover"
      :show-arrow="false"
      :pt="{
        root: {
          class: 'rounded-lg w-80'
        }
      }"
    >
      <!-- Workspace mode: workspace-aware popover -->
      <CurrentUserPopoverWorkspace
        v-if="teamWorkspacesEnabled"
        @close="closePopover"
      />
      <!-- Legacy mode: original popover -->
      <CurrentUserPopover v-else @close="closePopover" />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Popover from 'primevue/popover'
import { computed, defineAsyncComponent, ref } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

import CurrentUserPopover from './CurrentUserPopover.vue'

const CurrentUserPopoverWorkspace = defineAsyncComponent(
  () => import('./CurrentUserPopoverWorkspace.vue')
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

const showWorkspaceIcon = computed(() => isCloud && teamWorkspacesEnabled.value)

const workspaceName = computed(() => {
  if (!showWorkspaceIcon.value) return ''
  const { workspaceName } = storeToRefs(useTeamWorkspaceStore())
  return workspaceName.value
})

const popover = ref<InstanceType<typeof Popover> | null>(null)

const closePopover = () => {
  popover.value?.hide()
}
</script>
