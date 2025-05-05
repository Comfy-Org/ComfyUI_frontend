<template>
  <Avatar
    :image="photoUrl"
    :icon="hasAvatar ? undefined : 'pi pi-user'"
    shape="circle"
    :aria-label="ariaLabel ?? $t('auth.login.userAvatar')"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
import Avatar from 'primevue/avatar'
import { computed, ref } from 'vue'

const { photoUrl, ariaLabel } = defineProps<{
  photoUrl?: string
  ariaLabel?: string
}>()

const imageError = ref(false)
const handleImageError = () => {
  imageError.value = true
}
const hasAvatar = computed(() => photoUrl && !imageError.value)
</script>
