<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const {
  locale = 'en',
  client,
  usesManualSetup,
  isHeadless,
  activeConnectionId,
  runCommands
} = defineProps<{
  locale?: Locale
  client: { name: string; kind: 'agent' | 'shell' }
  usesManualSetup: boolean
  isHeadless: boolean
  activeConnectionId: 'cloud' | 'local'
  runCommands: string[]
}>()

const { t } = translationsFor(locale)
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')

const description = computed(() => {
  if (client.kind !== 'agent')
    return isHeadless
      ? t('cli.experience.runHeadless')
      : t('cli.experience.runTerminal')
  if (usesManualSetup)
    return activeConnectionId === 'cloud'
      ? t('cli.experience.runManualCloud')
      : t('cli.experience.runManualLocal')
  return activeConnectionId === 'cloud'
    ? t('cli.experience.runAgentCloud', { client: client.name })
    : t('cli.experience.runAgentLocal', { client: client.name })
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
          usesManualSetup
            ? t('cli.experience.runManualTitle')
            : t('cli.experience.runAgentTitle')
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
        variant="cli"
        :value="command"
        :copy-label="copyLabel"
        :copied-label="copiedLabel"
      />
    </CardContent>
  </Card>
</template>
