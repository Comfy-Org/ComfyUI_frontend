<template>
  <div class="w-full h-full relative pointer-events-auto">
    <KeepAlive>
      <component
        v-if="
          webviewStore.activeWebviewId && webviewStore.activeWebview.keepAlive
        "
        :is="webviewStore.activeWebview.component"
        :key="webviewStore.activeWebviewId"
        v-bind="webviewStore.activeWebview.props || {}"
      />
    </KeepAlive>

    <component
      v-if="
        webviewStore.activeWebviewId && !webviewStore.activeWebview.keepAlive
      "
      :is="webviewStore.activeWebview.component"
      :key="webviewStore.activeWebviewId"
      v-bind="webviewStore.activeWebview.props || {}"
    />
  </div>
</template>

<script setup lang="ts">
import { useWebviewStore } from '@/stores/webviewStore'

const webviewStore = useWebviewStore()
</script>
