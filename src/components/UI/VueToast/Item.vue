<template>
  <li
    @mouseover="pause"
    @mouseout="resume"
    :class="[
      item.type === 'success' ? 'bg-green-600 text-white' : null,
      item.type === 'warning' ? 'bg-orange-500 text-white' : null,
      item.type === 'error' ? 'bg-red-600 text-white' : null
    ]"
    class="vue-toast w-full shadow-lg rounded-lg"
  >
    <div class="relative flex space-x-3 p-4">
      <div class="w-12 flex-shrink-0">
        <svg
          v-if="item.type === 'success'"
          class="w-12 h-12"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <svg
          v-if="item.type === 'warning'"
          class="w-12 h-12"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <svg
          v-if="item.type === 'error'"
          class="w-12 h-12"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </div>
      <div class="flex-1 pointer-events-none noselect mt-px pr-8">
        <div
          class="text-base font-semibold tracking-tight leading-6 pr-3"
          style="overflow-wrap: break-word; word-break: break-all"
        >
          {{ item.message }}
        </div>
      </div>
      <button
        type="button"
        @click="close"
        class="absolute top-3 right-3 w-8 h-8 flex items-start cursor-pointer opacity-60 hover:opacity-100 focus:outline-none"
      >
        <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </button>
    </div>

    <div
      v-if="!item.sticky"
      class="toast-progress p-2 border-t border-opacity-25 border-white"
    >
      <div
        class="rounded-full h-1 bg-white bg-opacity-50"
        :style="{ width: progress + '%' }"
      ></div>
    </div>
  </li>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, onMounted } from 'vue'

export default defineComponent({
  name: 'VueToastItem',

  props: {
    item: { type: Object, required: true }
  },

  setup(props, { emit }) {
    const state = reactive({
      progress: 0,
      timer: undefined as undefined | number
    })

    const start = () => {
      state.timer = setInterval(() => {
        state.progress += 0.75
        if (state.progress >= 100) close()
      }, 20) as unknown as number
    }

    const pause = () => {
      if (state.timer) {
        clearInterval(state.timer)
      }
    }

    const resume = () => {
      if (!props.item.sticky) start()
    }

    const close = () => {
      clearInterval(state.timer)
      emit('remove', props.item)
    }

    onMounted(() => {
      if (!props.item.sticky) start()
    })

    return {
      ...toRefs(state),
      close,
      pause,
      resume
    }
  }
})
</script>
