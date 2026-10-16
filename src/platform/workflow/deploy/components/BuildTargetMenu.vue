<template>
  <Menu :modal="false" :side-offset="8" class="min-w-56">
    <template #trigger>
      <Button
        variant="secondary"
        size="unset"
        :disabled
        :tooltip="$t('deployToComfyApi.runLocally')"
        tooltip-side="bottom"
        :aria-label="$t('deployToComfyApi.chooseTarget')"
        class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-secondary-background-hover"
      >
        <i class="icon-[lucide--monitor] size-4" aria-hidden="true" />
        <i
          class="icon-[lucide--chevron-down] size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </Button>
    </template>
    <MenuRadioGroup
      model-value="local"
      :options="[
        {
          value: 'local',
          label: $t('deployToComfyApi.local'),
          icon: 'icon-[lucide--monitor]'
        }
      ]"
    />
    <MenuSeparator />
    <MenuItem @select="emit('deploy')">
      <i class="icon-[lucide--rocket] size-4" aria-hidden="true" />
      {{ $t('deployToComfyApi.deployToCloud') }}
      <i
        class="ml-auto icon-[lucide--square-arrow-out-up-right] size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </MenuItem>
  </Menu>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuItem from '@/components/ui/menu/MenuItem.vue'
import MenuRadioGroup from '@/components/ui/menu/MenuRadioGroup.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ deploy: [] }>()
</script>
