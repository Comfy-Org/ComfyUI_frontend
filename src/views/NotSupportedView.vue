<template>
  <div
    class="font-sans w-screen h-screen flex items-center m-0 text-neutral-900 bg-neutral-300 pointer-events-auto"
  >
    <div class="flex-grow flex items-center justify-center">
      <div class="flex flex-col gap-8 p-8">
        <!-- Header -->
        <h1 class="text-4xl font-bold text-red-500">
          {{ $t('notSupported.title') }}
        </h1>

        <!-- Message -->
        <div class="space-y-4">
          <p class="text-xl">
            {{ $t('notSupported.message') }}
          </p>
          <ul class="list-disc list-inside space-y-1 text-neutral-800">
            <li>{{ $t('notSupported.supportedDevices.macos') }}</li>
            <li>{{ $t('notSupported.supportedDevices.windows') }}</li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex gap-4">
          <Button
            :label="$t('notSupported.learnMore')"
            icon="pi pi-github"
            @click="openDocs"
            severity="secondary"
          />
          <Button
            :label="$t('notSupported.reportIssue')"
            icon="pi pi-flag"
            @click="reportIssue"
            severity="danger"
          />
        </div>
      </div>
    </div>

    <!-- Right side image -->
    <div class="h-screen flex-grow-0">
      <img
        src="/assets/images/sad_girl.png"
        alt="Sad girl illustration"
        class="h-full object-cover"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

const openDocs = () => {
  window.open(
    'https://github.com/Comfy-Org/desktop#currently-supported-platforms',
    '_blank'
  )
}

const reportIssue = () => {
  window.open('https://forum.comfy.org/c/v1-feedback/', '_blank')
}
</script>
