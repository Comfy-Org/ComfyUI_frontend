# Keybinding Domain DDD Refactoring

## Overview

This document outlines the refactoring of ComfyUI's keybinding functionality from technical layers to domain-driven design (DDD) following VSCode's proven three-layer architecture.

## Architecture

### Three-Layer Design

Following VSCode's enterprise-grade architecture:

1. **Base Layer** - Foundational utilities (no dependencies)
2. **Platform Layer** - Core abstractions (reusable across frontends)  
3. **Workbench Layer** - UI-specific implementation

### Final Structure

```
src/
├── base/keybinding/                           # Base Layer
│   └── reservedKeyCombos.ts                  # Reserved key combinations
│
├── platform/keybinding/                      # Platform Layer
│   ├── constants/
│   │   └── coreKeybindings.ts               # Core keybinding definitions
│   └── types/
│       └── keybinding.ts                    # Schema types and interfaces
│
└── workbench/keybindings/                    # Workbench Layer
    ├── components/                           # UI Components
    │   ├── KeybindingPanel.vue              # Settings panel
    │   ├── KeyComboDisplay.vue              # Key display component
    │   └── shortcuts/                       # Shortcuts panel
    │       ├── EssentialsPanel.vue
    │       ├── ShortcutsList.vue
    │       └── ViewControlsPanel.vue
    ├── composables/
    │   └── useShortcutsTab.ts               # UI logic
    ├── services/
    │   └── keybindingService.ts             # Service implementation
    └── stores/
        └── keybindingStore.ts               # State management
```

## Migration Summary

### Before (Technical Layers)
- `services/keybindingService.ts`
- `stores/keybindingStore.ts`
- `constants/coreKeybindings.ts`
- `schemas/keyBindingSchema.ts`
- `components/dialog/content/setting/KeybindingPanel.vue`
- `components/bottomPanel/tabs/shortcuts/`
- `composables/bottomPanelTabs/useShortcutsTab.ts`

### After (Domain-Driven)
All keybinding functionality organized by architectural layer and domain responsibility.

## Key Import Paths

```typescript
// Platform types and constants
import type { Keybinding, KeyCombo } from '@/platform/keybinding/types/keybinding'
import { CORE_KEYBINDINGS } from '@/platform/keybinding/constants/coreKeybindings'

// Base utilities
import { RESERVED_BY_TEXT_INPUT } from '@/base/keybinding/reservedKeyCombos'

// Workbench services
import { useKeybindingService } from '@/workbench/keybindings/services/keybindingService'
import { 
  KeyComboImpl, 
  KeybindingImpl, 
  useKeybindingStore 
} from '@/workbench/keybindings/stores/keybindingStore'

// UI components
import KeybindingPanel from '@/workbench/keybindings/components/KeybindingPanel.vue'
import { useShortcutsTab } from '@/workbench/keybindings/composables/useShortcutsTab'
```

## Benefits

### 1. Clear Architectural Boundaries
- **Base**: Reusable across any JavaScript environment
- **Platform**: Reusable across any UI framework  
- **Workbench**: Vue/PrimeVue specific implementation

### 2. Frontend Flexibility
The base + platform layers enable building alternative frontends (React, Angular, etc.) while reusing core keybinding logic.

### 3. VSCode Alignment
Follows the same proven patterns used by one of the most successful code editors, ensuring scalability and maintainability.

### 4. Domain Cohesion
All keybinding-related functionality is now located together, making it easier to:
- Find related code
- Make changes across the domain
- Test domain functionality
- Understand feature scope

### 5. Dependency Management
Clear dependency flow: `base/` ← `platform/` ← `workbench/`

## Migration Process

1. ✅ **Analysis**: Identified all keybinding-related files
2. ✅ **Structure Creation**: Built three-layer directory structure
3. ✅ **File Migration**: Moved files to appropriate layers
4. ✅ **Import Updates**: Updated all import paths using `@` aliases
5. ✅ **Testing**: Verified TypeScript compilation and linting
6. ✅ **Cleanup**: Removed old files and empty directories

## Quality Assurance

- **TypeScript**: `pnpm typecheck` passes
- **Code Quality**: `pnpm lint --fix` applied
- **Testing**: All test imports updated
- **No Breaking Changes**: All functionality preserved

## Future Considerations

### Potential Enhancements
- Add platform-level abstractions as needed
- Create additional keybinding editor components
- Consider splitting large components into smaller, focused ones

### Extension Points
- New UI components can be added to `workbench/keybindings/components/`
- Platform-level services can be extended in `platform/keybinding/`
- Base utilities can be enhanced in `base/keybinding/`

This refactoring establishes a solid foundation for future keybinding feature development while maintaining backward compatibility and improving code organization.