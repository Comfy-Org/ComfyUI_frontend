<template>
  <span
    :class="
      cn(
        'inline-flex aspect-square items-center justify-center overflow-hidden rounded-full bg-interface-panel-selected-surface',
        size === 'large' ? 'size-12' : 'size-8'
      )
    "
  >
    <img
      v-if="hasAvatar"
      :src="photoUrl ?? undefined"
      :alt="ariaLabel ?? $t('auth.login.userAvatar')"
      :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
      class="size-full object-cover"
      @error="handleImageError"
    />
    <i
      v-else
      data-testid="avatar-icon"
      :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
      :class="cn('icon-[lucide--user]', iconClass)"
    />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

const {
  photoUrl,
  ariaLabel,
  iconClass = 'size-4',
  size = 'normal'
} = defineProps<{
  photoUrl?: string | null
  ariaLabel?: string
  iconClass?: string
  size?: 'normal' | 'large'
}>()

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}
const hasAvatar = computed(() => photoUrl && !imageError.value)
</script>
