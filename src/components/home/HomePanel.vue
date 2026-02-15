<template>
  <div class="flex h-full w-full bg-comfy-menu-bg">
    <aside
      class="flex w-56 shrink-0 flex-col gap-2 border-r border-border-default bg-comfy-menu-bg p-3"
    >
      <div
        class="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ $t('home.title') }}
      </div>
      <button
        :class="
          cn(
            'flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'recents'
              ? 'bg-secondary-background text-base-foreground border-border-hover'
              : 'text-base-foreground/80 hover:bg-secondary-background'
          )
        "
        @click="activeTab = 'recents'"
      >
        <i class="icon-[lucide--clock] size-4" />
        {{ $t('home.tabs.recents') }}
      </button>
      <button
        :class="
          cn(
            'flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'discover'
              ? 'bg-secondary-background text-base-foreground border-border-hover'
              : 'text-base-foreground/80 hover:bg-secondary-background'
          )
        "
        @click="activeTab = 'discover'"
      >
        <i class="icon-[lucide--compass] size-4" />
        {{ $t('home.tabs.discover') }}
      </button>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <div
        v-if="activeTab === 'recents'"
        class="flex flex-1 items-center justify-center"
      >
        <div class="flex max-w-md flex-col items-center gap-2 text-center">
          <i class="icon-[lucide--clock] size-10 text-muted-foreground" />
          <h2 class="text-lg font-semibold text-base-foreground">
            {{ $t('home.recentsStubTitle') }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ $t('home.recentsStubDescription') }}
          </p>
        </div>
      </div>
      <DiscoverView v-else class="flex-1" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import DiscoverView from '@/components/discover/DiscoverView.vue'
import { cn } from '@/utils/tailwindUtil'

type HomeTab = 'recents' | 'discover'

const activeTab = ref<HomeTab>('discover')
</script>
