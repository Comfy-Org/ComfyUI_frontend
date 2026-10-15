<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { ListReturn } from '@/lib/workshop/shelf-memory'
import { lastList } from '@/lib/workshop/shelf-memory'
import HubBreadcrumb from './HubBreadcrumb.vue'

const { section, name } = defineProps<{
  section: 'models' | 'workflows'
  name: string
}>()

const routes = getRoutes()
const sectionList = {
  models: { href: routes.workshop, label: t('workshop.model.breadcrumb') },
  workflows: { href: routes.hubWorkflows, label: t('workshop.hub.workflows') }
}[section]
const hub = { href: routes.hubExplore, label: t('workshop.catalogue.eyebrow') }

const remembered = ref<ListReturn>()

// Most visitors reach a page from a list, and the way back they want is that
// list as they left it. Opened in a new tab, or from a shared link, there is
// no list to return to and the section answers.
onMounted(() => {
  remembered.value = lastList(location.pathname)
})

const back = computed(() => {
  const list = remembered.value
  if (!list) return sectionList
  if (list.href === hub.href) return hub
  return { href: list.href, label: list.label ?? sectionList.label }
})

const crumbs = computed(() => [
  { ...hub, testId: 'detail-hub' },
  {
    ...(back.value === hub ? sectionList : back.value),
    testId: 'detail-list'
  },
  { label: name }
])
</script>

<template>
  <div class="min-w-0" data-testid="detail-trail">
    <HubBreadcrumb :crumbs class="max-sm:hidden" />
    <a
      :href="back.href"
      :aria-label="t('workshop.model.backTo', { category: back.label })"
      class="-ml-1 inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-canvas focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 sm:hidden"
      data-testid="detail-back"
    >
      <ChevronLeft class="size-4 shrink-0" aria-hidden="true" />
      <span class="truncate">{{ back.label }}</span>
    </a>
  </div>
</template>
