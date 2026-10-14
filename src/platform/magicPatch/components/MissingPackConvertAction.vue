<template>
  <div class="flex shrink-0 flex-col items-end gap-1">
    <Button
      variant="secondary"
      size="sm"
      :aria-label="t('magicPatch.convertNamedPack', { pack: packName })"
      :loading="checking"
      :disabled="store.visible || store.resolvingPack || group.isResolving"
      @click="review"
    >
      {{ t('magicPatch.convertAction') }}
    </Button>
    <span
      v-if="reason"
      role="alert"
      class="max-w-56 text-xs text-muted-foreground"
    >
      {{ t(`magicPatch.reasons.${reason}`) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import Button from '@/components/ui/button/Button.vue'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'

const { group } = defineProps<{ group: MissingPackGroup }>()
const { t } = useI18n()
const store = useMagicPatchBatchStore()
const checking = ref(false)
const reason = ref<string>()
const packName = computed(
  () =>
    group.packId ??
    group.nodeTypes
      .map((node) => (typeof node === 'string' ? node : node.type))
      .join(', ')
)

watch(
  () => group,
  () => {
    reason.value = undefined
  }
)

async function review() {
  checking.value = true
  reason.value = undefined
  try {
    reason.value = await store.offerMissingPack(group)
  } finally {
    checking.value = false
  }
}
</script>
