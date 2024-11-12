<!-- A simple read-only terminal component that displays logs. -->
<template>
  <div class="p-terminal rounded-none h-full w-full">
    <ScrollPanel class="h-full w-full" ref="scrollPanelRef">
      <pre class="px-4 whitespace-pre-wrap">{{ log }}</pre>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  fetchLogs: () => Promise<string>
  fetchInterval: number
}>()

const log = ref<string>('')
const scrollPanelRef = ref<InstanceType<typeof ScrollPanel> | null>(null)
/**
 * Whether the user has scrolled to the bottom of the terminal.
 * This is used to prevent the terminal from scrolling to the bottom
 * when new logs are fetched.
 */
const scrolledToBottom = ref(false)

let intervalId: number = 0

onMounted(async () => {
  const element = scrollPanelRef.value?.$el
  const scrollContainer = element?.querySelector('.p-scrollpanel-content')

  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      scrolledToBottom.value =
        scrollContainer.scrollTop + scrollContainer.clientHeight ===
        scrollContainer.scrollHeight
    })
  }

  const scrollToBottom = () => {
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }

  watch(log, () => {
    if (scrolledToBottom.value) {
      scrollToBottom()
    }
  })

  const fetchLogs = async () => {
    log.value = await props.fetchLogs()
  }

  await fetchLogs()
  scrollToBottom()
  intervalId = window.setInterval(fetchLogs, props.fetchInterval)
})

onBeforeUnmount(() => {
  window.clearInterval(intervalId)
})
</script>
