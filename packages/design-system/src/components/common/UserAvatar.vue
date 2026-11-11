<template>
  <span
    :class="
      cn(
        'inline-flex aspect-square items-center justify-center overflow-hidden rounded-full bg-muted',
        size === 'large' ? 'size-12' : 'size-8'
      )
    "
  >
    <img
      v-if="hasAvatar"
      :src="photoUrl ?? undefined"
      :alt="label"
      :aria-label="label"
      class="size-full object-cover"
      @error="handleImageError"
    />
    <span
      v-else-if="initials"
      role="img"
      :aria-label="label"
      :class="
        cn(
          'leading-none font-semibold text-foreground select-none',
          size === 'large' ? 'text-base' : 'text-xs'
        )
      "
    >
      <span aria-hidden="true">{{ initials }}</span>
    </span>
    <i
      v-else
      data-testid="avatar-icon"
      :aria-label="label"
      :class="cn('icon-[lucide--user]', iconClass)"
    />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, watch } from 'vue'

const {
  photoUrl,
  label,
  initials,
  iconClass = 'size-4',
  size = 'normal'
} = defineProps<{
  photoUrl?: string | null
  label: string
  initials?: string
  iconClass?: string
  size?: 'normal' | 'large'
}>()

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}
const hasAvatar = computed(() => photoUrl && !imageError.value)

watch(
  () => photoUrl,
  () => {
    imageError.value = false
  }
)
</script>
