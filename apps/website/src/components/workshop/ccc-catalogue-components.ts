import type { Component, InjectionKey } from 'vue'

export const cccCatalogueComponents: InjectionKey<{
  catalogue: Component
  workflows: Component
  apps: Component
}> = Symbol('ccc-catalogue-components')
