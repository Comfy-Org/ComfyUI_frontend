<!-- A button that shows current authenticated user's avatar -->
<template>
  <div>
    <Button
      v-if="isLoggedIn"
      class="user-profile-button p-1"
      severity="secondary"
      text
      aria-label="user profile"
      @click="popover?.toggle($event)"
    >
      <div
        class="flex items-center rounded-full bg-[var(--p-content-background)]"
      >
        <UserAvatar :photo-url="photoURL" />

        <i class="pi pi-chevron-down px-1" :style="{ fontSize: '0.5rem' }" />
      </div>
    </Button>

    <Popover ref="popover" :show-arrow="false">
      <CurrentUserPopover @close="closePopover" />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import CurrentUserPopover from './CurrentUserPopover.vue'

const { isLoggedIn, userPhotoUrl } = useCurrentUser()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const photoURL = computed<string | undefined>(
  () => userPhotoUrl.value ?? undefined
)

const closePopover = () => {
  popover.value?.hide()
}
</script>
