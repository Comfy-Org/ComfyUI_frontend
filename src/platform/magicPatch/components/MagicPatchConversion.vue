<template>
  <Button
    variant="secondary"
    :disabled="blocked || store.visible"
    @click="store.offer([revision])"
    >{{ t('magicPatch.convert') }}</Button
  >
</template>
<script setup lang="ts">
import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'
const { revision, blocked = false } = defineProps<{
  revision: CloudNodeRegistryRevision
  blocked?: boolean
}>()
const { t } = useI18n()
const store = useMagicPatchBatchStore()
</script>
