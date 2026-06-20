<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { maximized = false } = defineProps<{ maximized?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const { t } = useI18n()
</script>

<template>
  <Button
    :aria-label="maximized ? t('g.restoreDialog') : t('g.maximizeDialog')"
    size="icon"
    variant="muted-textonly"
    @click="emit('toggle')"
  >
    <i
      :class="
        maximized ? 'icon-[lucide--minimize-2]' : 'icon-[lucide--maximize-2]'
      "
    />
  </Button>
</template>
