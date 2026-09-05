<template>
  <p class="m-0 text-center text-xs text-muted-foreground">
    <i18n-t keypath="subscription.preview.termsAgreement" tag="span">
      <template #terms>
        <a
          href="https://comfy.org/terms-of-service/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-base-foreground"
        >
          {{ $t('subscription.preview.terms') }}
        </a>
      </template>
      <template #privacy>
        <a
          href="https://comfy.org/privacy-policy/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-base-foreground"
        >
          {{ $t('subscription.preview.privacyPolicy') }}
        </a>
      </template>
    </i18n-t>
  </p>
</template>
