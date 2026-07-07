import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind class lists with correct conflict resolution (later wins). The one
// class-merge helper all panel components use, mirroring the host's cn().
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
