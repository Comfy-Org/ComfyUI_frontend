import { clsx } from 'clsx'
import type { ClassArray } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

export type { ClassValue } from 'clsx'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-xxs', 'text-xxxs']
    }
  }
})

export function cn(...inputs: ClassArray) {
  return twMerge(clsx(inputs))
}
