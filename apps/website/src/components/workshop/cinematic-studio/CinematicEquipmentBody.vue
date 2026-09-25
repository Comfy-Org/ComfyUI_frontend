<script setup lang="ts">
import CinematicEquipmentFilm from './CinematicEquipmentFilm.vue'
import { computed } from 'vue'
const { option, metal, glass } = defineProps<{
  option: string
  metal: string
  glass: string
}>()
function selected<T>(choices: Readonly<Record<string, T>>, fallback: T): T {
  return choices[option] ?? fallback
}
const film = computed(() => option === 'film35' || option === 'film16')
const bodyPath = computed(() =>
  selected(
    {
      digital: 'M32 35 78 29 99 37V81H32Z',
      large: 'M22 30H91L108 40V85H22Z',
      super35: 'M38 38 84 32 103 43V80H38Z',
      film35: 'M30 45 85 39 104 48V85H30Z',
      film16: 'M45 38 85 32 99 43V79L80 86H45Z',
      handheld: 'M49 35 101 31 127 41V76L108 84H49Z'
    },
    'M33 37H57L65 27H91L100 37H126V84H33Z'
  )
)
const handlePath = computed(() =>
  selected(
    { handheld: 'M59 32V22H105L112 32', large: 'M37 28V17H86V28' },
    'M43 32V22H82V30'
  )
)
const sidePath = computed(() =>
  option === 'handheld' ? 'M101 35V78' : 'M84 35V81'
)
const screenX = computed(() => (option === 'large' ? 31 : 43))
const screenY = computed(() => (film.value ? 51 : 43))
const screenWidth = computed(() => (option === 'large' ? 42 : 30))
const mount = computed(() => {
  const mounts: Partial<
    Record<string, { path: string; width?: number; fill?: string }>
  > = {
    large: { path: 'M28 87H111M38 87V91M99 87V91', width: 3 },
    super35: { path: 'M39 83H100M55 84V89H83V84', width: 2 },
    film16: { path: 'M61 85 56 101H72L78 85', fill: metal }
  }
  return mounts[option]
})
</script>
<template>
  <g>
    <path d="M29 96H134" stroke-opacity="0.15" />
    <CinematicEquipmentFilm v-if="film" :option :metal :glass />
    <path v-else-if="option !== 'auto'" :d="handlePath" stroke-width="4" />
    <path :d="bodyPath" :fill="metal" />
    <template v-if="option === 'auto'">
      <rect
        x="42"
        y="46"
        width="13"
        height="5"
        rx="1"
        fill="currentColor"
        fill-opacity="0.6"
        stroke="none"
      />
      <circle cx="82" cy="61" r="25" class="fill-primary-comfy-ink" />
      <circle cx="82" cy="61" r="19" :fill="glass" />
      <circle cx="82" cy="61" r="12" stroke-opacity="0.35" />
      <path d="M72 50Q82 44 89 51" stroke-opacity="0.65" />
    </template>
    <template v-else>
      <path :d="sidePath" stroke-opacity="0.5" />
      <rect
        :x="screenX"
        :y="screenY"
        :width="screenWidth"
        height="22"
        rx="3"
        class="fill-primary-comfy-ink"
        stroke-opacity="0.7"
      />
      <path v-if="!film" d="M49 49H65M49 54H59M49 59H68" stroke-opacity="0.5" />
      <path
        v-if="mount"
        :d="mount.path"
        :stroke-width="mount.width"
        :fill="mount.fill"
      />
      <path
        v-if="option === 'handheld'"
        d="M49 43 20 36V71L49 78Z"
        :fill="metal"
      />
      <path
        v-if="option === 'handheld'"
        d="M43 48 26 44V65L43 70Z"
        class="fill-primary-comfy-ink"
      />
      <path v-else d="M32 42H20V52H32" :fill="metal" />
      <circle cx="49" cy="74" r="2.8" fill="currentColor" stroke="none" />
      <circle
        cx="60"
        cy="74"
        r="2"
        fill="currentColor"
        fill-opacity="0.6"
        stroke="none"
      />
      <path d="M98 44H126V76H98Z" :fill="metal" />
      <path
        v-for="n in 5"
        :key="n"
        :d="`M${100 + n * 4} 46V74`"
        stroke-opacity="0.5"
      />
      <ellipse
        cx="128"
        cy="60"
        rx="12"
        ry="22"
        class="fill-primary-comfy-ink"
      />
      <ellipse cx="129" cy="60" rx="8" ry="16" :fill="glass" />
      <path d="M127 48Q132 46 134 53" stroke-opacity="0.75" />
    </template>
  </g>
</template>
