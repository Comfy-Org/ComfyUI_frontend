<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-background">
    <div
      v-if="showCloseButton"
      class="flex h-16 items-center justify-between px-6"
    >
      <h2 class="text-base font-normal text-base-foreground">
        {{ $t('comfyHubProfile.createProfileTitle') }}
      </h2>
      <Button
        size="lg"
        class="w-10 p-0"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times" />
      </Button>
    </div>
    <h2 v-else class="px-6 pt-6 text-base font-normal text-base-foreground">
      {{ $t('comfyHubProfile.createProfileTitle') }}
    </h2>

    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
      <div class="flex flex-col gap-4">
        <span class="text-sm text-muted-foreground">
          {{ $t('comfyHubProfile.chooseProfilePicture') }}
        </span>
        <label
          class="flex size-[51px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[rgba(40,200,64,0.53)] to-[#00630f]"
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
              :alt="$t('comfyHubProfile.chooseProfilePicture')"
              class="size-full rounded-full object-cover"
            />
          </template>
          <template v-else>
            <span class="text-base text-white">
              {{ profileInitial }}
            </span>
          </template>
        </label>
      </div>

      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-4">
          <label for="profile-name" class="text-sm text-muted-foreground">
            {{ $t('comfyHubProfile.nameLabel') }}
          </label>
          <Input
            id="profile-name"
            v-model="name"
            :placeholder="$t('comfyHubProfile.namePlaceholder')"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="profile-username" class="text-sm text-muted-foreground">
            {{ $t('comfyHubProfile.usernameLabel') }}
          </label>
          <div
            class="flex h-10 items-center rounded-lg bg-secondary-background px-4 text-sm"
          >
            <span
              :class="
                username ? 'text-base-foreground' : 'text-muted-foreground'
              "
            >
              @
            </span>
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
            class="text-sm text-muted-foreground"
          >
            {{ $t('comfyHubProfile.descriptionLabel') }}
          </label>
          <Textarea
            id="profile-description"
            v-model="description"
            :placeholder="$t('comfyHubProfile.descriptionPlaceholder')"
            class="h-[98px] resize-none rounded-lg border-none bg-secondary-background px-4 py-4 text-sm shadow-none"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm text-muted-foreground">
            {{ $t('comfyHubProfile.socialLinksLabel') }}
          </label>
          <div class="flex flex-col gap-2">
            <Input
              v-for="(_, index) in socialLinks"
              :key="index"
              v-model="socialLinks[index]"
              :placeholder="$t('comfyHubProfile.socialLinkPlaceholder')"
            />
          </div>
          <Button
            size="sm"
            class="mt-2 h-8 w-fit gap-1 rounded-lg bg-secondary-background px-3 text-xs text-base-foreground hover:bg-secondary-background-selected"
            @click="addSocialLink"
          >
            <i class="icon-[lucide--plus] size-3" />
            {{ $t('comfyHubProfile.addAnotherLink') }}
          </Button>
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-end gap-4 border-t border-border-default px-6 py-4"
    >
      <Button size="lg" @click="onClose">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="lg"
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
import { computed, onBeforeUnmount, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import type { ComfyHubProfile } from '@/schemas/apiSchema'

const {
  onProfileCreated,
  onClose,
  showCloseButton = true
} = defineProps<{
  onProfileCreated: (profile: ComfyHubProfile) => void
  onClose: () => void
  showCloseButton?: boolean
}>()

const { createProfile } = useComfyHubProfileGate()
const toast = useToast()
const { t } = useI18n()

const name = ref('')
const username = ref('')
const description = ref('')
const socialLinks = ref<string[]>([''])
const profilePictureFile = ref<File | null>(null)
const profilePreviewUrl = ref<string | null>(null)
const isCreating = ref(false)

const profileInitial = computed(() => {
  const source = name.value.trim() || username.value.trim()
  return source ? source[0].toUpperCase() : 'C'
})

function setProfilePreview(file: File) {
  if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
  profilePictureFile.value = file
  profilePreviewUrl.value = URL.createObjectURL(file)
}

function handleProfileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) setProfilePreview(file)
}

function addSocialLink() {
  socialLinks.value = [...socialLinks.value, '']
}

async function handleCreate() {
  isCreating.value = true
  try {
    const profile = await createProfile({
      username: username.value.trim(),
      name: name.value.trim() || undefined,
      description: description.value.trim() || undefined,
      profilePicture: profilePictureFile.value ?? undefined
    })
    onProfileCreated(profile)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: error instanceof Error ? error.message : t('g.error'),
      life: 5000
    })
  } finally {
    isCreating.value = false
  }
}

onBeforeUnmount(() => {
  if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
})
</script>
