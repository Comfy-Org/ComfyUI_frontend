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
    </div>

    <div class="flex flex-col gap-3 text-xs text-muted-foreground/70 max-w-md">
      <p class="mt-0">{{ t('linearMode.welcome.message') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.controls') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.sharing') }}</p>
      <p class="mt-0 text-base-foreground">
        <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
          <template #runButton>
            <span
              class="inline-flex items-center px-3.5 py-0.5 mx-0.5 rounded bg-primary-background text-base-foreground text-xxs font-medium cursor-default"
            >
              {{ t('menu.run') }}
            </span>
          </template>
        </i18n-t>
      </p>
    </div>
  </div>
</template>
