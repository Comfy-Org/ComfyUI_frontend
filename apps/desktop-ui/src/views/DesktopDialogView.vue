<template>
  <div class="w-full h-full flex flex-col rounded-lg p-6 justify-between">
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
import { normalizeI18nKey } from '@comfyorg/shared-frontend-utils/formatUtil'
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getDialog } from '@/constants/desktopDialogs'
import type { DialogAction } from '@/constants/desktopDialogs'
import { electronAPI } from '@/utils/envUtil'

const route = useRoute()
const { t } = useI18n()
const { id, title, message, buttons } = getDialog(route.params.dialogId)

const handleButtonClick = async (button: DialogAction) => {
  await electronAPI().Dialog.clickButton(button.returnValue)
}
</script>

<style scoped>
.p-button-secondary {
  border: none;
  background-color: var(--color-neutral-600);
  color: var(--color-white);
}

.p-button-secondary:hover {
  background-color: var(--color-neutral-550);
}

.p-button-secondary:active {
  background-color: var(--color-neutral-500);
}

.p-button-danger {
  background-color: var(--color-coral-red-600);
}

.p-button-danger:hover {
  background-color: var(--color-coral-red-500);
}

.p-button-danger:active {
  background-color: var(--color-coral-red-400);
}
</style>
