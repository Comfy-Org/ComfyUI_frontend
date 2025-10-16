# Keyboard Shortcut System Research & Implementation

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Current Implementation (Main Branch)](#current-implementation-main-branch)
3. [Problems with Current Implementation](#problems-with-current-implementation)
4. [Event.key vs Event.code: Technical Analysis](#eventkey-vs-eventcode-technical-analysis)
5. [Proposed Solution](#proposed-solution)
6. [Implementation Details](#implementation-details)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)
9. [Related Work](#related-work)

---

## Problem Statement

### Issue #5252: Keyboard Shortcuts Don't Work on Non-English Keyboard Layouts

**Reported Problem:**
Users with non-English (non-Latin) keyboard layouts cannot use keyboard shortcuts in ComfyUI. For example:
- Pressing the physical `R` key on a Russian keyboard produces the Cyrillic character "к" instead of "r"
- `Ctrl+S` (save) doesn't work because the system receives "Ctrl+ы" instead
- All single-key shortcuts (`R`, `Q`, `W`, `N`, etc.) fail to work

**Impact:**
- Application is unusable for international users who use non-Latin keyboard layouts
- Affects users in Russia, China, Japan, Korea, Greece, Arabic-speaking countries, and many others
- Forces users to switch to English keyboard layout to use the application

**Root Cause:**
The keybinding system uses `event.key` which returns different values depending on the active keyboard layout, while shortcuts are defined using English characters.

---

## Current Implementation (Main Branch)

### Architecture Overview

The keyboard shortcut system consists of three main components:

1. **KeyComboImpl** (`src/stores/keybindingStore.ts`): Represents a key combination
2. **KeybindingImpl** (`src/stores/keybindingStore.ts`): Associates a key combo with a command
3. **KeybindingService** (`src/services/keybindingService.ts`): Handles keyboard events and executes commands

### How It Works (Main Branch)

#### 1. Key Event Capture

```typescript
// src/stores/keybindingStore.ts (main branch)
static fromEvent(event: KeyboardEvent) {
  return new KeyComboImpl({
    key: event.key,  // ← Uses event.key (layout-dependent)
    ctrl: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  })
}
```

**What happens:**
- User presses physical key `R` on Russian layout
- `event.key` returns "к" (Cyrillic character)
- System looks for keybinding with key "к"
- No match found (keybinding is registered with "r")

#### 2. Keybinding Registration

```typescript
// src/constants/coreKeybindings.ts (main branch)
{
  combo: {
    key: 'r'  // ← Defined using lowercase 'r'
  },
  commandId: 'Comfy.RefreshNodeDefinitions'
}
```

**Comparison Logic:**
```typescript
equals(other: unknown): boolean {
  return this.key.toUpperCase() === raw.key.toUpperCase() &&
         this.ctrl === raw.ctrl &&
         this.alt === raw.alt &&
         this.shift === raw.shift
}
```

The system compares using `toUpperCase()`, but this doesn't help when `event.key` returns a completely different character from a different alphabet.

#### 3. Event Flow

```
User Presses Key → KeyboardEvent Generated → KeyComboImpl.fromEvent()
→ event.key extracted → Lookup in keybinding store → Command execution
```

### Data Structures

**Main Branch Schema:**
```typescript
interface KeyCombo {
  key: string        // The character/key name from event.key
  ctrl?: boolean     // Ctrl or Cmd modifier
  alt?: boolean      // Alt/Option modifier
  shift?: boolean    // Shift modifier
}
```

**Example Keybindings:**
```typescript
// Letter keys: lowercase
{ key: 'r' }
{ key: 'q' }
{ key: 'w' }

// Special keys: proper case
{ key: 'Enter' }
{ key: 'Escape' }

// Punctuation: as-is
{ key: '=' }
{ key: '-' }
```

---

## Problems with Current Implementation

### 1. **Keyboard Layout Dependency (Primary Issue)**

**Problem:** `event.key` returns different values based on keyboard layout.

| Physical Key | QWERTY (English) | Russian | German (QWERTZ) | French (AZERTY) |
|--------------|------------------|---------|-----------------|-----------------|
| Top-left letter | Q | Й | Q | A |
| Next to Q | W | Ц | W | Z |
| Third letter | E | У | E | E |
| Below Q | A | Ф | A | Q |
| Below W | S | Ы | S | S |

**Example Failure:**
```typescript
// Keybinding registered as:
{ key: 'r', commandId: 'Comfy.RefreshNodeDefinitions' }

// User presses R key on Russian keyboard:
event.key = 'к'  // Cyrillic 'k'
event.code = 'KeyR'  // Physical key position

// Lookup fails because 'к' !== 'r'
```

### 2. **Case Sensitivity Issues**

**Problem:** Inconsistent handling of uppercase/lowercase.

```typescript
// Registration uses lowercase
{ key: 'r' }

// But event.key can be uppercase with Shift
event.key = 'R'  // With Shift pressed

// System uses toUpperCase() for comparison
// This works for English but not for all layouts
```

### 3. **Special Key Inconsistency**

**Problem:** Mixed conventions for special keys.

```typescript
// Some use event.key format:
event.key === 'Escape'  // In keybindingService.ts line 39, 62

// Others use event.code format in definitions:
{ key: 'Enter' }  // Works because Enter is same in both
```

### 4. **No Migration Path**

**Problem:** Changing from `event.key` to `event.code` breaks existing user keybindings.

User settings store keybindings in old format:
```typescript
// User's custom keybinding (stored in settings)
{
  combo: { key: 'a', ctrl: true },
  commandId: 'MyCustomCommand'
}

// After switching to event.code, this won't match:
// event.code = 'KeyA'  (new)
// stored key = 'a'      (old)
```

All users will lose their custom keybindings after the update.

### 5. **Extension Compatibility**

**Problem:** Extensions register keybindings using the old format.

```typescript
// Extension code (current)
api.registerKeybinding({
  combo: { key: 'g', ctrl: true },
  commandId: 'MyExtension.SomeCommand'
})
```

Switching to `event.code` without migration breaks all extension keybindings.

---

## Event.key vs Event.code: Technical Analysis

### What is `event.key`?

**Definition:** The actual character or key value being produced, taking into account keyboard layout, shift state, and other modifiers.

**Purpose:** Best for **text input** - when you care about what character the user is typing.

**Characteristics:**
- **Layout-dependent:** Returns different values based on active keyboard layout
- **Shift-sensitive:** Returns uppercase letters when Shift is pressed
- **Localized:** Returns localized characters (Cyrillic, Arabic, Chinese, etc.)
- **Character-oriented:** Represents what would be typed in a text field

**Examples:**

| Keyboard Layout | Physical Key | event.key (no Shift) | event.key (with Shift) |
|-----------------|--------------|----------------------|------------------------|
| US QWERTY | S | s | S |
| Russian | S | ы | Ы |
| Greek | S | σ | Σ |
| Arabic | S | س | ش |

**Advantages:**
- Natural for text input
- Shows what user "means" to type
- Works with IME (Input Method Editor) for Asian languages

**Disadvantages for Shortcuts:**
- Breaks keyboard shortcuts on non-English layouts
- Inconsistent across keyboard layouts
- Requires users to think about layout when defining shortcuts

### What is `event.code`?

**Definition:** The physical key being pressed on the keyboard, regardless of keyboard layout, shift state, or other modifiers.

**Purpose:** Best for **keyboard shortcuts** - when you care about which physical key was pressed.

**Characteristics:**
- **Layout-independent:** Always returns the same value regardless of keyboard layout
- **Shift-insensitive:** Returns the same value whether Shift is pressed or not
- **Physical:** Represents the physical key position on the keyboard
- **Position-oriented:** Based on standard US QWERTY key positions

**Examples:**

| Keyboard Layout | Physical Key | event.code | Notes |
|-----------------|--------------|------------|-------|
| US QWERTY | S | KeyS | Standard |
| Russian | S | KeyS | Same physical key |
| Greek | S | KeyS | Same physical key |
| Arabic | S | KeyS | Same physical key |
| French AZERTY | S | KeyS | Same physical key |

**Standard `event.code` Values:**

```typescript
// Letter keys
'KeyA' through 'KeyZ'

// Digit keys (top row)
'Digit0' through 'Digit9'

// Function keys
'F1' through 'F12'

// Special keys (same in both event.key and event.code)
'Enter', 'Escape', 'Tab', 'Space', 'Backspace', 'Delete'

// Arrow keys
'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'

// Modifiers (with left/right distinction)
'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'

// Punctuation (based on US QWERTY positions)
'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
'Semicolon', 'Quote', 'Backquote', 'Comma', 'Period', 'Slash'
```

**Advantages for Shortcuts:**
- Consistent across all keyboard layouts
- User muscle memory works regardless of layout
- Standard way to define keyboard shortcuts
- Used by most professional applications (VS Code, Chrome DevTools, etc.)

**Disadvantages:**
- Less intuitive for text input
- Need to map codes to display names for UI
- Punctuation keys labeled by US QWERTY positions

### Comparison Table

| Aspect | event.key | event.code |
|--------|-----------|-----------|
| **Purpose** | Text input | Keyboard shortcuts |
| **Layout** | Dependent | Independent |
| **Shift state** | Affects value | No effect |
| **Consistency** | Varies by layout | Always consistent |
| **Display** | Ready for display | Needs mapping |
| **Example (S key)** | 's', 'S', 'ы', 'Ы', 'σ', etc. | 'KeyS' |
| **Best for** | Typing text | Application commands |

### Real-World Examples

#### VS Code (uses `event.code`)
```typescript
// VS Code keybinding definition
{
  "key": "ctrl+s",          // Display
  "command": "workbench.action.files.save"
}

// Internally uses event.code for matching
// Works on all keyboard layouts
```

#### Browser DevTools (uses `event.code`)
```typescript
// Ctrl+Shift+I opens DevTools
// Works regardless of keyboard layout
// Uses physical key positions
```

#### Slack (uses `event.code`)
```typescript
// Ctrl+K opens quick switcher
// Works on Russian, Arabic, Chinese keyboards
// Based on physical key position
```

### Why `event.code` is the Right Choice

1. **International Support:** Works for users worldwide without forcing them to switch layouts
2. **Muscle Memory:** Users can rely on physical key positions
3. **Industry Standard:** Used by VS Code, Chrome, Figma, and other professional tools
4. **Consistency:** Same shortcut works the same way everywhere
5. **Predictability:** Shortcuts behave the same regardless of OS language

### Edge Cases

#### 1. Non-Standard Keyboards
- **Dvorak/Colemak:** Physical positions differ, but `event.code` still based on QWERTY
- **Solution:** Allow users to remap shortcuts if needed
- **Impact:** Small percentage of users, worth the tradeoff

#### 2. Punctuation Keys
- **Problem:** Punctuation varies greatly across layouts
- **Example:** US QWERTY `-` is at different position on other layouts
- **Solution:** Use `event.code` ('Minus') for consistency
- **Display:** Show the symbol from current layout in UI

#### 3. Special Characters
- **Problem:** Keys like `[`, `]`, `\` may not exist on some keyboards
- **Solution:** Avoid using them for core shortcuts, allow user customization
- **Alternative:** Use modifier+letter combinations which are universal

---

## Proposed Solution

### Core Principle

**Use `event.code` for shortcut matching, `event.key` for display purposes.**

### Implementation Strategy

1. **Change KeyComboImpl.fromEvent()**: Use `event.code` instead of `event.key`
2. **Update Core Keybindings**: Migrate all definitions to `event.code` format
3. **Add Display Mapping**: Create `getDisplayKey()` to convert codes to readable names
4. **Implement Migration**: Auto-migrate user keybindings from old to new format
5. **Update Tests**: Fix all tests to use `event.code` format
6. **Update Documentation**: Guide extension developers to use new format

### Key Changes

#### Before (Main Branch):
```typescript
static fromEvent(event: KeyboardEvent) {
  return new KeyComboImpl({
    key: event.key,  // Layout-dependent
    ctrl: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  })
}
```

#### After (PR #5265):
```typescript
static fromEvent(event: KeyboardEvent) {
  return new KeyComboImpl({
    key: event.code,  // Layout-independent
    ctrl: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  })
}
```

---

## Implementation Details

### 1. KeyComboImpl Changes

```typescript
export class KeyComboImpl implements KeyCombo {
  key: string  // Now stores event.code format
  ctrl: boolean
  alt: boolean
  shift: boolean

  static fromEvent(event: KeyboardEvent) {
    return new KeyComboImpl({
      key: event.code,  // Changed from event.key
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey
    })
  }

  get isModifier(): boolean {
    // Updated to use event.code format
    return [
      'ControlLeft', 'ControlRight',
      'MetaLeft', 'MetaRight',
      'AltLeft', 'AltRight',
      'ShiftLeft', 'ShiftRight'
    ].includes(this.key)
  }

  getDisplayKey(): string {
    // Convert event.code to readable display name
    const keyMap: Record<string, string> = {
      // Letters: KeyA → A
      KeyA: 'A', KeyB: 'B', /* ... */ KeyZ: 'Z',

      // Numbers: Digit0 → 0
      Digit0: '0', Digit1: '1', /* ... */ Digit9: '9',

      // Function keys: F1 → F1 (unchanged)
      F1: 'F1', F2: 'F2', /* ... */ F12: 'F12',

      // Special keys: mostly unchanged
      Enter: 'Enter', Escape: 'Escape', Space: 'Space',

      // Arrows: use symbols
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',

      // Punctuation: based on US QWERTY
      Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']'
      // ... more mappings
    }
    return keyMap[this.key] || this.key
  }

  getKeySequences(): string[] {
    const sequences: string[] = []
    if (this.ctrl) sequences.push('Ctrl')
    if (this.alt) sequences.push('Alt')
    if (this.shift) sequences.push('Shift')
    sequences.push(this.getDisplayKey())  // Use display name
    return sequences
  }
}
```

### 2. Core Keybindings Migration

**Before:**
```typescript
// src/constants/coreKeybindings.ts (main branch)
{
  combo: { key: 'r' },
  commandId: 'Comfy.RefreshNodeDefinitions'
},
{
  combo: { key: 'q' },
  commandId: 'Workspace.ToggleSidebarTab.queue'
},
```

**After:**
```typescript
// src/constants/coreKeybindings.ts (PR branch)
{
  combo: { key: 'KeyR' },  // event.code format
  commandId: 'Comfy.RefreshNodeDefinitions'
},
{
  combo: { key: 'KeyQ' },  // event.code format
  commandId: 'Workspace.ToggleSidebarTab.queue'
},
```

### 3. Escape Key Handling

**Before:**
```typescript
// src/services/keybindingService.ts (main branch)
if (event.key === 'Escape') {
  // Handle escape
}
```

**After:**
```typescript
// src/services/keybindingService.ts (PR branch)
if (event.code === 'Escape') {
  // Handle escape
}
```

Note: 'Escape' is the same in both `event.key` and `event.code`, but we use `event.code` for consistency.

### 4. Modifier Key Detection

**Before:**
```typescript
get isModifier(): boolean {
  return ['Control', 'Meta', 'Alt', 'Shift'].includes(this.key)
}
```

**After:**
```typescript
get isModifier(): boolean {
  return [
    'ControlLeft', 'ControlRight',
    'MetaLeft', 'MetaRight',
    'AltLeft', 'AltRight',
    'ShiftLeft', 'ShiftRight'
  ].includes(this.key)
}
```

The `event.code` format distinguishes between left and right modifier keys.

---

## Migration Strategy

### Problem: Breaking Change

Switching from `event.key` to `event.code` is a **breaking change** for:
1. Users with custom keybindings
2. Extensions that register keybindings
3. Saved workflow keybindings

### Solution: Automatic Migration

Implement a migration utility that runs when loading user settings:

```typescript
// src/utils/keybindingMigration.ts
export function migrateKeyCombo(combo: KeyCombo): KeyCombo {
  // Check if already in event.code format
  if (isCodeFormat(combo.key)) {
    return combo
  }

  // Migrate from event.key to event.code
  const migrationMap: Record<string, string> = {
    // Lowercase letters
    'a': 'KeyA', 'b': 'KeyB', /* ... */ 'z': 'KeyZ',

    // Uppercase letters
    'A': 'KeyA', 'B': 'KeyB', /* ... */ 'Z': 'KeyZ',

    // Numbers
    '0': 'Digit0', '1': 'Digit1', /* ... */ '9': 'Digit9',

    // Special keys (most are same)
    'Enter': 'Enter',
    'Escape': 'Escape',
    'escape': 'Escape',
    ' ': 'Space',
    'space': 'Space',
    'Space': 'Space',

    // Punctuation
    '-': 'Minus',
    '=': 'Equal',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    // ... more mappings
  }

  return {
    ...combo,
    key: migrationMap[combo.key] || combo.key
  }
}

function isCodeFormat(key: string): boolean {
  // Check if already in event.code format
  const codePatterns = [
    /^Key[A-Z]$/,           // KeyA-KeyZ
    /^Digit[0-9]$/,         // Digit0-Digit9
    /^F[0-9]{1,2}$/,        // F1-F12
    /^Arrow(Up|Down|Left|Right)$/,
    /^(Enter|Escape|Space|Tab|Backspace|Delete)$/,
    /^(Control|Shift|Alt|Meta)(Left|Right)$/,
    /^(Minus|Equal|Bracket(Left|Right)|Backslash)$/,
    /^(Semicolon|Quote|Backquote|Comma|Period|Slash)$/
  ]

  return codePatterns.some(pattern => pattern.test(key))
}

export function migrateKeybindings(keybindings: Keybinding[]): {
  keybindings: Keybinding[]
  changed: boolean
} {
  let changed = false
  const migrated = keybindings.map(binding => {
    const newCombo = migrateKeyCombo(binding.combo)
    if (newCombo.key !== binding.combo.key) {
      changed = true
    }
    return {
      ...binding,
      combo: newCombo
    }
  })

  return { keybindings: migrated, changed }
}
```

### Integration into KeybindingService

```typescript
// src/services/keybindingService.ts
function registerUserKeybindings() {
  // Load user keybindings from settings
  let unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
  let newBindings = settingStore.get('Comfy.Keybinding.NewBindings')

  // Migrate if needed
  const migratedUnset = migrateKeybindings(unsetBindings)
  const migratedNew = migrateKeybindings(newBindings)

  // Save back if changed
  if (migratedUnset.changed) {
    await settingStore.set('Comfy.Keybinding.UnsetBindings', migratedUnset.keybindings)
    console.log('Migrated unset keybindings to new format')
  }

  if (migratedNew.changed) {
    await settingStore.set('Comfy.Keybinding.NewBindings', migratedNew.keybindings)
    console.log('Migrated custom keybindings to new format')
  }

  // Register as usual
  for (const keybinding of migratedUnset.keybindings) {
    keybindingStore.unsetKeybinding(new KeybindingImpl(keybinding))
  }
  for (const keybinding of migratedNew.keybindings) {
    keybindingStore.addUserKeybinding(new KeybindingImpl(keybinding))
  }
}
```

### Migration Behavior

1. **First Load After Update:**
   - System detects old format keybindings
   - Automatically migrates to new format
   - Saves migrated version to settings
   - User keybindings continue working seamlessly

2. **Subsequent Loads:**
   - Keybindings already in new format
   - No migration needed
   - Normal operation

3. **User Notification:**
   - Optional: Show toast notification about migration
   - Log migration to console for debugging
   - No user action required

---

## Testing Strategy

### Unit Tests

#### 1. KeyComboImpl Tests

```typescript
// tests-ui/tests/stores/keybindingStore.test.ts

describe('KeyComboImpl.fromEvent with event.code', () => {
  it('should create combo from keyboard event using code', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'r',      // What would be typed (layout-dependent)
      code: 'KeyR',  // Physical key (layout-independent)
      bubbles: true
    })

    const combo = KeyComboImpl.fromEvent(event)
    expect(combo.key).toBe('KeyR')  // Should use code, not key
  })

  it('should work with non-English layouts', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'к',      // Cyrillic character (Russian layout)
      code: 'KeyR',  // Same physical key
      bubbles: true
    })

    const combo = KeyComboImpl.fromEvent(event)
    expect(combo.key).toBe('KeyR')  // Should still be KeyR
  })

  it('should detect modifier keys correctly', () => {
    const leftControl = new KeyComboImpl({ key: 'ControlLeft' })
    const rightControl = new KeyComboImpl({ key: 'ControlRight' })

    expect(leftControl.isModifier).toBe(true)
    expect(rightControl.isModifier).toBe(true)
  })
})

