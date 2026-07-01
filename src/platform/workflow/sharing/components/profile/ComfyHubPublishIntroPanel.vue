<template>
  <div class="flex w-full flex-col overflow-hidden bg-base-background">
    <!-- Close button -->
    <div v-if="showCloseButton" class="flex justify-end px-2 pt-2">
      <Button
        size="icon"
        class="rounded-full"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>

    <!-- Content -->
    <section class="flex flex-col items-center gap-4 px-4 pt-4 pb-6">
      <h2 class="m-0 text-base font-semibold text-base-foreground">
        {{
          isUpdate
            ? $t('comfyHubProfile.updateIntroTitle')
            : $t('comfyHubProfile.introTitle')
        }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{
          isUpdate
            ? $t('comfyHubProfile.updateIntroDescription')
            : $t('comfyHubProfile.introDescription')
        }}
      </p>
      <Button
        variant="primary"
        size="lg"
        class="mt-2 w-full"
        @click="onCreateProfile"
      >
        {{
          isUpdate
            ? $t('comfyHubProfile.startUpdatingButton')
            : $t('comfyHubProfile.startPublishingButton')
        }}
      </Button>
    </section>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const {
  onCreateProfile,
  onClose,
  showCloseButton = true,
  isUpdate = false
} = defineProps<{
  onCreateProfile: () => void
  onClose: () => void
  showCloseButton?: boolean
  isUpdate?: boolean
}>()
</script>
