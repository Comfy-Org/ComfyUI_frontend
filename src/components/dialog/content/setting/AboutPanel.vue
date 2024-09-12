<template>
  <div>
    <h2 class="text-2xl font-bold mb-2">{{ $t('about') }}</h2>
    <div class="space-y-4">
      <a
        v-for="link in links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center no-underline"
      >
        <Tag class="mr-3">
          <template #icon>
            <i :class="[link.icon, 'mr-2 text-xl']"></i>
          </template>
          {{ link.label }}
        </Tag>
      </a>
    </div>
    <div class="mt-6 text-base text-secondary">
      <p>{{ $t('frontendVersion') }}: {{ frontendVersion }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tag from 'primevue/tag'

const frontendVersion = ref(window['__COMFYUI_FRONTEND_VERSION__'])

const links = [
  {
    label: 'ComfyUI',
    url: 'https://github.com/comfyanonymous/ComfyUI',
    icon: 'pi pi-github'
  },
  {
    label: 'ComfyUI_frontend',
    url: 'https://github.com/Comfy-Org/ComfyUI_frontend',
    icon: 'pi pi-github'
  },
  {
    label: 'Discord',
    url: 'https://www.comfy.org/discord',
    icon: 'pi pi-discord'
  },
  { label: 'ComfyOrg', url: 'https://www.comfy.org/', icon: 'pi pi-globe' }
]
</script>
