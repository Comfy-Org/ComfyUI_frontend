/**
 * Auto-generated shard configuration for balanced test distribution
 * Generated on: 2025-09-02T16:09:27.236Z
 */

export const OPTIMIZED_SHARDS = [
  [
    "interaction.spec.ts",
    "selectionToolbox.spec.ts",
    "chatHistory.spec.ts",
    "litegraphEvent.spec.ts",
    "versionMismatchWarnings.spec.ts"
  ],
  [
    "subgraph.spec.ts",
    "sidebar/workflows.spec.ts",
    "primitiveNode.spec.ts",
    "bottomPanelShortcuts.spec.ts",
    "nodeBadge.spec.ts",
    "execution.spec.ts",
    "rerouteNode.spec.ts",
    "changeTracker.spec.ts",
    "keybindings.spec.ts",
    "userSelectView.spec.ts"
  ],
  [
    "widget.spec.ts",
    "sidebar/nodeLibrary.spec.ts",
    "nodeHelp.spec.ts",
    "templates.spec.ts",
    "featureFlags.spec.ts",
    "copyPaste.spec.ts",
    "loadWorkflowInMedia.spec.ts",
    "actionbar.spec.ts",
    "commands.spec.ts",
    "minimap.spec.ts",
    "workflowTabThumbnail.spec.ts"
  ],
  [
    "nodeSearchBox.spec.ts",
    "rightClickMenu.spec.ts",
    "colorPalette.spec.ts",
    "useSettingSearch.spec.ts",
    "graphCanvasMenu.spec.ts",
    "domWidget.spec.ts",
    "menu.spec.ts",
    "backgroundImageUpload.spec.ts",
    "customIcons.spec.ts",
    "releaseNotifications.spec.ts"
  ],
  [
    "dialog.spec.ts",
    "groupNode.spec.ts",
    "nodeDisplay.spec.ts",
    "remoteWidgets.spec.ts",
    "extensionAPI.spec.ts",
    "sidebar/queue.spec.ts",
    "noteNode.spec.ts",
    "browserTabTitle.spec.ts",
    "graph.spec.ts",
    "subgraph-rename-dialog.spec.ts"
  ]
]

export function getShardTests(shardIndex: number): string[] {
  return OPTIMIZED_SHARDS[shardIndex - 1] || []
}

export function getShardPattern(shardIndex: number): string[] {
  return getShardTests(shardIndex).map(test => `**/${test}`)
}
