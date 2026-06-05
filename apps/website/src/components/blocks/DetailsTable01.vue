<script setup lang="ts">
type Row = { id: string; label: string; value: string }

defineProps<{
  heading: string
  headerLabel: string
  headerValue: string
  rows: readonly Row[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <div class="mx-auto max-w-3xl">
      <div class="hidden md:block">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-primary-comfy-canvas/20">
              <th
                scope="col"
                class="text-primary-comfy-yellow py-4 pr-6 text-xs font-bold tracking-widest uppercase"
              >
                {{ headerLabel }}
              </th>
              <th
                scope="col"
                class="text-primary-comfy-yellow py-4 text-xs font-bold tracking-widest uppercase"
              >
                {{ headerValue }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-primary-comfy-canvas/10"
            >
              <th
                scope="row"
                class="py-5 pr-6 text-base font-light text-primary-comfy-canvas"
              >
                {{ row.label }}
              </th>
              <td class="py-5 text-base text-primary-comfy-canvas/80">
                {{ row.value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="flex flex-col gap-6 md:hidden">
        <div
          v-for="row in rows"
          :key="row.id"
          class="flex flex-col gap-1 border-b border-primary-comfy-canvas/10 pb-4"
        >
          <dt
            class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
          >
            {{ row.label }}
          </dt>
          <dd class="text-base text-primary-comfy-canvas">
            {{ row.value }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
