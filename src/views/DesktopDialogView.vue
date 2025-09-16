<template>
  <div
    class="w-full h-full flex flex-col rounded-lg p-6 bg-[#2d2d2d] justify-between"
  >
    <h1 class="font-inter font-semibold text-xl m-0 italic">
      {{ t(`desktopDialogs.${id}.title`, title) }}
    </h1>
    <p class="whitespace-pre-wrap">
      {{ t(`desktopDialogs.${id}.message`, message) }}
    </p>
    <div class="flex w-full gap-2">
      <Button
        v-for="button in buttons"
        :key="button.label"
        class="rounded-lg first:mr-auto"
        :label="
          t(
            `desktopDialogs.${id}.buttons.${normalizeI18nKey(button.label)}`,
            button.label
          )
        "
        :severity="button.severity ?? 'secondary'"
        @click="handleButtonClick(button)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useRoute } from 'vue-router'

import { type DialogAction, getDialog } from '@/constants/desktopDialogs'
import { t } from '@/i18n'
import { electronAPI } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'

const route = useRoute()
const { id, title, message, buttons } = getDialog(route.params.dialogId)

const handleButtonClick = (button: DialogAction) => {
  if (button.action === 'openUrl' && button.url) {
    window.open(button.url, '_blank')
  }
  void electronAPI().Dialog.clickButton(button.returnValue)
}
</script>

<style scoped>
@reference '../assets/css/style.css';

.p-button-secondary {
  @apply text-white rounded-lg border-none bg-charcoal-600;
}

.p-button-secondary:hover {
  @apply bg-charcoal-700;
}

.p-button-secondary:active {
  @apply bg-charcoal-800;
}

.p-button-danger {
  @apply bg-coral-red-600 border-0;
}

.p-button-danger:hover {
  @apply bg-coral-red-500;
}

.p-button-danger:active {
  @apply bg-coral-red-400;
}

.p-button-warn {
  @apply bg-brand-blue/65 text-brand-yellow border-0;
}

.p-button-warn:hover {
  @apply bg-brand-blue/90 text-brand-yellow border-0;
}

.p-button-warn:active {
  @apply bg-brand-blue text-brand-yellow border-0;
}
</style>
