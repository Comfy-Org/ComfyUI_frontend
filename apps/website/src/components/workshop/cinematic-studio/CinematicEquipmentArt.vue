<script setup lang="ts">
import { computed, useId } from 'vue'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'

const { part, option } = defineProps<{ part: DirectionPart; option: string }>()
const id = useId()
const metal = `url(#${id}-metal)`
const glass = `url(#${id}-glass)`
function selected<T>(choices: Readonly<Record<string, T>>, fallback: T): T {
  return choices[option] ?? fallback
}
const film = computed(() => option === 'film35' || option === 'film16')
const iris = computed(() =>
  selected({ '1.4': 25, '2': 21, '2.8': 17, '4': 12, '8': 6 }, 18)
)
const focalSpread = computed(() =>
  selected({ '14': 43, '24': 35, '35': 28, '50': 21, '85': 14, '135': 9 }, 30)
)
const barrelStart = computed(() =>
  option === 'macro' ? 24 : option === 'vintage' ? 52 : 38
)
const lensHeight = computed(() =>
  option === 'anamorphic' ? 33 : option === 'vintage' ? 23 : 28
)
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
</script>

<template>
  <svg
    viewBox="0 0 160 112"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linejoin="round"
    stroke-linecap="round"
    class="text-primary-comfy-canvas"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        :id="`${id}-metal`"
        x1="0"
        y1="0"
        x2="0.35"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        <stop stop-color="currentColor" stop-opacity="0.65" />
        <stop offset="0.38" stop-color="currentColor" stop-opacity="0.23" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0.08" />
      </linearGradient>
      <radialGradient :id="`${id}-glass`" cx="0.35" cy="0.3">
        <stop stop-color="currentColor" stop-opacity="0.32" />
        <stop offset="0.5" stop-color="currentColor" stop-opacity="0.08" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>

    <g v-if="part === 'body'">
      <path d="M29 96H134" stroke-opacity="0.15" />
      <g v-if="film">
        <path
          v-if="option === 'film35'"
          d="M37 43C18 18 38 5 57 15L77 27C97 9 119 29 100 46Z"
          :fill="metal"
        />
        <path v-else d="M48 39C31 17 52 7 67 18L82 28 95 38Z" :fill="metal" />
        <circle
          :cx="option === 'film35' ? 46 : 56"
          cy="27"
          :r="option === 'film35' ? 12 : 10"
          :fill="glass"
        />
        <circle
          v-if="option === 'film35'"
          cx="92"
          cy="33"
          r="11"
          :fill="glass"
        />
        <circle
          :cx="option === 'film35' ? 46 : 56"
          cy="27"
          r="3"
          fill="currentColor"
          stroke="none"
        />
        <circle
          v-if="option === 'film35'"
          cx="92"
          cy="33"
          r="3"
          fill="currentColor"
          stroke="none"
        />
      </g>
      <path
        v-else-if="option !== 'auto'"
        :d="
          option === 'handheld'
            ? 'M59 32V22H105L112 32'
            : option === 'large'
              ? 'M37 28V17H86V28'
              : 'M43 32V22H82V30'
        "
        stroke-width="4"
      />
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
        <path
          :d="option === 'handheld' ? 'M101 35V78' : 'M84 35V81'"
          stroke-opacity="0.5"
        />
        <rect
          :x="option === 'large' ? 31 : 43"
          :y="film ? 51 : 43"
          :width="option === 'large' ? 42 : 30"
          height="22"
          rx="3"
          class="fill-primary-comfy-ink"
          stroke-opacity="0.7"
        />
        <path
          v-if="!film"
          d="M49 49H65M49 54H59M49 59H68"
          stroke-opacity="0.5"
        />
        <path
          v-if="option === 'large'"
          d="M28 87H111M38 87V91M99 87V91"
          stroke-width="3"
        />
        <path
          v-if="option === 'super35'"
          d="M39 83H100M55 84V89H83V84"
          stroke-width="2"
        />
        <path
          v-if="option === 'film16'"
          d="M61 85 56 101H72L78 85"
          :fill="metal"
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

    <g
      v-else-if="part === 'lens'"
      :transform="option === 'tilt' ? 'rotate(-11 80 58)' : undefined"
    >
      <path d="M24 97H137" stroke-opacity="0.15" />
      <template v-if="option === 'auto'">
        <circle cx="80" cy="57" r="35" :fill="metal" />
        <circle cx="80" cy="57" r="28" class="fill-primary-comfy-ink" />
        <circle cx="80" cy="57" r="22" :fill="glass" />
        <circle cx="80" cy="57" r="14" stroke-opacity="0.4" />
        <path d="M68 44Q80 35 91 44" stroke-opacity="0.7" />
      </template>
      <template v-else>
        <ellipse
          :cx="barrelStart"
          cy="58"
          rx="8"
          :ry="lensHeight - 3"
          :fill="metal"
        />
        <path
          :d="`M${barrelStart} ${61 - lensHeight}H112V${55 + lensHeight}H${barrelStart}Z`"
          :fill="metal"
        />
        <path
          v-for="n in 7"
          :key="n"
          :d="`M${barrelStart + 5 + n * 3} ${64 - lensHeight}V${52 + lensHeight}`"
          stroke-opacity="0.5"
        />
        <path
          :d="`M100 ${58 - lensHeight}V${58 + lensHeight}`"
          stroke-width="4"
          stroke-opacity="0.7"
        />
        <ellipse
          cx="114"
          cy="58"
          :rx="option === 'anamorphic' ? 16 : 13"
          :ry="lensHeight"
          class="fill-primary-comfy-ink"
        />
        <ellipse
          cx="115"
          cy="58"
          :rx="option === 'anamorphic' ? 9 : 8"
          :ry="lensHeight - 7"
          :fill="glass"
        />
        <path
          :d="`M112 ${65 - lensHeight}Q120 ${62 - lensHeight} 121 ${72 - lensHeight}`"
          stroke-opacity="0.8"
        />
        <path
          v-if="option === 'anamorphic'"
          d="M105 58H126"
          stroke-opacity="0.55"
        />
        <path v-if="option === 'vintage'" d="M59 82H87V90H65Z" :fill="metal" />
        <path
          v-if="option === 'macro'"
          d="M28 22H93M28 19V25M93 19V25M42 22V25M57 22V25M72 22V25"
          stroke-opacity="0.65"
        />
        <g v-if="option === 'tilt'">
          <path
            d="M78 26V90M84 27V89M72 32 92 29M72 86 92 89"
            stroke-width="2"
          />
          <rect x="73" y="18" width="15" height="8" rx="2" :fill="metal" />
        </g>
        <path
          v-if="option === 'prime'"
          d="M59 24H87M65 21V27M79 21V27"
          stroke-opacity="0.7"
        />
      </template>
    </g>

    <g v-else-if="part === 'aperture'">
      <circle cx="80" cy="56" r="41" :fill="metal" />
      <circle cx="80" cy="56" r="35" stroke-opacity="0.65" />
      <path
        v-for="n in 8"
        :key="n"
        :transform="`rotate(${n * 45} 80 56)`"
        :d="`M80 21Q109 24 ${80 + iris} 56L${80 + iris * 0.707} ${56 + iris * 0.707}`"
        stroke-opacity="0.75"
      />
      <circle
        cx="80"
        cy="56"
        :r="iris"
        class="fill-primary-comfy-ink"
        stroke-opacity="0.8"
      />
      <circle cx="80" cy="56" :r="iris - 2" :fill="glass" stroke="none" />
      <path
        v-for="n in 16"
        :key="`rim-${n}`"
        :transform="`rotate(${n * 22.5} 80 56)`"
        d="M80 17V19"
        stroke-opacity="0.65"
      />
    </g>

    <g v-else-if="part === 'focal'">
      <path
        :d="`M45 56 133 ${56 - focalSpread}V${56 + focalSpread}Z`"
        fill="currentColor"
        fill-opacity="0.07"
        stroke-opacity="0.5"
      />
      <path d="M46 56H137" stroke-dasharray="3 4" stroke-opacity="0.35" />
      <path
        :d="`M136 ${56 - focalSpread}H143M140 ${56 - focalSpread}V${56 + focalSpread}M136 ${56 + focalSpread}H143`"
        stroke-opacity="0.75"
      />
      <path d="M20 43H37V69H20Z" :fill="metal" />
      <path d="M28 43V69" stroke-opacity="0.5" />
      <ellipse cx="42" cy="56" rx="7" ry="19" class="fill-primary-comfy-ink" />
      <ellipse cx="43" cy="56" rx="4" ry="13" :fill="glass" />
      <path d="M25 73V79H47" stroke-opacity="0.5" />
      <path
        :d="`M68 ${56 - focalSpread * 0.26}Q${74 + focalSpread * 0.2} 56 68 ${56 + focalSpread * 0.26}`"
        stroke-opacity="0.5"
      />
    </g>
    <g v-else>
      <rect x="41" y="27" width="78" height="58" rx="8" :fill="metal" />
      <path d="M54 42V36H66M106 42V36H94M54 70V76H66M106 70V76H94" />
      <circle cx="80" cy="56" r="14" :fill="glass" />
    </g>
    <path
      v-if="option === 'auto'"
      d="M132 15 134 22 141 24 134 26 132 33 130 26 123 24 130 22Z"
      fill="currentColor"
      fill-opacity="0.7"
      stroke="none"
    />
  </svg>
</template>
