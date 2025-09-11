<template>
  <BaseViewTemplate dark>
    <div class="flex flex-col items-center justify-center min-h-screen p-8">
      <div class="w-full max-w-md text-center">
        <h1 class="text-3xl font-bold mb-8">
          {{ t('cloudOnboarding.waitlist.title') }}
        </h1>
        
        <div class="space-y-6">
          <p class="text-gray-400">
            {{ t('cloudOnboarding.waitlist.message') }}
          </p>

          <div class="bg-gray-800 rounded-lg p-6">
            <i class="pi pi-clock text-4xl text-gray-500 mb-4"></i>
            <p class="text-sm text-gray-400">
              Your request is being reviewed. We'll notify you via email once you're approved.
            </p>
          </div>

          <Message v-if="checkMessage" :severity="checkMessageType">
            {{ checkMessage }}
          </Message>

          <div class="flex gap-4 justify-center">
            <Button
              label="Check Status"
              icon="pi pi-refresh"
              @click="checkStatus"
              :loading="loading"
              severity="secondary"
            />
            
            <Button
              label="Return to Home"
              @click="handleReturn"
              outlined
            />
          </div>
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { getMe } from '@/api/me'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const checkMessage = ref('')
const checkMessageType = ref<'success' | 'info' | 'warn' | 'error'>('info')

const checkStatus = async () => {
  loading.value = true
  checkMessage.value = ''
  
  try {
    const me = await getMe()
    
    if (me.whitelisted) {
      // User has been approved!
      checkMessage.value = 'Great news! You have been approved.'
      checkMessageType.value = 'success'
      
      // Redirect to main app after a short delay
      setTimeout(() => {
        void router.push({ path: '/' })
      }, 2000)
    } else {
      // Still waiting
      checkMessage.value = 'Your application is still under review. Please check back later.'
      checkMessageType.value = 'info'
    }
  } catch (error) {
    console.error('Error checking status:', error)
    checkMessage.value = 'Failed to check status. Please try again.'
    checkMessageType.value = 'error'
  } finally {
    loading.value = false
  }
}

const handleReturn = () => {
  void router.push({ path: '/' })
}
</script>