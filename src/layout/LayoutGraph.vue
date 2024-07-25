<template>
  <div class="flex flex-col transition-colors">
    <div
      class="flex"
      :class="[isWindows ? 'h-[calc(100vh-3.0rem)]' : 'h-[100vh]']"
    >
      <main
        class="w-full -translate-x-0 flex flex-1 flex-col bg-zinc-100 text-zinc-900 transition-all divide-y divide-zinc-200 dark:divide-black dark:bg-zinc-900 dark:text-zinc-100"
      >
        <article
          class="grow flex-col overflow-hidden bg-white dark:bg-zinc-950/50"
        >
          <router-view />
        </article>
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
const isElectron = (window as any).electron ? true : false
const isWindows = isElectron && (window as any).electron.isWindows
const isWeb = (window as any).isWeb
</script>
