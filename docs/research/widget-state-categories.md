# Widget State Categories

Date: 2026-05-12

## Overview

Widget state in the v2 extension API is organized into distinct categories, each with different characteristics for mutability, persistence, and event handling.

## Categories

### 1. Identity (Read-Only Invariants)

Set at construction, never change.

| Property     | Type             | Notes                                |
| ------------ | ---------------- | ------------------------------------ |
| `entityId`   | `WidgetEntityId` | Branded, stable for widget lifetime  |
| `name`       | `string`         | Widget name as registered            |
| `widgetType` | `string`         | e.g., `'INT'`, `'STRING'`, `'COMBO'` |
| `label`      | `string`         | Display label, defaults to `name`    |

**Constraints:**

- No setters exist for these properties
- Extensions cannot modify identity after creation
- Attempting to change identity is a design error

### 2. Value (First-Class, Every Widget)

The primary user-edited data.

| Method              | Notes                               |
| ------------------- | ----------------------------------- |
| `getValue()`        | Returns current value               |
| `setValue(v)`       | Dispatches `SetWidgetValue` command |
| `on('valueChange')` | Fires on value mutation             |

**Constraints:**

- Type varies by widget type (`number` for INT, `string` for STRING, etc.)
- Persisted to `widgets_values` in workflow JSON
- Included in API prompt by default (unless `setSerializeEnabled(false)`)
- Changes are undo-able via command dispatch

### 3. Properties (First-Class, Every Widget)

Common properties all widgets share.

| Property    | Getter                 | Setter                   | Event            |
| ----------- | ---------------------- | ------------------------ | ---------------- |
| `hidden`    | `isHidden()`           | `setHidden(b)`           | `propertyChange` |
| `disabled`  | `isDisabled()`         | `setDisabled(b)`         | `propertyChange` |
| `serialize` | `isSerializeEnabled()` | `setSerializeEnabled(b)` | `propertyChange` |

**Constraints:**

- Boolean values only
- `hidden` affects UI visibility, not serialization
- `disabled` makes widget read-only in UI
- `serialize` controls inclusion in workflow/prompt output
- Changes fire `propertyChange`, not `valueChange`

### 4. Options Bag (Type-Specific)

Per-instance overrides for type-specific configuration.

| Method                  | Notes                                          |
| ----------------------- | ---------------------------------------------- |
| `getOption(key)`        | Returns per-instance override or class default |
| `setOption(key, value)` | Persists to `widget_options` sidecar           |
| `on('optionChange')`    | Fires on option mutation                       |

**Common options by widget type:**

| Widget Type | Options                            |
| ----------- | ---------------------------------- |
| INT, FLOAT  | `min`, `max`, `step`, `precision`  |
| STRING      | `multiline`, `placeholder`, `rows` |
| COMBO       | `values`                           |

**Constraints:**

- Options are JSON-serializable values
- Persisted separately from `widgets_values` (additive, backward-compatible)
- Extensions can add custom options
- Option keys should be documented per widget type

### 5. DOM-Specific

Properties unique to DOM widgets.

| Method          | Notes                                      |
| --------------- | ------------------------------------------ |
| `setHeight(px)` | Updates reserved height, triggers relayout |

**Constraints:**

- Only meaningful for `addDOMWidget()` widgets
- No-op for non-DOM widgets
- Measured in pixels (screen space)
- No event fired; relayout is automatic

## Category Interaction Rules

### Event Separation

Each category has its own event:

| Category   | Event            |
| ---------- | ---------------- |
| Value      | `valueChange`    |
| Properties | `propertyChange` |
| Options    | `optionChange`   |

**Rule**: Events do not cross categories. Changing `hidden` does not fire `valueChange`.

### Serialization Behavior

| Category   | Serialization                                                    |
| ---------- | ---------------------------------------------------------------- |
| Identity   | Not serialized (derived from node type)                          |
| Value      | `widgets_values` array                                           |
| Properties | `hidden`/`disabled` not persisted; `serialize` affects inclusion |
| Options    | `widget_options` sidecar object                                  |

### Mutability Summary

| Category   | Mutable | Undo-able | Fires Event      |
| ---------- | ------- | --------- | ---------------- |
| Identity   | ✗       | —         | —                |
| Value      | ✓       | ✓         | `valueChange`    |
| Properties | ✓       | ✓         | `propertyChange` |
| Options    | ✓       | ✓         | `optionChange`   |
| DOM Height | ✓       | ✗         | —                |

## Agent Implementation Notes

Agents working with widget state should:

1. **Respect category boundaries**: Don't try to `setValue()` to change visibility; use `setHidden()`.

2. **Use appropriate events**: Listen to `propertyChange` for UI state, `valueChange` for data.

3. **Handle type-specific options carefully**: Check widget type before accessing type-specific options.

4. **Preserve identity invariants**: Never try to change `entityId`, `name`, `widgetType`, or `label`.

5. **Consider serialization context**: Options persist to a sidecar; values persist to the main array.
