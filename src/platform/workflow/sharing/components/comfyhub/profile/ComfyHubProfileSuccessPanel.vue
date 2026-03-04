<template>
  <div class="relative w-full bg-base-background">
    <!-- Close button -->
    <Button
      v-if="showCloseButton"
      size="icon"
      class="absolute right-2 top-2 z-10 rounded-full bg-black/30 text-white hover:bg-black/50"
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>

    <!-- Cover image -->
    <figure class="h-[229px] overflow-hidden rounded-t-lg">
      <img
        v-if="profile.coverImageUrl"
        :src="profile.coverImageUrl"
        :alt="profile.username"
        class="size-full object-cover"
      />
      <div
        v-else
        class="size-full bg-gradient-to-br from-blue-500 to-purple-600"
      />
    </figure>

    <!-- Content -->
    <section class="flex flex-col items-center gap-4 px-6 pb-6">
      <!-- Profile picture -->
      <figure
        class="-mt-15 size-30 shrink-0 overflow-hidden rounded-full border-4 border-base-background"
      >
        <img
          v-if="profile.profilePictureUrl"
          :src="profile.profilePictureUrl"
          :alt="profile.username"
          class="size-full object-cover"
        />
        <div v-else class="size-full bg-muted-background" />
      </figure>

      <!-- Title -->
      <h2 class="text-center text-base font-semibold text-base-foreground">
        {{ $t('comfyHubProfile.successTitle', { username: profile.username }) }}
      </h2>

      <!-- Profile URL -->
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-sm text-muted-foreground">
          {{ $t('comfyHubProfile.successProfileUrl') }}
        </span>
        <span class="text-sm text-base-foreground">
          {{
            $t('comfyHubProfile.successProfileLink', {
              username: profile.username
            })
          }}
        </span>
      </div>

      <!-- Description -->
      <p
        class="mx-auto max-w-[270px] text-center text-sm text-muted-foreground"
      >
        {{ $t('comfyHubProfile.successDescription') }}
      </p>

      <!-- Upload button -->
      <Button variant="primary" size="lg" class="w-full" @click="onUpload">
        {{ $t('comfyHubProfile.uploadWorkflowButton') }}
      </Button>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ComfyHubProfile } from '@/schemas/apiSchema'

import Button from '@/components/ui/button/Button.vue'

const {
  profile,
  onUpload,
  onClose,
  showCloseButton = true
} = defineProps<{
  profile: ComfyHubProfile
  onUpload: () => void
  onClose: () => void
  showCloseButton?: boolean
}>()
</script>
