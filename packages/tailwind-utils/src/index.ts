import { clsx } from 'clsx'
import type { ClassArray } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

export type { ClassValue } from 'clsx'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-xxs', 'text-xxxs'],
      // tailwind-merge does not know Tailwind's `max-h-none`, so it never
      // resolves conflicts like `max-h-[80vh] max-h-none` (both survive).
      'max-h': [{ 'max-h': ['none'] }]
    }
  }
})

export function cn(...inputs: ClassArray) {
  return twMerge(clsx(inputs))
}
