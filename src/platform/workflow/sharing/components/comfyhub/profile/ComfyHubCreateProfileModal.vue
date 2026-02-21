<template>
  <div class="w-full bg-base-background">
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <span class="text-sm font-medium text-base-foreground">
        {{ $t('comfyHubProfile.modalTitle') }}
      </span>
      <button
        class="cursor-pointer rounded border-none bg-transparent text-muted-foreground hover:text-base-foreground"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times" />
      </button>
    </div>

    <!-- Image uploads -->
    <div class="relative flex flex-col items-center px-6 pt-4">
      <!-- Cover image -->
      <label
        ref="coverDropRef"
        :class="
          cn(
            'flex h-[130px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
            isOverCoverDrop
              ? 'border-muted-foreground'
              : 'border-border-default hover:border-muted-foreground'
          )
        "
        @dragenter.stop
        @dragleave.stop
        @dragover.prevent.stop
        @drop.prevent.stop
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleCoverSelect"
        />
        <template v-if="coverPreviewUrl">
          <img
            :src="coverPreviewUrl"
            :alt="$t('comfyHubProfile.uploadCover')"
            class="size-full rounded-lg object-cover"
          />
        </template>
        <template v-else>
          <span class="text-sm text-muted-foreground">
            {{ $t('comfyHubProfile.uploadCover') }}
          </span>
        </template>
      </label>

      <!-- Profile picture -->
      <label
        ref="profileDropRef"
        :class="
          cn(
            '-mt-15 z-10 flex size-30 cursor-pointer flex-col items-center justify-center rounded-full border border-dashed bg-base-background transition-colors',
            isOverProfileDrop
              ? 'border-muted-foreground'
              : 'border-border-default hover:border-muted-foreground'
          )
        "
        @dragenter.stop
        @dragleave.stop
        @dragover.prevent.stop
        @drop.prevent.stop
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleProfileSelect"
        />
        <template v-if="profilePreviewUrl">
          <img
            :src="profilePreviewUrl"
            :alt="$t('comfyHubProfile.uploadProfilePicture')"
            class="size-full rounded-full object-cover"
          />
        </template>
        <template v-else>
          <span class="text-center text-xs text-muted-foreground">
            {{ $t('comfyHubProfile.uploadProfilePicture') }}
          </span>
        </template>
      </label>
    </div>

    <!-- Form fields -->
    <div class="flex flex-col gap-4 px-6 py-4">
      <div class="flex flex-col gap-2">
        <label
          for="profile-name"
          class="text-sm font-medium text-base-foreground"
        >
          {{ $t('comfyHubProfile.nameLabel') }}
        </label>
        <Input
          id="profile-name"
          v-model="name"
          :placeholder="$t('comfyHubProfile.namePlaceholder')"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="profile-username"
          class="text-sm font-medium text-base-foreground"
        >
          {{ $t('comfyHubProfile.usernameLabel') }}
        </label>
        <div
          class="flex h-10 items-center rounded-lg bg-secondary-background px-4 text-sm"
        >
          <span
            :class="
              cn(username ? 'text-base-foreground' : 'text-muted-foreground')
            "
            >@</span
          >
          <input
            id="profile-username"
            v-model="username"
            class="h-full w-full min-w-0 appearance-none border-none bg-transparent p-0 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="profile-description"
          class="text-sm font-medium text-base-foreground"
        >
          {{ $t('comfyHubProfile.descriptionLabel') }}
        </label>
        <Textarea
          id="profile-description"
          v-model="description"
          :placeholder="$t('comfyHubProfile.descriptionPlaceholder')"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-end px-6 pb-8">
      <Button
        variant="primary"
        size="lg"
        class="h-10"
        :disabled="!username.trim() || isCreating"
        @click="handleCreate"
      >
        {{
          isCreating
            ? $t('comfyHubProfile.creatingProfile')
            : $t('comfyHubProfile.createProfile')
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useDropZone } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import type { ComfyHubProfile } from '@/schemas/apiSchema'
import { cn } from '@/utils/tailwindUtil'

const { onProfileCreated, onClose } = defineProps<{
  onProfileCreated: (profile: ComfyHubProfile) => void
  onClose: () => void
}>()

const { createProfile } = useComfyHubProfileGate()

const name = ref('')
const username = ref('')
const description = ref('')
const coverImageFile = ref<File | null>(null)
const profilePictureFile = ref<File | null>(null)
const coverPreviewUrl = ref<string | null>(null)
const profilePreviewUrl = ref<string | null>(null)
const isCreating = ref(false)

function isImageType(types: readonly string[]) {
  return types.some((type) => type.startsWith('image/'))
}

function setCoverPreview(file: File) {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value)
  coverImageFile.value = file
  coverPreviewUrl.value = URL.createObjectURL(file)
}

function setProfilePreview(file: File) {
  if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
  profilePictureFile.value = file
  profilePreviewUrl.value = URL.createObjectURL(file)
}

function handleCoverSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) setCoverPreview(file)
}

function handleProfileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) setProfilePreview(file)
}

const coverDropRef = ref<HTMLElement | null>(null)
const profileDropRef = ref<HTMLElement | null>(null)

const { isOverDropZone: isOverCoverDrop } = useDropZone(coverDropRef, {
  dataTypes: isImageType,
  multiple: false,
  onDrop(files) {
    const file = files?.[0]
    if (file) setCoverPreview(file)
  }
})

const { isOverDropZone: isOverProfileDrop } = useDropZone(profileDropRef, {
  dataTypes: isImageType,
  multiple: false,
  onDrop(files) {
    const file = files?.[0]
    if (file) setProfilePreview(file)
  }
})

async function handleCreate() {
  isCreating.value = true
  try {
    const profile = await createProfile({
      username: username.value.trim(),
      name: name.value.trim() || undefined,
      description: description.value.trim() || undefined,
      coverImage: coverImageFile.value ?? undefined,
      profilePicture: profilePictureFile.value ?? undefined
    })
    onProfileCreated(profile)
  } catch {
    // Backend not ready yet — proceed with locally constructed profile
    const localProfile: ComfyHubProfile = {
      username: username.value.trim(),
      name: name.value.trim() || undefined,
      description: description.value.trim() || undefined,
      coverImageUrl: coverPreviewUrl.value,
      profilePictureUrl: profilePreviewUrl.value
    }
    onProfileCreated(localProfile)
  } finally {
    isCreating.value = false
  }
}

onBeforeUnmount(() => {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value)
  if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
})
</script>
