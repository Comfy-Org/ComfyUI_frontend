<template>
  <div class="w-full">
    <div class="flex items-center">
      <h2 class="text-lg font-normal text-left">
        {{ $t('manager.discoverCommunityContent') }}
      </h2>
      <Tag
        v-tooltip.left="$t('manager.legacyManagerUIDescription')"
        severity="info"
        icon="pi pi-info-circle"
        :value="$t('manager.legacyManagerUI')"
        class="cursor-help"
        :pt="{
          root: { class: 'text-xs' }
        }"
      />
    </div>
  </div>
</template>
