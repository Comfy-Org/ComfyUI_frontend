<template>
  <Avatar
    class="bg-interface-panel-selected-surface"
    :image="photoUrl ?? undefined"
    :label="!hasAvatar && fallback ? fallback : undefined"
    :icon="!hasAvatar && !fallback ? 'icon-[lucide--user]' : undefined"
    :pt:icon:class="{ 'size-4': !hasAvatar && !fallback }"
    shape="circle"
    :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
import Avatar from 'primevue/avatar'
import { computed, ref } from 'vue'

const { photoUrl, ariaLabel, fallback } = defineProps<{
  photoUrl?: string | null
  ariaLabel?: string
  fallback?: string
}>()

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}
const hasAvatar = computed(() => photoUrl && !imageError.value)
</script>