describe('getDisplayKey', () => {
  it('should convert letter codes to display names', () => {
    const combo = new KeyComboImpl({ key: 'KeyA' })
    expect(combo.getDisplayKey()).toBe('A')
  })

  it('should convert digit codes to display names', () => {
    const combo = new KeyComboImpl({ key: 'Digit5' })
    expect(combo.getDisplayKey()).toBe('5')
  })

  it('should keep special keys unchanged', () => {
    const combo = new KeyComboImpl({ key: 'Enter' })
    expect(combo.getDisplayKey()).toBe('Enter')
  })

  it('should convert arrows to symbols', () => {
    const combo = new KeyComboImpl({ key: 'ArrowUp' })
    expect(combo.getDisplayKey()).toBe('↑')
  })
})
```

#### 2. Migration Tests

```typescript
// tests-ui/tests/utils/keybindingMigration.test.ts

describe('migrateKeyCombo', () => {
  it('should migrate lowercase letters', () => {
    const old = { key: 'r' }
    const migrated = migrateKeyCombo(old)
    expect(migrated.key).toBe('KeyR')
  })

  it('should migrate uppercase letters', () => {
    const old = { key: 'R' }
    const migrated = migrateKeyCombo(old)
    expect(migrated.key).toBe('KeyR')
  })

  it('should not migrate if already in code format', () => {
    const already = { key: 'KeyR' }
    const migrated = migrateKeyCombo(already)
    expect(migrated.key).toBe('KeyR')
  })

  it('should migrate digit characters', () => {
    const old = { key: '5' }
    const migrated = migrateKeyCombo(old)
    expect(migrated.key).toBe('Digit5')
  })

  it('should handle special keys', () => {
    const escape = migrateKeyCombo({ key: 'escape' })
    expect(escape.key).toBe('Escape')

    const space = migrateKeyCombo({ key: ' ' })
    expect(space.key).toBe('Space')
  })
})

