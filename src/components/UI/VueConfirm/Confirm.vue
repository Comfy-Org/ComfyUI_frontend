<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog :open="true" as="div" @close="close">
      <div class="vue-confirm fixed inset-0 z-[100] overflow-y-auto">
        <div class="min-h-screen px-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <DialogOverlay class="fixed inset-0 bg-zinc-950 bg-opacity-50" />
          </TransitionChild>

          <span class="inline-block h-screen align-middle" aria-hidden="true">
            &#8203;
          </span>

          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <div
              class="inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-lg rounded-md"
            >
              <div class="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                <button
                  @click="close"
                  type="button"
                  class="bg-white rounded-md text-zinc-400 hover:text-zinc-500 focus:outline-none"
                >
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              <div class="p-6 sm:flex sm:items-start">
                <div
                  class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"
                >
                  <svg
                    class="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                </div>

                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-zinc-900">
                    {{ title ? title : t('labels.confirmation') }}
                  </h3>
                  <div class="mt-2 text-base text-zinc-600">
                    {{ message }}
                  </div>
                </div>
              </div>

              <div
                class="flex items-center justify-between bg-zinc-50 px-4 py-3"
              >
                <div class="flex-1 flex items-center justify-end space-x-3">
                  <button
                    v-if="buttons.no"
                    type="button"
                    class="tw-button sm gray transparent"
                    @click="answer(false)"
                  >
                    {{ buttons.no }}
                  </button>
                  <button
                    v-if="buttons.yes"
                    type="button"
                    class="tw-button sm"
                    @click="answer(true)"
                  >
                    {{ buttons.yes }}
                  </button>
                  <button
                    v-if="buttons.delete"
                    type="button"
                    class="tw-button red sm"
                    @click="answer(true)"
                  >
                    {{ buttons.delete }}
                  </button>
                </div>
              </div>
            </div>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script lang="ts">
import { defineComponent, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from './Store'

import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogOverlay,
  DialogTitle
} from '@headlessui/vue'

export default defineComponent({
  name: 'VueConfirm',

  components: {
    TransitionRoot,
    TransitionChild,
    Dialog,
    DialogOverlay,
    DialogTitle
  },

  setup(props) {
    const { t } = useI18n()
    const { state, answer, close } = useConfirm()

    return {
      t,
      ...toRefs(state),
      answer,
      close
    }
  }
})
</script>
