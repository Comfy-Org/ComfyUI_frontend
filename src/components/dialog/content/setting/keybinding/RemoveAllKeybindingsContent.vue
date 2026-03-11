<template>
  <div
    class="flex w-full max-w-[420px] flex-col border-t border-border-default"
  >
    <div class="flex flex-col gap-4 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('g.removeAllKeybindingsMessage') }}
      </p>
      <div class="flex justify-end gap-2">
        <Button
          variant="textonly"
          class="text-muted-foreground"
          @click="onResult(false)"
        >
          {{ $t('g.close') }}
        </Button>
        <Button variant="secondary" @click="onResult(true)">
          {{ $t('g.removeAll') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { onResult } = defineProps<{
  onResult: (result: boolean) => void
}>()
</script>
