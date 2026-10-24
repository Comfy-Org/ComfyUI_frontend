<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink, FileStack, History, Inbox, Users } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { safeInternalPath } from '@/lib/cms/preview-display'

const {
  current,
  draftCount,
  contentCount,
  liveRevision,
  publishedBy,
  testersHref,
  navigation,
  busy = false,
  locale = 'en'
} = defineProps<{
  current: 'draft' | 'content' | 'history' | 'testers'
  draftCount?: number
  contentCount?: number
  liveRevision: number
  publishedBy?: string
  testersHref?: string
  navigation?: { key: 'draft' | 'content' | 'history'; href: string }[]
  busy?: boolean
  locale?: Locale
}>()
const t = computed(() => translationsFor(locale).t)
const emit = defineEmits<{ openLive: [] }>()
const links = computed(() =>
  [
    { key: 'draft', href: '/admin/', icon: Inbox, count: draftCount },
    {
      key: 'content',
      href: '/admin/content/',
      icon: FileStack,
      count: contentCount
    },
    {
      key: 'history',
      href: '/admin/history/',
      icon: History,
      count: undefined
    }
  ].flatMap((link) => {
    if (!navigation) return [link]
    const path = safeInternalPath(
      navigation.find((item) => item.key === link.key)?.href
    )
    return path?.startsWith('/admin/') ? [{ ...link, href: path }] : []
  })
)
const testerPath = computed(() => {
  const path = safeInternalPath(testersHref)
  return path?.startsWith('/admin/') ? path : undefined
})
const itemClass =
  'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap text-admin-fg/80 transition-colors hover:bg-admin-hover hover:text-admin-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-fg [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-admin-muted'
</script>
<template>
  <div
    class="grid min-h-[calc(100dvh-var(--cms-preview-offset,0px))] grid-cols-[minmax(0,1fr)] content-start bg-admin-page font-admin text-admin-fg lg:grid-cols-[15rem_minmax(0,1fr)] lg:content-stretch"
  >
    <aside
      :aria-label="t('cccConsole.navigation')"
      class="flex flex-col gap-4 border-b border-admin-line bg-admin-chrome px-3 py-3 lg:fixed lg:inset-y-0 lg:top-(--cms-preview-offset,0px) lg:left-0 lg:z-20 lg:w-60 lg:border-r lg:border-b-0"
    >
      <a
        :href="links.find((link) => link.key === 'draft')?.href ?? '/admin/'"
        class="flex items-center gap-2.5 rounded-lg px-1.5 py-1 focus-visible:outline-2 focus-visible:outline-admin-fg"
      >
        <img
          src="/icons/comfyicon.svg"
          alt=""
          class="size-8 shrink-0 rounded-lg shadow-admin-popover"
        />
        <span class="grid leading-tight">
          <span class="font-formula text-base font-semibold tracking-tight">{{
            t('cccConsole.title')
          }}</span>
          <span class="text-xs text-admin-muted">{{
            t('cccConsole.subtitle')
          }}</span>
        </span>
      </a>
      <nav
        :aria-label="t('cccConsole.navigation')"
        class="flex gap-1 overflow-x-auto lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto"
      >
        <a
          v-for="link in links"
          :key="link.key"
          :href="link.href"
          :aria-current="current === link.key ? 'page' : undefined"
          :class="
            cn(
              itemClass,
              current === link.key &&
                'bg-admin-line text-admin-fg [&_svg]:text-admin-fg'
            )
          "
        >
          <component :is="link.icon" aria-hidden="true" />
          <span class="flex-1">{{ t(`cccConsole.${link.key}`) }}</span>
          <span
            v-if="link.count !== undefined"
            class="text-xs text-admin-muted tabular-nums"
            >{{ ` ${link.count}` }}</span
          >
        </a>
        <template v-if="testerPath">
          <p
            class="mt-4 hidden h-6 items-center px-3 text-xs font-medium tracking-[0.06em] text-admin-subtle uppercase lg:flex"
          >
            {{ t('cccConsole.tools') }}
          </p>
          <a
            :href="testerPath"
            :aria-current="current === 'testers' ? 'page' : undefined"
            :class="
              cn(
                itemClass,
                current === 'testers' &&
                  'bg-admin-line text-admin-fg [&_svg]:text-admin-fg'
              )
            "
          >
            <Users aria-hidden="true" />{{ t('cccConsole.testers') }}
          </a>
        </template>
      </nav>
      <div
        role="group"
        :aria-label="t('cccConsole.liveControls')"
        class="mt-auto hidden shrink-0 gap-1 rounded-lg border border-admin-line p-3 lg:grid"
      >
        <p class="flex items-center gap-2 text-xs">
          <span
            class="size-1.5 rounded-full bg-admin-success"
            aria-hidden="true"
          />
          {{ t('cccConsole.live', { revision: liveRevision }) }}
        </p>
        <p v-if="publishedBy" class="text-xs break-all text-admin-muted">
          {{ t('cccConsole.publishedBy', { actor: publishedBy }) }}
        </p>
        <button
          type="button"
          :disabled="busy"
          class="mt-1 inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40"
          @click="emit('openLive')"
        >
          {{ t('cccConsole.liveSite')
          }}<ExternalLink class="size-3" aria-hidden="true" />
        </button>
      </div>
      <slot name="sidebar-footer" />
    </aside>
    <section
      :aria-label="t('cccConsole.actionArea')"
      class="min-w-0 px-4 py-6 sm:px-8 lg:col-start-2 lg:py-8"
    >
      <div class="mx-auto max-w-8xl"><slot /></div>
    </section>
  </div>
</template>
