<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      class="w-full"
      @click="handleViewModeChange('list')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--table-of-contents] size-4" />
        <span>{{ $t('sideToolbar.queueProgressOverlay.viewList') }}</span>
      </span>
      <i
        class="icon-[lucide--check] ml-auto size-4"
        :class="viewMode !== 'list' && 'opacity-0'"
      />
    </Button>

    <Button
      variant="textonly"
      class="w-full"
      @click="handleViewModeChange('grid')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--layout-grid] size-4" />
        <span>{{ $t('sideToolbar.queueProgressOverlay.viewGrid') }}</span>
      </span>
      <i
        class="icon-[lucide--check] ml-auto size-4"
        :class="viewMode !== 'grid' && 'opacity-0'"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { close } = defineProps<{
  close: () => void
}>()

const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

function handleViewModeChange(value: 'list' | 'grid') {
  viewMode.value = value
  close()
}
</script>
