<script setup lang="ts">
import { useEventListener, useMounted } from '@vueuse/core'
import { WORKSHOP_INCLUDED } from 'astro:env/client'
import {
  computed,
  defineAsyncComponent,
  h,
  onScopeDispose,
  shallowRef,
  watch
} from 'vue'
import type { FunctionalComponent } from 'vue'

import { isWorkflowSlug } from '@/config/models-catalogue'
import { fetchModelsCatalogue } from '@/config/models-catalogue-data'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { translationsFor } from '@/i18n/translations'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'

import { loadModelsCatalogue } from '@/lib/workshop/models-catalogue-loader'
import type { HubSection } from '@/lib/workshop/hub-section'
import HubEyebrow from './HubEyebrow.vue'
import WorkshopGate from './WorkshopGate.vue'
import WorkshopLoading from './WorkshopLoading.vue'
import { workshopHeadingClass } from './workshopHeadingClasses'

const { t } = translationsFor('en')
const {
  slug,
  workflowId,
  heading,
  section = 'models'
} = defineProps<{
  slug?: string
  workflowId?: string
  heading?: string
  section?: HubSection
}>()

const loadingLabel = t('workshop.load.pending')
const isWorkflow = computed(() => (slug ? isWorkflowSlug(slug) : false))
const mounted = useMounted()
const catalogueRevision = shallowRef(0)
const catalogueSearch = shallowRef<string>()
useEventListener<DocumentEventMap['astro:before-swap']>(
  () => (mounted.value ? document : undefined),
  'astro:before-swap',
  (event) => {
    if (slug) return
    catalogueSearch.value = event.to.search
    if (event.from.pathname !== event.to.pathname) return
    document.addEventListener(
      'astro:after-swap',
      () => catalogueRevision.value++,
      { once: true }
    )
  }
)
const enabled = useWorkshopEnabled()
const settled = useWorkshopEnabledSettled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const appsEnabled = useWorkshopAppsEnabled()
const gateAllows = computed(() => {
  if (isWorkflow.value || section === 'workflows') return workflowsEnabled.value
  return section === 'apps' ? appsEnabled.value : undefined
})
const isPublic = (shown: HubSection) =>
  shown === 'models' || shown === 'explore'
const catalogueView = computed(() => {
  const isPublicSection = isPublic(section)
  if (!mounted.value || (!isPublicSection && !settled.value)) return 'loading'
  return isPublicSection || (enabled.value && gateAllows.value)
    ? 'granted'
    : 'denied'
})
// Inside a category the category's own title carries the page, so the hub's
// eyebrow and heading give up their space to it. They stay in the document
// rather than leaving: the page keeps the one heading it is supposed to have,
// and the category reads as the section of it that it is.
const inSection = shallowRef(false)
const heroShown = shallowRef(false)
const recoveringWorkflow = shallowRef(false)
const savedWorkflow = shallowRef(false)
const session =
  WORKSHOP_INCLUDED && workflowId ? useWorkshopSession().session : undefined
watch(
  [
    () => workflowId,
    () => session?.value?.uid,
    () => session?.value?.workspace.id
  ],
  async ([id, uid, workspaceId], _, onCleanup) => {
    savedWorkflow.value = false
    let current = true
    onCleanup(() => {
      current = false
    })
    if (!id || !uid || !workspaceId) return
    try {
      const { workflowStorage } =
        await import('@/config/workshop-workflow-storage')
      if (current)
        savedWorkflow.value = Boolean(
          workflowStorage(
            sessionStorage,
            JSON.stringify([uid, workspaceId]),
            id
          ).read()
        )
    } catch {
      return
    }
  },
  { immediate: true }
)

let legacyForward: AbortController | undefined
onScopeDispose(() => legacyForward?.abort())

const loadCatalogue = () =>
  Promise.all([loadModelsCatalogue(), fetchModelsCatalogue()])
const startsEarly = !slug && isPublic(section) && !import.meta.env.SSR
const openingHref = startsEarly ? location.href : undefined
let earlyCatalogue = startsEarly ? loadCatalogue() : undefined
void earlyCatalogue?.catch(() => undefined)

