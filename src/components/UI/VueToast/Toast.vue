<template>
  <section
    v-if="list.length > 0"
    class="VueToast fixed z-[502] top-12 sm:right-0 p-2 sm:p-4 overflow-x-hidden overflow-y-auto max-h-screen w-full sm:max-w-lg"
  >
    <transition-group name="slide" tag="ul" class="space-y-2">
      <Item v-for="item in list" :key="item.id" :item="item" @remove="remove" />
    </transition-group>
  </section>
</template>

<script lang="ts">
import { defineComponent, toRefs } from 'vue'
import { useToast } from './Store'
import Item from './Item.vue'

export default defineComponent({
  name: 'VueToast',

  components: {
    Item
  },

  setup() {
    const { state, remove } = useToast()

    return {
      ...toRefs(state),
      remove
    }
  }
})
</script>
