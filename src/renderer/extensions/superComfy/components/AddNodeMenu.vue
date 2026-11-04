<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { PopoverAnchor, PopoverRoot } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppCatalog } from '@/renderer/extensions/superComfy/apps/appCatalog'
import type { AppCatalogEntry } from '@/renderer/extensions/superComfy/apps/appCatalog'
import type {
  Modality,
  NodeId
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'
import {
  MODALITIES,
  modalityIcon,
  modalityLabelKey
} from '@/renderer/extensions/superComfy/superComfyModality'

interface MenuEntry {
  key: string
  label: string
  icon: string
  pick: () => void
}

const { at, anchor } = defineProps<{ at: Point; anchor: Point }>()

const emit = defineEmits<{ added: [id: NodeId]; close: [] }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const { apps, loading, refresh } = useAppCatalog()
const query = ref('')

const anchorStyle = computed(() => ({
  left: `${anchor.x}px`,
  top: `${anchor.y}px`
}))

function matches(label: string): boolean {
  return label.toLowerCase().includes(query.value.trim().toLowerCase())
}

function added(id: NodeId) {
  emit('added', id)
  emit('close')
}

function ioEntry(modality: Modality): MenuEntry {
  return {
    key: `io-${modality}`,
    label: t(modalityLabelKey(modality)),
    icon: modalityIcon(modality),
    pick: () => added(store.addIoNode(modality, at))
  }
}

function generateEntry(modality: Modality): MenuEntry {
  return {
    key: `generate-${modality}`,
    label: t('superComfy.menu.generateNode', {
      modality: t(modalityLabelKey(modality))
    }),
    icon: 'icon-[lucide--sparkles]',
    pick: () => added(store.addGenerateNode(modality, at))
  }
}

function appEntry(app: AppCatalogEntry): MenuEntry {
  return {
    key: `app-${app.path}`,
    label: app.title,
    icon: 'icon-[lucide--panels-top-left]',
    pick: () => {
      emit('close')
      void store.addAppNode(app, at).then((id) => emit('added', id))
    }
  }
}

const sections = computed(() => [
  {
    key: 'io',
    title: t('superComfy.menu.io'),
    entries: MODALITIES.map(ioEntry).filter(({ label }) => matches(label))
  },
  {
    key: 'generate',
    title: t('superComfy.menu.generate'),
    entries: MODALITIES.map(generateEntry).filter(({ label }) => matches(label))
  },
  {
    key: 'apps',
    title: t('superComfy.menu.apps'),
    entries: apps.value.map(appEntry).filter(({ label }) => matches(label))
  }
])

const appsEmpty = computed(() => !loading.value && apps.value.length === 0)

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}

onMounted(() => {
  refresh().catch(() => undefined)
})
</script>

<template>
  <PopoverRoot :open="true" @update:open="onOpenChange">
    <PopoverAnchor
      class="pointer-events-none absolute size-0"
      :style="anchorStyle"
    />
    <PopoverContent align="start" side="bottom" class="flex flex-col gap-1 p-2">
      <SearchInput
        v-model="query"
        size="sm"
        autofocus
        :debounce-time="0"
        :placeholder="t('superComfy.menu.search')"
        :accessible-label="t('superComfy.menu.search')"
        :clear-label="t('superComfy.menu.clearSearch')"
      />
      <div class="flex scrollbar-custom min-h-0 flex-col gap-1 overflow-y-auto">
        <section
          v-for="section in sections"
          :key="section.key"
          class="flex flex-col"
        >
          <h3 class="px-2 pt-2 pb-1 text-2xs text-muted-foreground">
            {{ section.title }}
          </h3>
          <Button
            v-for="entry in section.entries"
            :key="entry.key"
            variant="textonly"
            size="sm"
            class="justify-start font-normal"
            @click="entry.pick"
          >
            <i :class="entry.icon" />
            <span class="truncate">{{ entry.label }}</span>
          </Button>
        </section>
        <Skeleton v-if="loading" class="mx-2 h-6" />
        <p
          v-else-if="appsEmpty"
          class="px-2 py-1 text-xs text-muted-foreground"
        >
          {{ t('superComfy.menu.noApps') }}
        </p>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>
