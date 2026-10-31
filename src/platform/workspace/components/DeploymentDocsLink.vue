<template>
  <Button
    variant="link"
    size="link"
    class="w-fit"
    as="a"
    :href="docsUrl"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ $t('deployToComfyApi.readDocs') }}
    <i class="icon-[lucide--square-arrow-out-up-right]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useExternalLink } from '@/composables/useExternalLink'

const { buildDocsUrl } = useExternalLink()
const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })
</script>
