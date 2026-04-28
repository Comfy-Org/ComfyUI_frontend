<script setup lang="ts">
import { onMounted } from 'vue'

const HUBSPOT_CONTACT_PORTAL_ID = '244637579'
const HUBSPOT_CONTACT_FORM_ID = '94e05eab-1373-47f7-ab5e-d84f9e6aa262'
const HUBSPOT_CONTACT_REGION = 'na2'
const HUBSPOT_CONTACT_SCRIPT_ID = 'hubspot-contact-form-embed'
const HUBSPOT_CONTACT_SCRIPT_SRC = `https://js-${HUBSPOT_CONTACT_REGION}.hsforms.net/forms/embed/${HUBSPOT_CONTACT_PORTAL_ID}.js`

onMounted(() => {
  if (document.getElementById(HUBSPOT_CONTACT_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = HUBSPOT_CONTACT_SCRIPT_ID
  script.src = HUBSPOT_CONTACT_SCRIPT_SRC
  script.defer = true

  document.head.append(script)
})
</script>

<template>
  <div class="min-h-[640px] w-full">
    <div
      class="hs-form-frame"
      :data-region="HUBSPOT_CONTACT_REGION"
      :data-form-id="HUBSPOT_CONTACT_FORM_ID"
      :data-portal-id="HUBSPOT_CONTACT_PORTAL_ID"
    />
  </div>
</template>
