<template>
  <Button
    class="comfy-help-center-btn text-base-foreground"
    variant="textonly"
    @click="toggleHelpCenter"
  >
    {{ $t('menu.helpAndFeedback') }}
    <i class="icon-[lucide--circle-help] ml-1.5" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useHelpCenter } from '@/composables/useHelpCenter'

const { toggleHelpCenter } = useHelpCenter('topbar')
</script>
