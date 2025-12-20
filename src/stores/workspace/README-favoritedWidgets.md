# Favorited Widgets Store

## Overview

The Favorited Widgets Store manages user-starred widgets in the right side panel. This feature allows users to quickly access and edit frequently-used widget values without needing to select the corresponding nodes.

## Features (MVP v1)

- ⭐ **Star/Unstar Widgets**: Click the star icon next to any widget in the Parameters tab
- 🎯 **Quick Access**: Favorited widgets appear at the top of the Parameters tab
- 📍 **No Selection Needed**: Access favorites even when no node is selected
- 💾 **Persistence**: Favorites are saved per-workflow in localStorage
- 🔄 **Auto-cleanup**: Invalid favorites (deleted nodes/widgets) are automatically handled

## Usage

### For Users

1. **Star a Widget**:
   - Select a node with widgets
   - Go to the Parameters tab
   - Click the star icon (⭐) next to any widget
   - The widget is now favorited

2. **Access Favorites**:
   - Favorites appear in the "FAVORITES" section at the top of Parameters tab
   - Edit favorited widgets directly without selecting nodes
   - Changes are immediately applied to the corresponding nodes

3. **Unstar a Widget**:
   - Click the filled star icon (⭐) to remove from favorites

### For Developers

#### Store API

```typescript
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

const store = useFavoritedWidgetsStore()

// Check if a widget is favorited
store.isFavorited(nodeId, widgetName) // => boolean

// Toggle favorite status
store.toggleFavorite(nodeId, widgetName)

// Add/remove favorites
store.addFavorite(nodeId, widgetName)
store.removeFavorite(nodeId, widgetName)

// Get all favorited widgets (with resolved instances)
store.favoritedWidgets // => FavoritedWidget[]
store.validFavoritedWidgets // => FavoritedWidget[] (only valid ones)

// Cleanup
store.clearFavorites() // Clear all favorites for current workflow
store.pruneInvalidFavorites() // Remove favorites for deleted nodes/widgets
```

#### Data Types

```typescript
interface FavoritedWidgetId {
  nodeId: NodeId // number | string
  widgetName: string
}

interface FavoritedWidget extends FavoritedWidgetId {
  node: LGraphNode | null // Resolved node instance
  widget: IBaseWidget | null // Resolved widget instance
  label: string // Display label
}
```

## Implementation Details

### Persistence

- **Scope**: Per-workflow (not global)
- **Storage**: localStorage
- **Key Format**: `Comfy.FavoritedWidgets.${workflowPath}`
- **Data Format**: JSON array of `FavoritedWidgetId` objects

### Widget Identification

- **Primary Key**: `${nodeId}:${widgetName}`
- **Node ID**: Supports both `number` and `string` types
- **Widget Name**: The `widget.name` property

### Runtime Resolution

Favorited widgets are stored as IDs and resolved at runtime:
1. Store loads IDs from localStorage when workflow changes
2. IDs are resolved to actual widget instances when accessed
3. Invalid favorites (deleted nodes/widgets) return null instances
4. UI filters out invalid favorites automatically

### Edge Cases Handled

- **Node Deleted**: Widget shows as "(node deleted)" - safely ignored
- **Widget Removed**: Widget shows as "(widget not found)" - safely ignored
- **Workflow Switch**: Favorites automatically reload for new workflow
- **Graph Not Loaded**: Gracefully handles missing graph instance

## Future Enhancements (Out of MVP Scope)

- [ ] Global favorites (across all workflows)
- [ ] Organize favorites into custom groups
- [ ] Drag-and-drop reordering
- [ ] Batch favorite/unfavorite operations
- [ ] Export/import favorites
- [ ] Integration with Linear Mode panel
- [ ] Favorite presets/templates

## Files Modified

### New Files
- `src/stores/workspace/favoritedWidgetsStore.ts` - Main store implementation

### Modified Files
- `src/components/rightSidePanel/RightSidePanel.vue` - Show favorites when no selection
- `src/components/rightSidePanel/parameters/TabParameters.vue` - Add SectionFavorites
- `src/components/rightSidePanel/parameters/SectionWidgets.vue` - Add star buttons
- `src/components/rightSidePanel/parameters/SectionFavorites.vue` - New component for favorites display
- `src/locales/en/main.json` - Add i18n strings

## Testing

### Manual Testing Checklist

- [ ] Star a widget and verify it appears in Favorites section
- [ ] Unstar a widget and verify it disappears from Favorites
- [ ] Edit a favorited widget value and verify the node updates
- [ ] Reload the page and verify favorites persist
- [ ] Switch workflows and verify different favorites load
- [ ] Delete a favorited node and verify UI handles it gracefully
- [ ] Test with no selection - favorites should still be editable

### Future Automated Tests

Consider adding:
- Unit tests for store logic (add/remove/toggle)
- Unit tests for localStorage persistence
- Component tests for SectionFavorites
- E2E tests for the complete user flow

