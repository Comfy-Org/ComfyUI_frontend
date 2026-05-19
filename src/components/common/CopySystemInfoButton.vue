<template>
  <Button variant="secondary" @click="copySystemInfo">
    <i class="pi pi-copy" />
    {{ $t('g.copySystemInfo') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useCopySystemInfo } from '@/composables/useCopySystemInfo'
import type { SystemStats } from '@/schemas/apiSchema'

const { stats } = defineProps<{
  stats: SystemStats
}>()

const { copySystemInfo } = useCopySystemInfo(() => stats)
</script>