async function forwardLegacyLink(): Promise<void> {
  const href = openingHref ?? location.href
  if (section !== 'models' || !new URL(href).searchParams.has('type')) return
  legacyForward?.abort()
  legacyForward = new AbortController()
  const { signal } = legacyForward
  const { forwardLegacySection } = await import('./forwardLegacySection')
  await forwardLegacySection(href, signal)
}

const Loading: FunctionalComponent = () =>
  h(WorkshopLoading, { label: loadingLabel, 'data-testid': 'models-loading' })

const LoadError: FunctionalComponent<{ error?: unknown }> = () =>
  h(
    'div',
    {
      role: 'alert',
      class:
        'flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center text-primary-warm-white',
      'data-testid': 'models-load-error'
    },
    [
      h('p', { class: 'text-lg' }, t('workshop.load.failed')),
      h(
        'button',
        {
          type: 'button',
          class:
            'bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 h-11 cursor-pointer rounded-2xl px-6 text-sm font-bold text-primary-comfy-ink',
          'data-testid': 'models-retry',
          onClick: () => {
            Content.value = createContent()
          }
        },
        t('workshop.error.retry')
      )
    ]
  )
LoadError.props = ['error']

function createContent() {
  return defineAsyncComponent({
    loader: async () => {
      if (slug) {
        const preload = isWorkflowSlug(slug)
          ? import('./WorkflowPage.vue')
          : import('./ModelPage.vue')
        void preload.catch(() => undefined)
        const { fetchModelsPage } = await import('@/config/models-page-data')
        const { model, ...page } = await fetchModelsPage(slug)
        if (model.routerId === undefined) {
          const { default: WorkflowPage } = await import('./WorkflowPage.vue')
          return () =>
            h(WorkflowPage, {
              model,
              onRecovery: (active: boolean) => {
                recoveringWorkflow.value = active
              }
            })
        }
        const { default: ModelPage } = await import('./ModelPage.vue')
        return () => h(ModelPage, { page: { ...page, model } })
      }
      const forwarding = forwardLegacyLink()
      const catalogue = earlyCatalogue ?? loadCatalogue()
      earlyCatalogue = undefined
      void catalogue.catch(() => undefined)
      await forwarding
      const [{ default: ModelsCatalogue }, models] = await catalogue
      return () =>
        h(
          'div',
          {
            class: 'max-w-10xl mx-auto px-6 pb-16 max-sm:pb-10 lg:px-8 lg:pb-24'
          },
          [
            h(ModelsCatalogue, {
              key: `${section}:${catalogueRevision.value}`,
              initialSearch: catalogueSearch.value,
              onSection: (open: boolean) => {
                inSection.value = open
              },
              onHero: (shown: boolean) => {
                heroShown.value = shown
              },
              models: models.filter(
                (model) =>
                  model.routerId !== undefined ||
                  model.type === 'APP' ||
                  workflowsEnabled.value
              ),
              section
            })
          ]
        )
    },
    loadingComponent: Loading,
    errorComponent: LoadError,
    onError: (_error, retry, fail, attempts) => {
      if (attempts <= 1) retry()
      else fail()
    },
    delay: 0
  })
}

const Content = shallowRef(createContent())
</script>

<template>
  <template v-if="!slug">
    <div
      v-if="heading && catalogueView !== 'denied' && !heroShown"
      class="mx-auto max-w-10xl px-6 pt-8 max-sm:pt-5 lg:px-8 lg:pt-12"
    >
      <div
        data-testid="workshop-heading"
        :class="inSection ? 'sr-only' : 'animate-soft-in pb-4 sm:short:pb-3'"
      >
        <HubEyebrow :section />
        <h1 :class="workshopHeadingClass">{{ heading }}</h1>
      </div>
    </div>
    <component :is="Content" v-if="catalogueView === 'granted'" />
    <WorkshopLoading
      v-else-if="catalogueView === 'loading'"
      :label="loadingLabel"
    />
    <slot v-else name="fallback" />
  </template>
  <WorkshopGate
    v-else-if="gateAllows !== undefined"
    :keep-mounted="isWorkflow"
    :allowed="gateAllows"
    :retain-granted="recoveringWorkflow"
    :allow-recovery="savedWorkflow"
  >
    <component :is="Content" />
    <template #loading>
      <WorkshopLoading :label="loadingLabel" />
    </template>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
  <component :is="Content" v-else-if="mounted" />
  <WorkshopLoading v-else :label="loadingLabel" />
</template>
