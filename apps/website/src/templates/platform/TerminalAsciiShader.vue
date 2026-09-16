<script setup lang="ts">
import { Ascii, Shader, ThinFilm } from 'shaders/vue'

const blobCenter = { x: 0.5, y: 0 }
const blobShape = {
  type: 'blob3D',
  radius: 0.85,
  wobble: 0.12,
  wobbliness: 5,
  speed: 0.6,
  rotX: 0,
  rotY: 0,
  rotZ: 0
}
</script>

<template>
  <Shader tone-mapping="aces" class="block size-full">
    <Ascii characters="@#8960543271">
      <ThinFilm
        mode="custom"
        color-a="#f2ff59"
        color-b="#49378b"
        color-c="#fabc25"
        :center="blobCenter"
        :scale="1.5"
        :shape="blobShape"
        shape-type="blob3D"
        :intensity="1.77"
        :rim-width="2.1"
        :thickness="0.64"
        :dispersion="0.7"
        :edge-softness="0.35"
        :speed="0.25"
      />
    </Ascii>
  </Shader>
</template>
