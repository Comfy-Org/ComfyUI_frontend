<template>
  <form
    class="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-background"
    @submit.prevent
  >
    <header
      v-if="showCloseButton"
      class="flex h-16 items-center justify-between px-6"
    >
      <h2 class="text-base font-normal text-base-foreground">
        {{ $t('comfyHubProfile.createProfileTitle') }}
      </h2>
      <Button size="icon" :aria-label="$t('g.close')" @click="onClose">
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>
    <h2 v-else class="px-6 pt-6 text-base font-normal text-base-foreground">
      {{ $t('comfyHubProfile.createProfileTitle') }}
    </h2>

    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
      <div class="flex flex-col gap-4">
        <label for="profile-picture" class="text-sm text-muted-foreground">
          {{ $t('comfyHubProfile.chooseProfilePicture') }}
        </label>
        <label
          class="flex size-13 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-linear-to-b from-green-600/50 to-green-900"
        >
          <input
            id="profile-picture"
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
          <div class="relative">
            <span
              :class="
                cn(
                  'pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm',
                  username ? 'text-base-foreground' : 'text-muted-foreground'
                )
              "
            >
              @
            </span>
            <Input id="profile-username" v-model="username" class="pl-7" />
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
            class="h-24 resize-none rounded-lg border-none bg-secondary-background p-4 text-sm shadow-none"
          />
        </div>
      </div>
    </div>

    <footer
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
    </footer>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useObjectUrl } from '@vueuse/core'

import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import {
  isFileTooLarge,
  MAX_IMAGE_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'
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
const profilePictureFile = ref<File | null>(null)
const profilePreviewUrl = useObjectUrl(profilePictureFile)
const isCreating = ref(false)

const profileInitial = computed(() => {
  const source = name.value.trim() || username.value.trim()
  return source ? source[0].toUpperCase() : 'C'
})

function handleProfileSelect(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  if (!file || isFileTooLarge(file, MAX_IMAGE_SIZE_MB)) return
  profilePictureFile.value = file
}

async function handleCreate() {
  if (isCreating.value) return
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
      detail: error instanceof Error ? error.message : t('g.error')
    })
  } finally {
    isCreating.value = false
  }
}
</script>
