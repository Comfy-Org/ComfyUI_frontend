<!-- A button that shows current authenticated user's avatar -->
<template>
  <div>
    <Button
      v-if="isAuthenticated"
      v-tooltip="{ value: $t('userSettings.title'), showDelay: 300 }"
      class="user-profile-button p-1"
      severity="secondary"
      text
      :aria-label="$t('userSettings.title')"
    >
      <div
        class="flex items-center rounded-full bg-[var(--p-content-background)]"
      >
        <Avatar
          :image="photoURL"
          :icon="photoURL ? undefined : 'pi pi-user'"
          shape="circle"
          aria-label="User Avatar"
        />

        <i class="pi pi-chevron-down px-1" :style="{ fontSize: '0.5rem' }" />
      </div>
    </Button>

    <Popover ref="popover" :show-arrow="false">
      <CurrentUserPopover />
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

import CurrentUserPopover from './CurrentUserPopover.vue'

const authStore = useFirebaseAuthStore()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const photoURL = computed<string | undefined>(
  () => authStore.currentUser?.photoURL ?? undefined
)
</script>
