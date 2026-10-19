<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const codeFieldClass =
  '[&>span]:text-2xs/relaxed sm:[&>span]:text-xs/relaxed lg:[&>span]:text-sm/relaxed'
import { ArrowUpRight } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'
import { externalLinks } from '@/config/routes'
const INSTALL_COMMAND = 'pip install comfy-cli'
const { locale = 'en' } = defineProps<{
  locale?: Locale
  client: { name: string; kind: 'agent' | 'shell' }
  usesManualSetup: boolean
  isHeadless: boolean
  activeConnectionId: 'cloud' | 'local'
  agentPrompt: string
  connectCommand: string
}>()
const { t } = translationsFor(locale)
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')
</script>
<template>
  <Card class="mt-6 gap-3 rounded-3xl p-4 shadow-none sm:p-6">
    <CardHeader class="gap-3"
      ><CardTitle class="text-xl font-light md:text-xl">{{
        usesManualSetup
          ? t('cli.experience.installManual')
          : t('cli.experience.installAgent', { client: client.name })
      }}</CardTitle></CardHeader
    >
    <CardContent class="space-y-3 px-0">
      <template v-if="usesManualSetup">
        <CopyableField
          :class="codeFieldClass"
          :value="INSTALL_COMMAND"
          :copy-label="copyLabel"
          :copied-label="copiedLabel"
        />
        <p class="text-sm text-smoke-700">
          {{
            isHeadless
              ? t('cli.experience.headlessHelp')
              : activeConnectionId === 'cloud'
                ? t('cli.experience.cloudHelp')
                : t('cli.experience.localHelp')
          }}
        </p>
        <Button
          v-if="isHeadless && activeConnectionId === 'cloud'"
          variant="underlineLink"
          size="sm"
          :href="externalLinks.apiKeys"
          >{{ t('cli.experience.apiKey')
          }}<template #append
            ><ArrowUpRight class="ml-1 size-4" aria-hidden="true" /></template
        ></Button>
        <CopyableField
          :class="codeFieldClass"
          :value="connectCommand"
          :copy-label="copyLabel"
          :copied-label="copiedLabel"
        />
      </template>
      <template v-else
        ><CopyableField
          :class="codeFieldClass"
          :value="agentPrompt"
          :copy-label="copyLabel"
          :copied-label="copiedLabel"
      /></template>
    </CardContent>
  </Card>
</template>
