# @comfyorg/tailwind-utils

A minimal utility package for shared Tailwind CSS functions used across the ComfyUI Frontend monorepo.

## Purpose

This package provides centralized Tailwind CSS utility functions to ensure consistent class name handling across all applications and packages in the ComfyUI Frontend workspace.

## Installation

This package is part of the ComfyUI Frontend monorepo and is automatically available to all workspace packages.

```json
{
  "dependencies": {
    "@comfyorg/tailwind-utils": "workspace:*"
  }
}
```

## Usage

```typescript
import { cn } from '@comfyorg/tailwind-utils'

// Merge class names with proper Tailwind CSS conflict resolution
const className = cn(
  'bg-red-500',
  condition && 'bg-blue-500',
  'text-white p-4'
)
```

## API

### `cn(...inputs: ClassArray): string`

Combines class names using `clsx` for conditional classes and `tailwind-merge` for proper Tailwind CSS class conflict resolution.

- **Parameters**: Any number of class values (strings, objects, arrays, etc.)
- **Returns**: A single string of merged class names with conflicts resolved

## Features

- **Conflict Resolution**: Automatically handles Tailwind CSS class conflicts (e.g., `bg-red-500` overrides `bg-blue-500`)
- **Conditional Classes**: Supports conditional class application through `clsx`
- **Type Safety**: Full TypeScript support with exported types
- **Zero Config**: Works out of the box with no configuration needed

## Dependencies

- `clsx`: For flexible class name construction
- `tailwind-merge`: For intelligent Tailwind CSS class merging

## License

GPL-3.0-only - See the root LICENSE file for details.