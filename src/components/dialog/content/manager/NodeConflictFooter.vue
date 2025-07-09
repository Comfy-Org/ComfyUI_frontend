<template>
  <div class="flex items-center justify-between w-full px-3 py-4">
    <div class="w-full flex items-center justify-between gap-2 pr-1">
      <Button
        :label="$t('manager.conflicts.conflictInfoTitle')"
        text
        severity="secondary"
        size="small"
        icon="pi pi-info-circle"
        :pt="{
          label: { class: 'text-sm text-neutral-300' }
        }"
        @click="handleConflictInfoClick"
      />
      <PackInstallButton
        size="small"
        variant="default"
        :node-packs="[]"
        :label="$t('manager.conflicts.installAnyway')"
      />
    </div>
    <div></div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'

const handleConflictInfoClick = () => {
  console.log('faq')
}
</script>
