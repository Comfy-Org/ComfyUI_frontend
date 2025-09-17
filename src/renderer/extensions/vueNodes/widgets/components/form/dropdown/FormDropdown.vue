<script setup lang="ts">
import FormDropdownDrop from './FormDropdownDrop.vue'
import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="space-y-4">
    <div
      class="flex items-center justify-between gap-2 h-[30px] overscroll-contain"
    >
      <label
        class="text-sm text-stone-200 dark-theme:text-slate-200 font-normal flex-1 truncate w-20"
        >Image</label
      >
      <div class="w-75 cursor-default">
        <FormDropdownInput />
      </div>
    </div>
    <FormDropdownDrop />
    <FormDropdownMenu />
  </div>
</template>
