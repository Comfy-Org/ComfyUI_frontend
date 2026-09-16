import { clsx } from 'clsx'
import type { ClassArray } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-xxs', 'text-xxxs'],
      // tailwind-merge does not know `max-h-none`, so `max-h-[80vh] max-h-none` would keep both
      'max-h': [{ 'max-h': ['none'] }]
    }
  }
})

export function cn(...inputs: ClassArray): string {
  return twMerge(clsx(inputs))
}