describe('migrateKeybindings', () => {
  it('should migrate array of keybindings', () => {
    const old = [
      { combo: { key: 'r' }, commandId: 'Test1' },
      { combo: { key: 's', ctrl: true }, commandId: 'Test2' }
    ]

    const { keybindings, changed } = migrateKeybindings(old)

    expect(changed).toBe(true)
    expect(keybindings[0].combo.key).toBe('KeyR')
    expect(keybindings[1].combo.key).toBe('KeyS')
  })

  it('should detect when no migration needed', () => {
    const already = [
      { combo: { key: 'KeyR' }, commandId: 'Test1' }
    ]

    const { keybindings, changed } = migrateKeybindings(already)

    expect(changed).toBe(false)
    expect(keybindings[0].combo.key).toBe('KeyR')
  })
})
```

### Browser Tests (E2E)

#### 1. Basic Keybinding Test

```typescript
// browser_tests/tests/keybindings.spec.ts

test('keyboard shortcuts work on all layouts', async ({ page }) => {
  // Note: Playwright normalizes keyboard events
  // We test the actual user experience

  await page.keyboard.press('r')
  // Should trigger refresh node definitions

  await page.keyboard.press('Control+s')
  // Should trigger save workflow

  await page.keyboard.press('Escape')
  // Should close dialogs
})
```

#### 2. Non-English Layout Simulation

```typescript
test('shortcuts work with simulated non-English layout', async ({ page }) => {
  // Simulate Russian layout by sending events with Cyrillic characters
  await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'к',      // Cyrillic (Russian)
      code: 'KeyR',  // Physical key
      bubbles: true
    })
    document.dispatchEvent(event)
  })

  // Should still trigger the command bound to 'R' key
  await expect(page.locator('.node-library')).toBeVisible()
})
```

### Manual Testing Checklist

- [ ] Test on English QWERTY keyboard
- [ ] Test on Russian keyboard layout
- [ ] Test on Arabic keyboard layout
- [ ] Test on Chinese keyboard with IME
- [ ] Test on French AZERTY keyboard
- [ ] Test on German QWERTZ keyboard
- [ ] Test on Japanese keyboard with IME
- [ ] Test all core keybindings work
- [ ] Test custom user keybindings migrate correctly
- [ ] Test extension keybindings still work
- [ ] Test Escape key in dialogs
- [ ] Test modifier combinations (Ctrl+Shift+Key)
- [ ] Test that text input still works normally

---

## Related Work

### PR #4285 (Closed)

**Title:** "Fix keybinding layout independence for international users / issue #2340 (the non-english keyboard bug)"

**Approach:** Added both `key` and `code` properties to KeyCombo schema.

**Why it was closed:**
- Added complexity by maintaining both properties
- Unclear which property to use for matching
- Incomplete migration strategy
- Not merged into main

### PR #5007 (Merged)

**Title:** "Translated Keyboard Shortcuts"

**Approach:** Added internationalization for keyboard shortcut display names.

**Relation:** This PR focused on **displaying** shortcuts in different languages, but didn't fix the actual **functionality** on non-English layouts. PR #5265 completes the solution by making shortcuts actually work, while PR #5007 made them readable.

### PR #5265 (Current)

**Title:** "[fix] Change keyboard event handling from event.key to event.code"

**Approach:** Switch entirely to `event.code` for matching, add `getDisplayKey()` for display.

**Status:** Open, needs backward compatibility solution (migration).

**Key Improvements over #4285:**
- Simpler approach (one property for matching)
- Clear migration path
- Better documentation
- Complete solution

---

## Recommendations

### 1. Implementation Phases

**Phase 1: Core Changes (Current PR)**
- ✅ Switch KeyComboImpl.fromEvent() to use event.code
- ✅ Update core keybindings to event.code format
- ✅ Add getDisplayKey() method
- ✅ Update Escape key checks to use event.code
- ✅ Update isModifier to check event.code format

**Phase 2: Migration (To Be Added)**
- [ ] Create keybindingMigration.ts utility
- [ ] Add migration logic to registerUserKeybindings()
- [ ] Add migration tests
- [ ] Add migration documentation

**Phase 3: Testing & Documentation**
- [ ] Update all unit tests
- [ ] Update browser tests
- [ ] Manual testing on various layouts
- [ ] Update extension developer documentation
- [ ] Update user documentation

**Phase 4: Extension Support**
- [ ] Add deprecation warnings for old format
- [ ] Update extension examples
- [ ] Provide migration guide for extension developers
- [ ] Consider backwards compatibility shim

### 2. Documentation Updates Needed

1. **Extension Developer Guide:**
   - How to register keybindings using event.code
   - Migration guide for existing extensions
   - Examples of common shortcuts

2. **User Guide:**
   - Explain that shortcuts are based on physical key positions
   - Provide tips for users with non-standard layouts
   - Document how to customize shortcuts

3. **CLAUDE.md Updates:**
   - Add the keybinding guidelines already present
   - Document the event.code standard
   - Provide examples for future contributors

### 3. Future Enhancements

1. **Visual Keybinding Editor:**
   - Let users press keys to set shortcuts
   - Show physical key position visually
   - Preview shortcuts on different layouts

2. **Layout Profiles:**
   - Preset configurations for common layouts
   - Community-contributed optimizations
   - Easy switching between profiles

3. **Conflict Detection:**
   - Warn about shortcuts that conflict with browser/OS
   - Suggest alternatives for unavailable keys
   - Show which shortcuts are already in use

---

## Conclusion

### Summary of Analysis

1. **Problem:** Current implementation uses `event.key`, which breaks on non-English keyboard layouts
2. **Root Cause:** `event.key` is layout-dependent, while shortcuts are defined in English
3. **Solution:** Switch to `event.code` (layout-independent physical key positions)
4. **Trade-off:** Breaking change for existing user keybindings requires migration
5. **Benefit:** Universal support for all keyboard layouts worldwide

### Why This Is the Right Solution

1. **Industry Standard:** VS Code, Chrome DevTools, and other professional tools use `event.code`
2. **User Experience:** Muscle memory works regardless of keyboard layout
3. **International Support:** Makes ComfyUI usable for millions of non-English users
4. **Future-Proof:** Will work with any future keyboard layout
5. **Maintainable:** Simpler, more consistent codebase

### Recommended Next Steps

1. **Complete Migration Implementation:** Add the migration utility to this PR
2. **Test Thoroughly:** Verify migration works with various saved keybindings
3. **Update Documentation:** Ensure developers know how to use new format
4. **Merge PR #5265:** Get this fix to users as soon as possible
5. **Monitor Feedback:** Watch for any edge cases after release
6. **Support Extensions:** Help extension developers migrate their keybindings

### Success Metrics

After implementation, we should see:
- ✅ Zero reports of "shortcuts don't work on my keyboard layout"
- ✅ No user action required after update (migration is automatic)
- ✅ Extension compatibility maintained
- ✅ Test coverage for all keyboard event handling
- ✅ Clear documentation for future contributors

---

**Document Version:** 1.0
**Date:** 2025-10-16
**PR:** #5265
**Issue:** #5252
**Author:** Research conducted for ComfyUI Frontend Team
