<template>
  <Avatar
    class="bg-interface-panel-selected-surface"
    :image="photoUrl ?? undefined"
    :icon="hasAvatar ? undefined : 'icon-[lucide--user]'"
    :pt:icon:class="{ 'size-4': !hasAvatar }"
    shape="circle"
    :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
  />
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import Avatar from 'primevue/avatar'
import { computed } from 'vue'

const { photoUrl, ariaLabel } = defineProps<{
  photoUrl?: string | null
  ariaLabel?: string
}>()

const { error: imageError } = useImage({
  src: photoUrl ?? '',
  alt: ariaLabel ?? ''
})
const hasAvatar = computed(() => photoUrl && !imageError.value)
</script>
