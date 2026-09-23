<script setup lang="ts">
import { ArrowUpRight, BookOpen, Cloud, Copy, Download } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Component } from 'vue'
import { computed } from 'vue'

import Button from '../ui/button/Button.vue'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { t } from '../../i18n/hub'
import type { WorkflowReach } from '../../lib/hub/workflow-reach'

type RouteKey = 'cloud' | 'copy' | 'download' | 'tutorial'

const {
  cloudUrl,
  downloadUrl,
  tutorialUrl,
  reach,
  only,
  stacked = false,
  locale = 'en'
} = defineProps<{
  /** Comfy Cloud, opened on this template. */
  cloudUrl: string
  downloadUrl: string
  tutorialUrl: string | undefined
  /**
   * How far this one can be taken as it stands. Shared Cloud cannot open a
   * workflow whose packs it does not carry, so those lead with the copy that
   * takes it somewhere it can be deployed.
   */
  reach?: WorkflowReach
  /** Which ways out this row offers. All of them when left unsaid. */
  only?: readonly RouteKey[]
  /** One under the other, each the full width of the column it stands in. */
  stacked?: boolean
  locale?: Locale
}>()

interface Route {
  readonly key: RouteKey
  readonly id: string
  readonly href: string
  readonly icon: Component
  readonly label: HubKey
  readonly note: HubKey
  readonly download?: boolean
  readonly external?: boolean
}

// The ways to leave with this workflow. The one that opens it somewhere it
// runs leads, and the rest follow it: Comfy Cloud for the ordinary case, and
// the copy into your own Comfy API workspace for the few whose packs Cloud
// does not carry, where opening it in Cloud would promise a run Cloud cannot
// give. What each one gives you is on hover; spelled out, the prose crowded
// the facts they stand under. None of them is the page's action: that is Run.
const allRoutes: readonly Route[] = [
  reach === 'endpoint'
    ? {
        key: 'copy' as const,
        id: 'workflow-copy-api',
        href: cloudUrl,
        icon: Copy,
        label: 'workshop.v2.workflow.copyApi' as const,
        note: 'workshop.v2.workflow.copyApiNote' as const,
        external: true
      }
    : {
        key: 'cloud' as const,
        id: 'workflow-open-cloud',
        href: cloudUrl,
        icon: Cloud,
        label: 'workshop.v2.workflow.openCloud' as const,
        note: 'workshop.v2.workflow.openCloudNote' as const,
        external: true
      },
  {
    key: 'download',
    id: 'workflow-download',
    href: downloadUrl,
    icon: Download,
    label: 'workshop.v2.workflow.download',
    note: 'workshop.v2.workflow.downloadNote',
    download: true
  },
  ...(tutorialUrl
    ? ([
        {
          key: 'tutorial',
          id: 'workflow-tutorial',
          href: tutorialUrl,
          icon: BookOpen,
          label: 'workshop.v2.workflow.tutorial',
          note: 'workshop.v2.workflow.tutorialNote',
          external: true
        }
      ] as const)
    : [])
]

const routes = computed(() =>
  only ? allRoutes.filter((route) => only.includes(route.key)) : allRoutes
)
</script>

<template>
  <ul
    :class="
      cn(
        'flex gap-2',
        stacked ? 'flex-col items-stretch' : 'flex-wrap items-center'
      )
    "
    data-testid="workflow-actions"
  >
    <li v-for="route in routes" :key="route.id">
      <Button
        :variant="
          route.key === 'cloud' || route.key === 'copy' ? 'default' : 'outline'
        "
        :size="stacked ? 'lg' : 'sm'"
        :class="stacked && 'w-full'"
        :href="route.href"
        :prepend-icon="route.icon"
        :append-icon="ArrowUpRight"
        :download="route.download ? '' : undefined"
        :target="route.external ? '_blank' : undefined"
        :rel="route.external ? 'noopener' : undefined"
        :data-testid="route.id"
        :title="t(route.note, locale)"
      >
        {{ t(route.label, locale) }}
      </Button>
    </li>
  </ul>
</template>
