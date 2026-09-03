<template>
  <span
    :class="
      cn(
        'inline-flex aspect-square items-center justify-center overflow-hidden rounded-full bg-interface-panel-selected-surface',
        size === 'small' ? 'size-6' : size === 'large' ? 'size-12' : 'size-8'
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
    <span
      v-else
      :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
      class="flex size-full items-center justify-center"
    >
      <span v-if="initials" class="font-medium uppercase">{{ initials }}</span>
      <i v-else data-testid="avatar-icon" class="icon-[lucide--user] size-4" />
    </span>
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

const {
  photoUrl,
  ariaLabel,
  initials,
  size = 'normal'
} = defineProps<{
  photoUrl?: string | null
  ariaLabel?: string
  initials?: string
  size?: 'small' | 'normal' | 'large'
}>()

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}
const hasAvatar = computed(() => photoUrl && !imageError.value)
</script>
