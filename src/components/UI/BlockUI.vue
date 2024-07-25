<template>
  <transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="display" class="BlockUI fixed inset-0 z-[13000000]">
      <div @click.stop.prevent="clicked" class="overlay preloader"></div>
      <div class="preloader-modal">
        <Spinner />
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import { ref, watch } from 'vue'
import Spinner from '@/components/UI/Spinner.vue'

export default {
  components: {
    Spinner
  },

  props: {
    open: Boolean
  },

  setup(props, { emit }) {
    const display = ref(false)
    let autoCloseTimer: any
    let fadeOutTimer: any

    const clicked = () => {
      // emit('clicked')
    }

    const openLoader = () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(autoCloseTimer)

      setTimeout(() => {
        display.value = true
      }, 1)

      autoCloseTimer = setTimeout(() => {
        closeLoader()
      }, 20000)
    }

    const closeLoader = () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(autoCloseTimer)

      fadeOutTimer = setTimeout(() => {
        display.value = false
      }, 50)
    }

    watch(
      () => props.open,
      (nv) => {
        if (nv) {
          openLoader()
        } else {
          closeLoader()
        }
      }
    )

    return {
      display,
      clicked
    }
  }
}
</script>

<style type="text/css" scoped>
.overlay {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 13000000;
  display: block;
}

.preloader-modal {
  position: absolute;
  left: 50%;
  top: 50%;
  padding: 8px;
  margin-left: -36px;
  margin-top: -36px;
  z-index: 14000000;
}
</style>
