<template>
  <div
    class="flex w-full max-w-[420px] flex-col border-t border-border-default"
  >
    <div class="flex flex-col gap-4 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('g.keybindingPresets.unsavedChangesMessage') }}
      </p>
      <div class="flex justify-end gap-2">
        <Button
          variant="textonly"
          class="text-muted-foreground"
          @click="onResult(null)"
        >
          {{ $t('g.cancel') }}
        </Button>
        <Button
          variant="secondary"
          class="bg-secondary-background"
          @click="onResult(false)"
        >
          {{ $t('g.keybindingPresets.discardAndSwitch') }}
        </Button>
        <Button
          variant="secondary"
          class="bg-base-foreground text-base-background"
          @click="onResult(true)"
        >
          {{ $t('g.keybindingPresets.saveAndSwitch') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { onResult } = defineProps<{
  onResult: (result: boolean | null) => void
}>()
</script>
