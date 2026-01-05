<!-- A button that shows current authenticated user's avatar -->
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
        class="flex items-center gap-1 rounded-full hover:bg-interface-button-hover-surface"
      >
        <UserAvatar :photo-url="photoURL" />

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
import { computed, ref } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import CurrentUserPopover from './CurrentUserPopover.vue'

const { showArrow = true } = defineProps<{
  showArrow?: boolean
}>()

const { isLoggedIn, userPhotoUrl } = useCurrentUser()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const photoURL = computed<string | undefined>(
  () => userPhotoUrl.value ?? undefined
)

const closePopover = () => {
  popover.value?.hide()
}
</script>
