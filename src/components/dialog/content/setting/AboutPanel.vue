<template>
  <div class="p-4">
    <h3 class="text-lg font-semibold mb-4">{{ $t('about') }}</h3>
    <div class="space-y-3">
      <a
        v-for="link in links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center space-x-2 text-primary hover:underline"
      >
        <i :class="[link.icon, 'text-lg']"></i>
        <span>{{ link.label }}</span>
      </a>
    </div>
    <div class="mt-4 text-sm text-secondary">
      <p>{{ $t('frontendVersion') }}: {{ frontendVersion }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const frontendVersion = ref(window['__COMFYUI_FRONTEND_VERSION__'])

const links = [
  {
    label: 'Frontend Repository',
    url: 'https://github.com/Comfy-Org/ComfyUI_frontend',
    icon: 'pi pi-github'
  },
  {
    label: 'Core Repository',
    url: 'https://github.com/comfyanonymous/ComfyUI',
    icon: 'pi pi-github'
  },
  {
    label: 'Discord',
    url: 'https://www.comfy.org/discord',
    icon: 'pi pi-discord'
  },
  { label: 'Website', url: 'https://www.comfy.org/', icon: 'pi pi-globe' }
]
</script>
