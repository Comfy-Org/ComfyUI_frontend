<script setup lang="ts">
import {
  CircleAlert,
  CircleStop,
  Film,
  LoaderCircle,
  ShieldAlert
} from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
const { take } = defineProps<{ take: Take }>()
const blocked = (take: Take) =>
  take.status === 'failed' &&
  (take.reason === 'policy' || take.reason === 'validation')
</script>

<template>
  <img
    v-if="take.status === 'done' && take.output.kind === 'image'"
    :src="take.output.url"
    alt=""
    :class="cn('size-full object-cover', take.output.nsfw && 'blur-md')"
  />
  <Film
    v-else-if="take.status === 'done'"
    class="size-4 text-primary-comfy-canvas"
    aria-hidden="true"
  />
  <LoaderCircle
    v-else-if="take.status === 'rendering'"
    class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
    aria-hidden="true"
  />
  <CircleStop
    v-else-if="take.status === 'cancelled'"
    class="size-4 text-primary-comfy-canvas"
    aria-hidden="true"
  />
  <ShieldAlert
    v-else-if="blocked(take)"
    class="size-4 text-primary-comfy-orange"
    aria-hidden="true"
  />
  <CircleAlert
    v-else
    class="size-4 text-primary-comfy-red"
    aria-hidden="true"
  />
</template>
