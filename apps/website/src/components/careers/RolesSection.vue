<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Department } from '../../data/roles'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import CategoryNav from '../common/CategoryNav.vue'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en', departments = [] } = defineProps<{
  locale?: Locale
  departments?: readonly Department[]
}>()

const activeCategory = ref('all')

const categories = computed(() => [
  { label: 'ALL', value: 'all' },
  ...departments.map((d) => ({ label: d.name, value: d.key }))
])

const filteredDepartments = computed(() =>
  activeCategory.value === 'all'
    ? departments
    : departments.filter((d) => d.key === activeCategory.value)
)

const hasRoles = computed(() => departments.some((d) => d.roles.length > 0))
</script>

<template>
  <section class="px-6 py-20 md:px-20 md:py-32" data-testid="careers-roles">
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-12 md:flex-row md:gap-20">
        <div class="shrink-0 md:w-48">
          <div
            class="bg-primary-comfy-ink sticky top-20 z-10 py-4 md:top-28 md:py-0"
          >
            <h2
              class="text-primary-comfy-canvas text-3xl font-light md:text-4xl"
            >
              {{ t('careers.roles.heading', locale) }}
            </h2>
            <CategoryNav
              v-if="hasRoles"
              v-model="activeCategory"
              :categories="categories"
              class="mt-4"
            />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <p
            v-if="!hasRoles"
            class="text-primary-warm-gray text-base md:text-lg"
            data-testid="careers-roles-empty"
          >
            {{ t('careers.roles.empty', locale) }}
          </p>

          <div
            v-for="dept in filteredDepartments"
            :key="dept.key"
            class="mb-12 last:mb-0"
          >
            <SectionLabel>
              {{ dept.name }}
            </SectionLabel>

            <a
              v-for="role in dept.roles"
              :key="role.id"
              :href="role.applyUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="border-primary-warm-gray/20 group flex items-center justify-between border-b py-5"
              data-testid="careers-role-link"
            >
              <div class="min-w-0">
                <span
                  class="text-primary-comfy-canvas text-base font-medium md:text-lg"
                >
                  {{ role.title }}
                </span>
                <span class="text-primary-warm-gray ml-3 text-sm">
                  {{ role.department }}
                </span>
              </div>
              <div class="ml-4 flex shrink-0 items-center gap-3">
                <span class="text-primary-warm-gray text-sm">
                  {{ role.location }}
                </span>
                <img
                  src="/icons/arrow-up-right.svg"
                  alt=""
                  class="size-5"
                  aria-hidden="true"
                />
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
