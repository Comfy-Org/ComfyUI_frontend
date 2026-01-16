<!-- A button that shows current workspace's profile picture -->
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
            compact && 'size-full aspect-square'
          )
        "
      >
        <WorkspaceProfilePic
          :workspace-name="workspaceName"
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
          class: 'rounded-lg'
        }
      }"
    >
      <CurrentUserPopover @close="closePopover" />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { cn } from '@/utils/tailwindUtil'

import CurrentUserPopover from './CurrentUserPopover.vue'

const { showArrow = true, compact = false } = defineProps<{
  showArrow?: boolean
  compact?: boolean
}>()

const { isLoggedIn } = useCurrentUser()
const { workspaceName } = useWorkspace()

const popover = ref<InstanceType<typeof Popover> | null>(null)

const closePopover = () => {
  popover.value?.hide()
}
</script>
