import clsx, { type ClassArray } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue } from 'clsx'

export function cn(...inputs: ClassArray) {
  return twMerge(clsx(inputs))
}
