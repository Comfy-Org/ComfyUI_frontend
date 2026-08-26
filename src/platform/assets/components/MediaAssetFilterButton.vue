<template>
  <div class="inline-flex items-center">
    <DropdownMenu :modal="false">
      <template #button>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="$t('assetBrowser.filterBy')"
        >
          <i class="icon-[lucide--list-filter]" />
          <span
            v-if="active"
            aria-hidden="true"
            class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-base-foreground"
          />
        </Button>
      </template>
      <slot />
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'

const { active = false } = defineProps<{
  active?: boolean
}>()
</script>
