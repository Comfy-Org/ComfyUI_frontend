<template>
  <div class="flex w-full flex-col overflow-hidden bg-base-background">
    <!-- Hero image with gradient fade -->
    <div class="relative h-[229px] shrink-0 overflow-hidden rounded-t-xl">
      <img
        src="/assets/images/comfyhub/hub_profile_intro_hero.png"
        alt=""
        class="h-full w-3/2 object-cover -translate-x-1/4"
      />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent from-[53%] to-base-background to-[76%]"
      />
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
    </div>

    <!-- Content -->
    <div class="flex flex-col items-center gap-4 px-4 pb-6">
      <h2 class="m-0 text-base font-semibold text-base-foreground">
        {{ $t('comfyHubProfile.introTitle') }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ $t('comfyHubProfile.introDescription') }}
      </p>
      <Button
        variant="primary"
        size="lg"
        class="mt-2 w-full"
        @click="onCreateProfile"
      >
        {{ $t('comfyHubProfile.startPublishingButton') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const {
  onCreateProfile,
  onClose,
  showCloseButton = true
} = defineProps<{
  onCreateProfile: () => void
  onClose: () => void
  showCloseButton?: boolean
}>()
</script>
