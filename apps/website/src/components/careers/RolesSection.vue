<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import CategoryNav from '../common/CategoryNav.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const activeCategory = ref('all')

interface Role {
  title: string
  department: string
  location: string
  id: string
}

interface Department {
  name: string
  key: string
  roles: Role[]
}

const departments: Department[] = [
  {
    name: 'ENGINEERING',
    key: 'engineering',
    roles: [
      {
        title: 'Design Engineer',
        department: 'Engineering',
        location: 'San Francisco',
        id: 'abc787b9-ad85-421c-8218-debd23bea096'
      },
      {
        title: 'Software Engineer',
        department: 'Engineering',
        location: 'San Francisco',
        id: '99dc26c7-51ca-43cd-a1ba-7d475a0f4a40'
      },
      {
        title: 'Product Manager',
        department: 'Engineering',
        location: 'London, UK',
        id: '12dbc26e-9f6d-49bf-83c6-130f7566d03c'
      },
      {
        title: 'Tech Lead Manager, Frontend',
        department: 'Engineering',
        location: 'San Francisco',
        id: 'a0665088-3314-457a-aa7b-12ca5c3eb261'
      }
    ]
  },
  {
    name: 'DESIGN',
    key: 'design',
    roles: [
      {
        title: 'Creative Director',
        department: 'Design',
        location: 'San Francisco',
        id: '49fa0b07-3fa1-4a3a-b2c6-d2cc684ad63f'
      },
      {
        title: 'Graphic Designer',
        department: 'Design',
        location: 'London, UK',
        id: '19ba10aa-4961-45e8-8473-66a8a7a8079d'
      },
      {
        title: 'Freelance Motion Designer',
        department: 'Design',
        location: 'Remote',
        id: 'a7ccc2b4-4d9d-4e04-b39c-28a711995b5b'
      }
    ]
  },
  {
    name: 'MARKETING',
    key: 'marketing',
    roles: [
      {
        title: 'Lifecycle Growth Marketer',
        department: 'Marketing',
        location: 'San Francisco',
        id: 'be74d210-3b50-408c-9f61-8fee8833ce64'
      },
      {
        title: 'Graphic Designer',
        department: 'Marketing',
        location: 'London, UK',
        id: '28dea965-662b-4786-b024-c9a1b6bc1f23'
      }
    ]
  }
]

const categories = computed(() => [
  { label: 'ALL', value: 'all' },
  ...departments.map((d) => ({ label: d.name, value: d.key }))
])

const filteredDepartments = computed(() =>
  activeCategory.value === 'all'
    ? departments
    : departments.filter((d) => d.key === activeCategory.value)
)
</script>

<template>
  <section class="px-6 py-20 md:px-20 md:py-32">
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-12 md:flex-row md:gap-20">
        <!-- Left sidebar -->
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
              v-model="activeCategory"
              :categories="categories"
              class="mt-4"
            />
          </div>
        </div>

        <!-- Role listings -->
        <div class="min-w-0 flex-1">
          <div
            v-for="dept in filteredDepartments"
            :key="dept.key"
            class="mb-12 last:mb-0"
          >
            <h3
              class="text-primary-comfy-yellow text-xs font-semibold tracking-widest"
            >
              {{ dept.name }}
            </h3>

            <a
              v-for="role in dept.roles"
              :key="role.id"
              :href="`https://jobs.ashbyhq.com/comfy-org/${role.id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="border-primary-warm-gray/20 group flex items-center justify-between border-b py-5"
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
