<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import { translationsFor } from '@/i18n/translations'
const { t } = translationsFor('en')
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')
const codeFieldClass =
  '[&>span]:text-2xs/relaxed sm:[&>span]:text-xs/relaxed lg:[&>span]:text-sm/relaxed'
const { client, usesManualSetup, isHeadless, activeConnectionId, runCommands } =
  defineProps<{
    client: { name: string; kind: 'agent' | 'shell' }
    usesManualSetup: boolean
    isHeadless: boolean
    activeConnectionId: 'cloud' | 'local'
    runCommands: string[]
  }>()

const description = computed(() => {
  if (client.kind !== 'agent')
    return isHeadless
      ? 'Run your workflow in your configured runner.'
      : 'Your terminal is ready for Comfy CLI commands.'
  if (usesManualSetup)
    return activeConnectionId === 'cloud'
      ? 'Complete browser sign-in if prompted, then run Comfy CLI commands in your terminal.'
      : 'Run Comfy CLI commands against your local ComfyUI installation.'
  return activeConnectionId === 'cloud'
    ? `Complete browser sign-in when prompted, then ask ${client.name} to generate an image or video.`
    : `Ask ${client.name} to run a workflow on your local ComfyUI installation.`
})
</script>
<template>
  <Card
    v-if="client.kind === 'agent' || runCommands.length"
    class="mt-4 gap-3 rounded-3xl p-4 shadow-none sm:p-6"
  >
    <CardHeader class="gap-3"
      ><CardTitle class="text-xl font-light md:text-xl"
        >2.
        {{
          usesManualSetup ? 'Run a command' : 'Connect and start creating'
        }}</CardTitle
      ></CardHeader
    >
    <CardContent class="space-y-3 px-0">
      <p class="text-sm text-smoke-700">
        {{ description }}
      </p>
      <CopyableField
        v-for="command in runCommands"
        :key="command"
        :class="codeFieldClass"
        :value="command"
        :copy-label="copyLabel"
        :copied-label="copiedLabel"
      />
    </CardContent>
  </Card>
</template>
