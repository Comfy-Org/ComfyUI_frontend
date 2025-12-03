<template>
  <div class="relative size-full overflow-hidden rounded">
    <div
      class="flex size-full flex-col items-center justify-center gap-2 bg-modal-card-placeholder-background transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
    >
      <i class="icon-[lucide--box] text-3xl text-muted-foreground" />
      <span class="text-sm text-base-foreground">{{
        $t('assetBrowser.media.threeDModelPlaceholder')
      }}</span>
    </div>
  </div>
</template>
