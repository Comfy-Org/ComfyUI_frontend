<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div
    role="article"
    data-testid="linear-welcome"
    class="flex flex-col items-center justify-center h-full gap-6 p-8 max-w-lg mx-auto text-center"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-xl font-semibold text-base-foreground">
        {{ t('linearMode.welcome.title')
        }}<sup class="ml-1 text-xs font-normal text-muted-foreground">{{
          t('g.experimental')
        }}</sup>
      </h2>
      <p class="text-base text-muted-foreground">
        {{ t('linearMode.welcome.intro') }}
      </p>
    </div>

    <div class="flex flex-col gap-3 text-xs text-muted-foreground/70 max-w-md">
      <p>{{ t('linearMode.welcome.layout') }}</p>
      <p>{{ t('linearMode.welcome.sharing') }}</p>
      <p>{{ t('linearMode.welcome.widget') }}</p>
    </div>
  </div>
</template>
