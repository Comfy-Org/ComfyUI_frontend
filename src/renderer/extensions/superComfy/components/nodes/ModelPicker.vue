<script setup lang="ts">
import SearchableSingleSelect from '@comfyorg/design-system/single-select/SearchableSingleSelect'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GenerateNode } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { useRouterCatalog } from '@/renderer/extensions/superComfy/router/routerCatalog'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

const { node } = defineProps<{ node: GenerateNode }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const catalog = useRouterCatalog(node.modality)

const catalogModels = computed(() => {
  const state = catalog.value
  return state.status === 'loading' || state.status === 'ready'
    ? state.models
    : []
})

const options = computed(() => {
  const listed = catalogModels.value.map((model) => ({
    name: model.label,
    value: model.id
  }))
  const current = node.modelId
  if (current === null || listed.some(({ value }) => value === current)) {
    return listed
  }
  return [{ name: node.modelLabel ?? current, value: current }, ...listed]
})

const selected = computed({
  get: () => node.modelId ?? undefined,
  set: (modelId: string | number | undefined) => {
    if (typeof modelId === 'string' && modelId !== node.modelId) {
      void store.pickModel(node.id, modelId)
    }
  }
})

const placeholder = computed(() => {
  const state = catalog.value
  if (state.status === 'loading') {
    return t('superComfy.model.loading', {
      done: state.done,
      total: state.total
    })
  }
  if (state.status === 'refused') return t('superComfy.model.signInRefused')
  if (state.status === 'failed') return t('superComfy.model.loadFailed')
  return t('superComfy.model.pick')
})

const note = computed(() => {
  const state = catalog.value
  if (state.status === 'refused') return state.detail
  if (state.status === 'failed') return state.message
  if (state.status !== 'ready' || state.unsupported === 0) return ''
  return t(
    'superComfy.model.unsupported',
    { count: state.unsupported },
    state.unsupported
  )
})
</script>

<template>
  <div class="flex min-w-0 items-center gap-1" data-no-drag>
    <SearchableSingleSelect
      v-model="selected"
      size="md"
      :options
      :label="placeholder"
      :loading="catalog.status === 'loading'"
      :accessible-label="t('superComfy.model.pick')"
      :search-label="t('superComfy.model.search')"
      :empty-text="t('superComfy.model.empty')"
      popover-min-width="16rem"
      class="h-6 max-w-44 min-w-0"
    />
    <TextTooltip v-if="note" :text="note">
      <i class="icon-[lucide--info] size-3 text-muted-foreground" />
    </TextTooltip>
  </div>
</template>
