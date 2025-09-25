# @comfyorg/tailwind-utils

Shared Tailwind CSS utility functions for the ComfyUI Frontend monorepo.

## Usage

```typescript
import { cn } from '@comfyorg/tailwind-utils'

const className = cn('bg-red-500', condition && 'bg-blue-500')
```

The `cn` function combines `clsx` and `tailwind-merge` to handle conditional classes and resolve Tailwind conflicts.