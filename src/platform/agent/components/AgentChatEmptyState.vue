<script setup lang="ts">
const { name } = defineProps<{
  name?: string
}>()
</script>

<template>
  <div class="flex w-full max-w-96 flex-col items-center gap-4 pt-12">
    <img
      src="/assets/images/comfy-logo-single.svg"
      alt=""
      class="size-12"
      aria-hidden="true"
    />
    <div class="text-center text-base font-semibold text-base-foreground">
      <p>
        {{ name ? $t('agent.greetingNamed', { name }) : $t('agent.greeting') }}
      </p>
      <p>{{ $t('agent.greetingQuestion') }}</p>
    </div>
  </div>
</template>
