<template>
  <div
    class="w-full h-full flex flex-col rounded-lg p-6 bg-[#2d2d2d] justify-between"
  >
    <h1 class="dialog-title font-semibold text-xl m-0 italic">
      {{ dialog.title }}
    </h1>
    <p class="whitespace-pre-wrap">{{ dialog.message }}</p>
    <div class="flex w-full gap-2">
      <Button
        v-for="button in dialog.buttons"
        :key="button.label"
        class="first:mr-auto"
        :label="button.label"
        :severity="button.severity ?? 'secondary'"
        @click="handleButtonClick(button)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { DESKTOP_DIALOGS, type DialogAction } from '@/constants/desktopDialogs'
import { electronAPI } from '@/utils/envUtil'

// Use the const data directly
const dialog = DESKTOP_DIALOGS.reinstallFreshStart

const handleButtonClick = (button: DialogAction) => {
  if (button.action === 'openUrl' && button.url) {
    window.open(button.url, '_blank')
  }
  void electronAPI().Dialog.clickButton(button.returnValue)
}
</script>

<style scoped>
@reference '../assets/css/style.css';

.dialog-title {
  font-family: 'ABC ROM';
}

.p-button {
  @apply rounded-lg;
}

.p-button-secondary {
  @apply text-white rounded-lg border-none;

  background: var(--color-button-background, rgba(255, 255, 255, 0.15));
}

.p-button-secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.p-button-secondary:active {
  background: rgba(255, 255, 255, 0.35);
}

.p-button-danger {
  background: rgba(241, 67, 82, 0.5);
  border: 0;
}

.p-button-danger:hover {
  background: rgba(241, 67, 82, 0.75);
}

.p-button-danger:active {
  background: rgba(241, 67, 82, 0.88);
}

.p-button-warn {
  background: rgba(23, 45, 215, 0.66);
  color: #f0ff41;
  border: 0;
}

.p-button-warn:hover {
  background: rgba(23, 45, 215, 0.88);
  color: #f0ff41;
  border: 0;
}

.p-button-warn:active {
  background: rgba(23, 45, 215, 1);
  color: #f0ff41;
  border: 0;
}
</style>
