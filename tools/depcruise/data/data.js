window.GORDIAN = {
  timeline: {
    repo: 'Comfy-Org/ComfyUI_frontend',
    issue: 'FE-3037',
    tool: 'dependency-cruiser, repo .dependency-cruiser.json, `depcruise src`',
    base: '7475c964f67419ead544bcdab2b98bc0da14e607',
    head: '85a816b0937cca7fe432894676d3f3b27d30c740',
    notes: [
      'A knot is a strongly connected component of the src/ module graph with more than one module.',
      'Step 0 is the parent of the first FE-3037 commit; every later step is one commit on main.',
      'Knot ids are stable across states. When a knot splits, the largest piece keeps the id.',
      'Paths in delta lists are relative to src/.',
      'openPrs.states continue the step indexes: each is the tree at a pull request head (kind "pr") or at the main commit a stack forks from (kind "base"). Their delta is against `parent`, the state of the pull request below them in the stack.',
      'A pull request head is analysed as pushed, not merged into current main; behindMain says how stale its base is.',
      'containsParentHead false means the pull request below was rebased without this one; its delta is then its whole branch against the main commit it forks from.',
      'architecture is the domain census from tools/architecture (scripts/census.mjs), null when not measured. status "no-records" means the tree has no domain records yet. A domain is ready to extract when every entry in its checks is true; see DOMAINS.md.'
    ],
    knots: [
      {
        id: 0,
        parent: null,
        bornAt: 0,
        peak: 993,
        role: 'main',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 1,
        parent: null,
        bornAt: 0,
        peak: 28,
        role: 'other',
        fromMain: false,
        label: 'workbench/extensions/manager'
      },
      {
        id: 2,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'renderer'
      },
      {
        id: 3,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'constants'
      },
      {
        id: 4,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'composables'
      },
      {
        id: 5,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'components/searchbox/v2'
      },
      {
        id: 6,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'components'
      },
      {
        id: 7,
        parent: null,
        bornAt: 0,
        peak: 2,
        role: 'other',
        fromMain: false,
        label: 'workbench/extensions/agent/crdt'
      },
      {
        id: 8,
        parent: 0,
        bornAt: 1,
        peak: 6,
        role: 'other',
        fromMain: true,
        label: 'composables/graph'
      },
      {
        id: 9,
        parent: 0,
        bornAt: 4,
        peak: 161,
        role: 'second',
        fromMain: true,
        label: 'lib/litegraph'
      },
      {
        id: 10,
        parent: 0,
        bornAt: 4,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 11,
        parent: 0,
        bornAt: 17,
        peak: 3,
        role: 'other',
        fromMain: true,
        label: 'components'
      },
      {
        id: 12,
        parent: 0,
        bornAt: 28,
        peak: 2,
        role: 'other',
        fromMain: true,
        label: 'scripts'
      },
      {
        id: 13,
        parent: 0,
        bornAt: 66,
        peak: 3,
        role: 'other',
        fromMain: true,
        label: 'composables'
      },
      {
        id: 14,
        parent: 0,
        bornAt: 66,
        peak: 2,
        role: 'other',
        fromMain: true,
        label: 'extensions'
      },
      {
        id: 15,
        parent: 0,
        bornAt: 89,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 16,
        parent: 0,
        bornAt: 89,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'types'
      },
      {
        id: 17,
        parent: 0,
        bornAt: 92,
        peak: 48,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 18,
        parent: 0,
        bornAt: 93,
        peak: 49,
        role: 'other',
        fromMain: true,
        label: 'stores'
      },
      {
        id: 19,
        parent: 17,
        bornAt: 96,
        peak: 3,
        role: 'other',
        fromMain: true,
        label: 'platform/workspace'
      }
    ],
    steps: [
      {
        index: 0,
        kind: 'commit',
        parent: null,
        sha: '7475c964f67419ead544bcdab2b98bc0da14e607',
        short: '7475c964f6',
        date: '2026-10-07T20:59:58Z',
        subject:
          'fix(website): remove status dots and inert "more options" labels from managed-builds catalog',
        pr: 20210,
        fe3037: false,
        stats: {
          modules: 2434,
          imports: 11339,
          modulesInKnots: 1033,
          largestKnot: 993,
          mainKnot: 993,
          secondKnot: 0,
          knotCount: 8,
          importsInKnots: 4583,
          noCircularWarnings: 3116
        },
        knots: [
          { id: 0, size: 993 },
          { id: 1, size: 28 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 1,
        kind: 'commit',
        parent: 0,
        sha: 'e943f4e85dd92baec9338df368a20a9d1179f768',
        short: 'e943f4e85d',
        date: '2026-10-07T21:15:21Z',
        subject: 'refactor: register core sidebar tabs outside sidebarTabStore',
        pr: 19091,
        fe3037: true,
        stats: {
          modules: 2435,
          imports: 11342,
          modulesInKnots: 842,
          largestKnot: 796,
          mainKnot: 796,
          secondKnot: 0,
          knotCount: 9,
          importsInKnots: 3802,
          noCircularWarnings: 2614
        },
        knots: [
          { id: 0, size: 796 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/boundingBoxes/WidgetBoundingBoxes.vue',
            'components/common/CustomizationDialog.vue',
            'components/common/TreeExplorer.vue',
            'components/common/TreeExplorerTreeNode.vue',
            'components/common/TreeExplorerV2.vue',
            'components/common/TreeExplorerV2Node.vue',
            'components/common/WaveAudioPlayer.vue',
            'components/curve/WidgetCurve.vue',
            'components/gradientslider/GradientSlider.vue',
            'components/gradientslider/gradients.ts',
            'components/imagecrop/WidgetImageCrop.vue',
            'components/node/NodeHelpContent.vue',
            'components/node/NodePreview.vue',
            'components/node/NodePreviewCard.vue',
            'components/node/NodePricingBadge.vue',
            'components/node/NodeProviderBadge.vue',
            'components/painter/WidgetPainter.vue',
            'components/palette/WidgetColors.vue',
            'components/queue/JobHistoryActionsMenu.vue',
            'components/queue/dialogs/QueueClearHistoryDialog.vue',
            'components/queue/job/JobAssetsList.vue',
            'components/queue/job/JobDetailsHoverPopover.vue',
            'components/queue/job/JobDetailsPopover.vue',
            'components/queue/job/JobFilterActions.vue',
            'components/queue/job/buildVirtualJobRows.ts',
            'components/queue/job/useJobErrorReporting.ts',
            'components/queue/job/useQueueEstimates.ts',
            'components/range/RangeEditor.vue',
            'components/range/WidgetRange.vue',
            'components/range/rangeUtils.ts',
            'components/searchbox/NodeSearchFilter.vue',
            'components/sidebar/tabs/AppsSidebarTab.vue',
            'components/sidebar/tabs/AssetsSidebarGridView.vue',
            'components/sidebar/tabs/AssetsSidebarListView.vue',
            'components/sidebar/tabs/AssetsSidebarTab.vue',
            'components/sidebar/tabs/BaseWorkflowsSidebarTab.vue',
            'components/sidebar/tabs/JobHistorySidebarTab.vue',
            'components/sidebar/tabs/ModelLibrarySidebarTab.vue',
            'components/sidebar/tabs/NodeLibrarySidebarTab.vue',
            'components/sidebar/tabs/NodeLibrarySidebarTabV2.vue',
            'components/sidebar/tabs/SidebarTabCloseButton.vue',
            'components/sidebar/tabs/SidebarTabTemplate.vue',
            'components/sidebar/tabs/WorkflowsSidebarTab.vue',
            'components/sidebar/tabs/modelLibrary/DownloadItem.vue',
            'components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue',
            'components/sidebar/tabs/modelLibrary/ModelPreview.vue',
            'components/sidebar/tabs/nodeLibrary/AllNodesPanel.vue',
            'components/sidebar/tabs/nodeLibrary/EssentialNodeCard.vue',
            'components/sidebar/tabs/nodeLibrary/EssentialNodesPanel.vue',
            'components/sidebar/tabs/nodeLibrary/NodeBookmarkTreeExplorer.vue',
            'components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue',
            'components/sidebar/tabs/queue/MediaLightbox.vue',
            'components/sidebar/tabs/queue/ResultAudio.vue',
            'components/sidebar/tabs/queue/ResultText.vue',
            'components/sidebar/tabs/queue/ResultVideo.vue',
            'components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue',
            'components/videoEdit/VideoEditPanel.vue',
            'components/videoEdit/VideoFilmstripTrim.vue',
            'components/videoEdit/WidgetVideoEdit.vue',
            'composables/boundingBoxes/useBoundingBoxes.ts',
            'composables/graph/useCanvasRefresh.ts',
            'composables/graph/useFrameNodes.ts',
            'composables/graph/useNodeArrangement.ts',
            'composables/graph/useNodeCustomization.ts',
            'composables/graph/useSelectedNodeActions.ts',
            'composables/graph/useSelectionOperations.ts',
            'composables/graph/useSelectionState.ts',
            'composables/node/useNodePreviewAndDrag.ts',
            'composables/painter/usePainter.ts',
            'composables/queue/useJobList.ts',
            'composables/queue/useJobMenu.ts',
            'composables/queue/useQueueClearHistoryDialog.ts',
            'composables/queue/useQueueFeatureFlags.ts',
            'composables/queue/useQueueProgress.ts',
            'composables/queue/useResultGallery.ts',
            'composables/sidebarTabs/useAssetsSidebarTab.ts',
            'composables/sidebarTabs/useJobHistorySidebarTab.ts',
            'composables/sidebarTabs/useModelLibrarySidebarTab.ts',
            'composables/sidebarTabs/useNodeLibrarySidebarTab.ts',
            'composables/tree/useTreeFolderOperations.ts',
            'composables/useEssentialTileNodeDef.ts',
            'composables/useImageCrop.ts',
            'composables/useNodeHelpContent.ts',
            'composables/useRangeEditor.ts',
            'composables/useTreeExpansion.ts',
            'composables/useUpstreamValue.ts',
            'composables/useWaveAudioPlayer.ts',
            'composables/video/useCropRatioLock.ts',
            'composables/video/useTimelineScrub.ts',
            'composables/video/useVideoEditModel.ts',
            'composables/video/useVideoFilmstrip.ts',
            'composables/video/useVideoSourceUrl.ts',
            'platform/assets/components/Media3DTop.vue',
            'platform/assets/components/MediaAssetCard.vue',
            'platform/assets/components/MediaAudioTop.vue',
            'platform/assets/components/MediaImageTop.vue',
            'platform/assets/components/MediaTextTop.vue',
            'platform/assets/components/MediaVideoTop.vue',
            'platform/assets/composables/useAssetDownload.ts',
            'platform/assets/composables/useAssetGridSelection.ts',
            'platform/assets/composables/useAssetSelection.ts',
            'platform/assets/composables/useAssetZipExport.ts',
            'platform/assets/composables/useMediaAssetActions.ts',
            'platform/assets/composables/useNodeOutputsExport.ts',
            'platform/assets/composables/useOutputStacks.ts',
            'platform/assets/utils/assetDragUtil.ts',
            'platform/assets/utils/clearDeletedAssetWidgetValues.ts',
            'platform/assets/utils/clearNodePreviewCacheForValues.ts',
            'platform/assets/utils/markDeletedAssetsAsMissingMedia.ts',
            'platform/assets/utils/marqueeSelectionUtil.ts',
            'platform/assets/utils/mediaIconUtil.ts',
            'platform/assets/utils/outputAssetCountUtil.ts',
            'platform/assets/utils/outputAssetUtil.ts',
            'platform/assets/utils/outputExportUtil.ts',
            'platform/workflow/core/services/workflowActionsService.ts',
            'platform/workflow/management/composables/useAppsSidebarTab.ts',
            'platform/workflow/management/composables/useWorkflowsSidebarTab.ts',
            'platform/workflow/utils/workflowExtractionUtil.ts',
            'renderer/core/canvas/interaction/canvasPointerEvent.ts',
            'renderer/core/canvas/links/linkConnectorAdapter.ts',
            'renderer/core/canvas/links/linkDropOrchestrator.ts',
            'renderer/core/layout/slots/syncSlotOffsets.ts',
            'renderer/extensions/compositor/components/WidgetCompositor.vue',
            'renderer/extensions/compositor/composables/useCompositorEditor.ts',
            'renderer/extensions/compositor/composables/useCompositorPsdDownload.ts',
            'renderer/extensions/linearMode/AppInput.vue',
            'renderer/extensions/vueNodes/components/InputSlot.vue',
            'renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
            'renderer/extensions/vueNodes/components/NodeBadge.vue',
            'renderer/extensions/vueNodes/components/NodeHeader.vue',
            'renderer/extensions/vueNodes/components/NodeSlots.vue',
            'renderer/extensions/vueNodes/components/OutputSlot.vue',
            'renderer/extensions/vueNodes/components/SlotConnectionDot.vue',
            'renderer/extensions/vueNodes/components/WidgetGrid.vue',
            'renderer/extensions/vueNodes/composables/useNodeTooltips.ts',
            'renderer/extensions/vueNodes/composables/useSlotLinkInteraction.ts',
            'renderer/extensions/vueNodes/composables/useSlotLinkReveal.ts',
            'renderer/extensions/vueNodes/composables/useVueNodeResizeTracking.ts',
            'renderer/extensions/vueNodes/types/widgetGrid.ts',
            'renderer/extensions/vueNodes/utils/eventUtils.ts',
            'renderer/extensions/vueNodes/utils/linkedCoreMediaUtils.ts',
            'renderer/extensions/vueNodes/utils/nodeDataUtils.ts',
            'renderer/extensions/vueNodes/widgets/components/ValueControlButton.vue',
            'renderer/extensions/vueNodes/widgets/components/ValueControlPopover.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetButton.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetChart.types.ts',
            'renderer/extensions/vueNodes/widgets/components/WidgetChart.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetDynamicGroupRow.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberGradientSlider.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberSlider.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetRecordAudio.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetResolutionPreview.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue',
            'renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue',
            'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue',
            'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.vue',
            'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuFilter.vue',
            'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuItem.vue',
            'renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue',
            'renderer/extensions/vueNodes/widgets/composables/audio/useAudioRecorder.ts',
            'renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData.ts',
            'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesSources.ts',
            'renderer/extensions/vueNodes/widgets/composables/useDismissOnCanvasGesture.ts',
            'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
            'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions.ts',
            'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems.ts',
            'renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts',
            'renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget.ts',
            'renderer/extensions/vueNodes/widgets/utils/savedImageUrls.ts',
            'schemas/nodeDef/inputSpecUtil.ts',
            'services/nodeHelpService.ts',
            'services/nodeOrganizationService.ts',
            'stores/assetExportStore.ts',
            'stores/nodeBookmarkStore.ts',
            'stores/workspace/assetsSidebarBadgeStore.ts',
            'stores/workspace/nodeHelpStore.ts',
            'utils/queueDisplay.ts',
            'utils/queueUtil.ts',
            'utils/videoMetadataUtil.ts',
            'workbench/utils/nodeHelpUtil.ts'
          ],
          entangled: [],
          splits: [{ from: 0, into: [8] }]
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 2,
        kind: 'commit',
        parent: 1,
        sha: '10ae2627bfd307438e9fc9594cfe25fa3ce5b76f',
        short: '10ae2627bf',
        date: '2026-10-07T21:16:55Z',
        subject: 'feat(run-button): show Run as the inverted button',
        pr: 19765,
        fe3037: false,
        stats: {
          modules: 2435,
          imports: 11342,
          modulesInKnots: 842,
          largestKnot: 796,
          mainKnot: 796,
          secondKnot: 0,
          knotCount: 9,
          importsInKnots: 3802,
          noCircularWarnings: 2614
        },
        knots: [
          { id: 0, size: 796 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 3,
        kind: 'commit',
        parent: 2,
        sha: 'a0261ac4e7da58a528c0355463da55678734d196',
        short: 'a0261ac4e7',
        date: '2026-10-07T21:25:14Z',
        subject:
          "fix(agent): mint a promoted host write so prompt-node edits aren't rejected (PM-1995)",
        pr: 20377,
        fe3037: false,
        stats: {
          modules: 2435,
          imports: 11344,
          modulesInKnots: 843,
          largestKnot: 797,
          mainKnot: 797,
          secondKnot: 0,
          knotCount: 9,
          importsInKnots: 3804,
          noCircularWarnings: 2615
        },
        knots: [
          { id: 0, size: 797 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [],
          entangled: [
            'workbench/extensions/agent/crdt/agentSubgraphDefinitions.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 4,
        kind: 'commit',
        parent: 3,
        sha: 'ab15b0aed09686aaefa4e4af2a9405501b532d65',
        short: 'ab15b0aed0',
        date: '2026-10-07T21:40:34Z',
        subject: 'refactor: move ServerFeatureFlag enum to a leaf module',
        pr: 19089,
        fe3037: true,
        stats: {
          modules: 2436,
          imports: 11345,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/custom/widget/WorkflowTemplateDetail.vue',
            'components/custom/widget/WorkflowTemplateDetailGroup.vue',
            'components/custom/widget/WorkflowTemplateDownloadFailure.vue',
            'components/custom/widget/WorkflowTemplateDownloadStatus.vue',
            'components/custom/widget/WorkflowTemplateModelStatus.vue',
            'components/dialog/content/error/FindIssueButton.vue',
            'components/dialog/content/signin/TurnstileWidget.vue',
            'composables/maskeditor/imageWidgetAdapter.ts',
            'composables/maskeditor/useImageLoader.ts',
            'composables/node/canvasImagePreviewTypes.ts',
            'composables/node/useNodeFileInput.ts',
            'composables/node/useNodePaste.ts',
            'config/billingWeb.ts',
            'config/comfyApi.ts',
            'config/firebase.ts',
            'config/turnstile.ts',
            'core/graph/subgraph/liftNodeErrorsToBoundary.ts',
            'core/graph/subgraph/promotedInputWidget.ts',
            'core/graph/subgraph/resolvePromotedWidgetSource.ts',
            'core/graph/transferLinkPresentation.ts',
            'core/graph/widgets/comboWidgetInventory.ts',
            'core/graph/widgets/dynamicInputSpec.ts',
            'core/graph/widgets/nodeWidgetValues.ts',
            'extensions/core/load3d/GizmoManager.ts',
            'extensions/core/load3d/load3dViewport.ts',
            'lib/litegraph/src/contextMenuCompat.ts',
            'platform/auth/firebaseIdentity.ts',
            'platform/canvas/minimapDecorationRegistry.ts',
            'platform/cloud/notification/components/CloudNotificationContent.vue',
            'platform/cloud/subscription/utils/checkoutAttributionLoader.ts',
            'platform/cloud/subscription/utils/paymentReturnUrl.ts',
            'platform/cloud/subscription/utils/subscriptionCheckoutTracker.ts',
            'platform/cloud/subscription/utils/tierBenefits.ts',
            'platform/missingMedia/missingMediaGrouping.ts',
            'platform/missingMedia/types.ts',
            'platform/missingModel/types.ts',
            'platform/onboarding/coachmarkRegistry.ts',
            'platform/onboarding/onboardingReplay.ts',
            'platform/onboarding/onboardingTours.ts',
            'platform/onboarding/tourState.ts',
            'platform/telemetry/hostTelemetryEnabled.ts',
            'platform/telemetry/imageFailureDiagnostics.ts',
            'platform/telemetry/index.ts',
            'platform/telemetry/nodeAdded/nodeAddSource.ts',
            'platform/telemetry/perf/bootstrapTracer.ts',
            'platform/telemetry/reportError.ts',
            'platform/telemetry/searchQuery/useSearchQueryTracking.ts',
            'platform/telemetry/utils/checkoutAttribution.ts',
            'platform/telemetry/utils/getActionbarDockState.ts',
            'platform/telemetry/utils/paymentIntentSource.ts',
            'platform/telemetry/utils/workflowExecutionContext.ts',
            'platform/workflow/core/utils/modelRequirements.ts',
            'platform/workflow/core/utils/workflowId.ts',
            'platform/workflow/core/utils/workflowToClipboardItems.ts',
            'platform/workflow/sharing/types/shareTypes.ts',
            'platform/workflow/templates/types/templateDetail.ts',
            'platform/workflow/templates/utils/templateModelAvailability.ts',
            'platform/workflow/templates/utils/templateModelDownloadState.ts',
            'platform/workflow/templates/utils/templateModelRequirements.ts',
            'platform/workflow/validation/composables/useWorkflowValidation.ts',
            'platform/workflow/validation/schemas/workflowSchema.ts',
            'platform/workspace/billing/hostedBillingRoutes.ts',
            'platform/workspace/billing/stripePublishableKey.ts',
            'platform/workspace/components/dialogs/InviteLinkList.vue',
            'platform/workspace/composables/useCheckoutCopy.ts',
            'platform/workspace/utils/checkoutJourney.ts',
            'platform/workspace/utils/checkoutJourneyTelemetry.ts',
            'platform/workspace/utils/inviteLinks.ts',
            'renderer/core/canvas/cameraState.ts',
            'renderer/core/layout/transform/graphRenderTransform.ts',
            'renderer/core/layout/transform/useTransformState.ts',
            'renderer/core/spatial/boundsCalculator.ts',
            'renderer/extensions/compositor/composables/compositorSave.ts',
            'renderer/extensions/compositor/composables/compositorWidgets.ts',
            'renderer/extensions/compositor/composables/useCompositorAutoSave.ts',
            'renderer/extensions/compositor/composables/useCompositorLayers.ts',
            'renderer/extensions/firstRunTour/roles/heuristicRoles.ts',
            'renderer/extensions/minimap/types.ts',
            'renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts',
            'schemas/nodeDef/inputSpecTree.ts',
            'schemas/nodeDef/searchableSlotTypes.ts',
            'scripts/defaultGraph.ts',
            'scripts/metadata/avif.ts',
            'scripts/metadata/ebml.ts',
            'scripts/metadata/gltf.ts',
            'scripts/metadata/isobmff.ts',
            'scripts/metadata/mp3.ts',
            'scripts/metadata/ogg.ts',
            'scripts/metadata/svg.ts',
            'scripts/valueControl.ts',
            'services/subgraphPseudoWidgetCache.ts',
            'stores/electronDownloadStore.ts',
            'stores/linkPresentationStore.ts',
            'stores/maskEditorDataStore.ts',
            'types/metadataTypes.ts',
            'utils/errorReportUtil.ts',
            'utils/linkFixer.ts',
            'utils/mathUtil.ts',
            'utils/migration/migrateReroute.ts',
            'utils/missingResourceAbsorption.ts',
            'utils/nodeDefUtil.ts',
            'utils/nodeFilterUtil.ts',
            'utils/positionBounds.ts',
            'utils/searchAndReplace.ts',
            'utils/sessionFeatureFlagOverride.ts',
            'utils/vintageClipboard.ts',
            'workbench/extensions/agent/crdt/agentCrdtDocLifecycle.ts',
            'workbench/extensions/agent/crdt/agentSubgraphDefinitions.ts',
            'workbench/extensions/agent/crdt/devPanelLog.ts',
            'workbench/extensions/agent/services/agent/agentEventTransport.ts',
            'workbench/extensions/agent/services/agent/undeliverableAskReporter.ts',
            'workbench/extensions/agent/stores/agent/agentConversationStore.ts',
            'workbench/extensions/agent/utils/agentMessageText.ts',
            'workbench/extensions/agent/utils/starterPrompts.ts'
          ],
          entangled: [],
          splits: [{ from: 0, into: [9, 10] }]
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 5,
        kind: 'commit',
        parent: 4,
        sha: '25ebdd8e15707e15e09970a793e0d0663f81e317',
        short: '25ebdd8e15',
        date: '2026-10-07T21:40:47Z',
        subject: 'Update CODEOWNERS, resolve warnings',
        pr: 20362,
        fe3037: false,
        stats: {
          modules: 2436,
          imports: 11345,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 6,
        kind: 'commit',
        parent: 5,
        sha: '0b8c7c8573714688c71e86f9615790f85a379507',
        short: '0b8c7c8573',
        date: '2026-10-07T21:41:09Z',
        subject:
          "FE-3267 feat(auth): sign the Desktop-hosted local view in with Desktop's account session",
        pr: 20383,
        fe3037: false,
        stats: {
          modules: 2438,
          imports: 11353,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 7,
        kind: 'commit',
        parent: 6,
        sha: 'd750acf1b5c075b02a2f5ff19f397186879a10e3',
        short: 'd750acf1b5',
        date: '2026-10-07T21:47:19Z',
        subject: 'fix: open the layer editor before its images load',
        pr: 20463,
        fe3037: false,
        stats: {
          modules: 2438,
          imports: 11353,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 8,
        kind: 'commit',
        parent: 7,
        sha: '59745ff3d3041b9455448b04d026f894450a698d',
        short: '59745ff3d3',
        date: '2026-10-07T22:22:20Z',
        subject: 'fix: show the post-tour nudge next to the Templates button',
        pr: 20411,
        fe3037: false,
        stats: {
          modules: 2438,
          imports: 11362,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 9,
        kind: 'commit',
        parent: 8,
        sha: 'fdade839235c1380c9b23412bb8e161424a6ef98',
        short: 'fdade83923',
        date: '2026-10-07T22:24:52Z',
        subject: 'chore: add dependency-cruiser for import cycle auditing',
        pr: 20461,
        fe3037: true,
        stats: {
          modules: 2438,
          imports: 11362,
          modulesInKnots: 729,
          largestKnot: 518,
          mainKnot: 518,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2840,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 518 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 10,
        kind: 'commit',
        parent: 9,
        sha: 'd5617e8a2d3ff4a8c1803933fddf9f94384cc862',
        short: 'd5617e8a2d',
        date: '2026-10-07T22:25:43Z',
        subject: 'missingMedia cleanup',
        pr: 20384,
        fe3037: false,
        stats: {
          modules: 2436,
          imports: 11353,
          modulesInKnots: 728,
          largestKnot: 517,
          mainKnot: 517,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2837,
          noCircularWarnings: 1964
        },
        knots: [
          { id: 0, size: 517 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 11,
        kind: 'commit',
        parent: 10,
        sha: '07e9d32d8b0fd5f431ba05d68345b8f2f40f43bc',
        short: '07e9d32d8b',
        date: '2026-10-07T22:43:18Z',
        subject:
          'test(agent): pin PM-1995 promoted count guard and lifetime drift budget',
        pr: 20464,
        fe3037: false,
        stats: {
          modules: 2436,
          imports: 11353,
          modulesInKnots: 728,
          largestKnot: 517,
          mainKnot: 517,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2837,
          noCircularWarnings: 1964
        },
        knots: [
          { id: 0, size: 517 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 12,
        kind: 'commit',
        parent: 11,
        sha: 'c4ae261842701d8b2b83cc5fde61ffdf9a945090',
        short: 'c4ae261842',
        date: '2026-10-07T23:03:28Z',
        subject:
          'FE-3298 fix(cloud): return SSO to the consent path the server serves',
        pr: 20468,
        fe3037: false,
        stats: {
          modules: 2437,
          imports: 11355,
          modulesInKnots: 728,
          largestKnot: 517,
          mainKnot: 517,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2837,
          noCircularWarnings: 1964
        },
        knots: [
          { id: 0, size: 517 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 13,
        kind: 'commit',
        parent: 12,
        sha: '678a6bd247dab24192b05bdeb182caadbf3ed5b7',
        short: '678a6bd247',
        date: '2026-10-07T23:21:10Z',
        subject: 'refactor: move MissingNodeType to the nodeReplacement leaf',
        pr: 19124,
        fe3037: true,
        stats: {
          modules: 2437,
          imports: 11356,
          modulesInKnots: 727,
          largestKnot: 516,
          mainKnot: 516,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2829,
          noCircularWarnings: 1958
        },
        knots: [
          { id: 0, size: 516 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: ['platform/telemetry/utils/groupMissingNodesByPack.ts'],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 14,
        kind: 'commit',
        parent: 13,
        sha: '0ccdb81ce10bfee24dcd9155d9e38ac3072ba897',
        short: '0ccdb81ce1',
        date: '2026-10-07T23:21:48Z',
        subject:
          'feat: Cloud cancellation flow with a reason survey and retention offer',
        pr: 19671,
        fe3037: false,
        stats: {
          modules: 2443,
          imports: 11390,
          modulesInKnots: 731,
          largestKnot: 520,
          mainKnot: 520,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2842,
          noCircularWarnings: 1966
        },
        knots: [
          { id: 0, size: 520 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [],
          entangled: [
            'platform/cloud/subscription/components/CancellationFlowDialogContent.vue',
            'platform/cloud/subscription/components/RetentionOfferStep.vue',
            'platform/cloud/subscription/composables/useCancellationPlan.ts',
            'platform/cloud/subscription/composables/useRetentionOffer.ts',
            'platform/cloud/subscription/utils/planCreditGrant.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 15,
        kind: 'commit',
        parent: 14,
        sha: 'dc556123bd1b548b726ce838b2f2b396779d28ff',
        short: 'dc556123bd',
        date: '2026-10-07T23:23:44Z',
        subject:
          'fix(billing): stop reading saved payment methods in the workspace top-up dialog',
        pr: 20367,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11384,
          modulesInKnots: 730,
          largestKnot: 519,
          mainKnot: 519,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2838,
          noCircularWarnings: 1963
        },
        knots: [
          { id: 0, size: 519 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 16,
        kind: 'commit',
        parent: 15,
        sha: 'f7f80ced2b86a88d4eb9a3e893a86a23ddd9bff5',
        short: 'f7f80ced2b',
        date: '2026-10-07T23:52:34Z',
        subject: 'ci: bump cursor-review to github-workflows@2d588e1',
        pr: 16110,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11384,
          modulesInKnots: 730,
          largestKnot: 519,
          mainKnot: 519,
          secondKnot: 160,
          knotCount: 11,
          importsInKnots: 2838,
          noCircularWarnings: 1963
        },
        knots: [
          { id: 0, size: 519 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 17,
        kind: 'commit',
        parent: 16,
        sha: '48079cf0a303f37ed61081d6521984b4806b6166',
        short: '48079cf0a3',
        date: '2026-10-07T23:58:15Z',
        subject:
          'refactor: register the settings dialog component from the app shell',
        pr: 19107,
        fe3037: true,
        stats: {
          modules: 2442,
          imports: 11386,
          modulesInKnots: 669,
          largestKnot: 455,
          mainKnot: 455,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2635,
          noCircularWarnings: 1859
        },
        knots: [
          { id: 0, size: 455 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/common/BackgroundImageUpload.vue',
            'components/common/FormItem.vue',
            'components/dialog/content/setting/AboutPanel.vue',
            'components/dialog/content/setting/CreditsPanel.vue',
            'components/dialog/content/setting/CurrentUserMessage.vue',
            'components/dialog/content/setting/KeybindingPanel.vue',
            'components/dialog/content/setting/UsageLogsTable.vue',
            'components/dialog/content/setting/UserPanel.vue',
            'components/dialog/content/setting/keybinding/KeybindingCommandRows.vue',
            'components/dialog/content/setting/keybinding/KeybindingPresetToolbar.vue',
            'composables/billing/useNextInvoice.ts',
            'composables/useVueFeatureFlags.ts',
            'platform/auth/session/components/SignOutEverywhereButton.vue',
            'platform/cloud/subscription/components/CreditsTile.vue',
            'platform/cloud/subscription/components/SubscriptionFooterLinks.vue',
            'platform/cloud/subscription/composables/useSubscriptionActions.ts',
            'platform/cloud/subscription/composables/useSubscriptionCredits.ts',
            'platform/keybindings/presetService.ts',
            'platform/secrets/api/secretsApi.ts',
            'platform/secrets/components/SecretFormDialog.vue',
            'platform/secrets/components/SecretsPanel.vue',
            'platform/secrets/composables/useSecretForm.ts',
            'platform/secrets/composables/useSecrets.ts',
            'platform/settings/components/ColorPaletteMessage.vue',
            'platform/settings/components/ExtensionPanel.vue',
            'platform/settings/components/ServerConfigPanel.vue',
            'platform/settings/components/SettingDialog.vue',
            'platform/settings/components/SettingGroup.vue',
            'platform/settings/components/SettingItem.vue',
            'platform/settings/components/SettingsPanel.vue',
            'platform/settings/components/SettingsWorkspaceHeader.vue',
            'platform/settings/composables/useSettingSearch.ts',
            'platform/settings/composables/useSettingUI.ts',
            'platform/skills/api/skillsApi.ts',
            'platform/skills/components/SkillPackFormDialog.vue',
            'platform/skills/components/SkillPacksPanel.vue',
            'platform/skills/composables/useSkillPackForm.ts',
            'platform/skills/composables/useSkillPacks.ts',
            'platform/skills/stores/skillPacksStore.ts',
            'platform/workspace/api/partnerNodePolicyApi.ts',
            'platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
            'platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
            'platform/workspace/components/dialogs/settings/MemberListItem.vue',
            'platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
            'platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue',
            'platform/workspace/components/dialogs/settings/PendingInvitesList.vue',
            'platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue',
            'platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue',
            'platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue',
            'platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue',
            'platform/workspace/components/dialogs/settings/WorkspaceSettingsPanelContent.vue',
            'platform/workspace/composables/useBillingBanner.ts',
            'platform/workspace/composables/useMembersPanel.ts',
            'platform/workspace/composables/usePlanEnded.ts',
            'platform/workspace/composables/useResubscribe.ts',
            'platform/workspace/composables/useTeamPlan.ts',
            'platform/workspace/composables/useWorkspaceMenuItems.ts',
            'platform/workspace/composables/useWorkspacePlanPricing.ts',
            'platform/workspace/stores/partnerNodeGovernanceStore.ts',
            'stores/aboutPanelStore.ts',
            'stores/userStore.ts'
          ],
          entangled: [],
          splits: [{ from: 0, into: [11] }]
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 18,
        kind: 'commit',
        parent: 17,
        sha: 'ef2ffce167139a47430dd378c3050fc20021b2f9',
        short: 'ef2ffce167',
        date: '2026-10-08T00:18:46Z',
        subject:
          'FE-3297 feat(auth): switch workspaces in the Desktop-hosted view',
        pr: 20484,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11388,
          modulesInKnots: 669,
          largestKnot: 455,
          mainKnot: 455,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2635,
          noCircularWarnings: 1859
        },
        knots: [
          { id: 0, size: 455 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 19,
        kind: 'commit',
        parent: 18,
        sha: 'fd5a5c2cccbdafe48ab099d4a3081c6ccdad6184',
        short: 'fd5a5c2ccc',
        date: '2026-10-08T00:20:45Z',
        subject: 'ci: import CI container source and validate candidates',
        pr: 20284,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11388,
          modulesInKnots: 669,
          largestKnot: 455,
          mainKnot: 455,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2635,
          noCircularWarnings: 1859
        },
        knots: [
          { id: 0, size: 455 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 20,
        kind: 'commit',
        parent: 19,
        sha: '56b4e1a92d7fc79f6da7d8b108eaf793eb190e58',
        short: '56b4e1a92d',
        date: '2026-10-08T00:40:25Z',
        subject: 'feat(website): add live docs changelog page',
        pr: 20227,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11388,
          modulesInKnots: 669,
          largestKnot: 455,
          mainKnot: 455,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2635,
          noCircularWarnings: 1859
        },
        knots: [
          { id: 0, size: 455 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 21,
        kind: 'commit',
        parent: 20,
        sha: 'bf75afd7fba34857274b96d72086adc6788c0e1e',
        short: 'bf75afd7fb',
        date: '2026-10-08T00:41:42Z',
        subject: 'refactor: render graph thumbnails from an explicit graph',
        pr: 19127,
        fe3037: true,
        stats: {
          modules: 2442,
          imports: 11389,
          modulesInKnots: 666,
          largestKnot: 452,
          mainKnot: 452,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2629,
          noCircularWarnings: 1856
        },
        knots: [
          { id: 0, size: 452 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'renderer/core/thumbnail/graphThumbnailRenderer.ts',
            'renderer/extensions/minimap/data/MinimapDataSource.ts',
            'renderer/extensions/minimap/minimapCanvasRenderer.ts'
          ],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 22,
        kind: 'commit',
        parent: 21,
        sha: 'f65f85ae862fbc0832bac1e87f8001d368118a0f',
        short: 'f65f85ae86',
        date: '2026-10-08T00:44:01Z',
        subject: 'refactor: keep blueprint node defs in nodeDefStore',
        pr: 19125,
        fe3037: true,
        stats: {
          modules: 2442,
          imports: 11388,
          modulesInKnots: 666,
          largestKnot: 452,
          mainKnot: 452,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2628,
          noCircularWarnings: 1885
        },
        knots: [
          { id: 0, size: 452 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 23,
        kind: 'commit',
        parent: 22,
        sha: '30ecb10b3dc106ab3c180819e3eb8574f9619275',
        short: '30ecb10b3d',
        date: '2026-10-08T01:39:57Z',
        subject:
          'FE-3297 refactor(auth): take the Desktop auth bridge types from the published package',
        pr: 20500,
        fe3037: false,
        stats: {
          modules: 2442,
          imports: 11388,
          modulesInKnots: 666,
          largestKnot: 452,
          mainKnot: 452,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2628,
          noCircularWarnings: 1885
        },
        knots: [
          { id: 0, size: 452 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 24,
        kind: 'commit',
        parent: 23,
        sha: '60948e606a52a6bfd3b6b73dafd5c006445ce1cf',
        short: '60948e606a',
        date: '2026-10-08T01:57:31Z',
        subject: 'refactor: make settingStore a leaf of the app graph',
        pr: 19122,
        fe3037: true,
        stats: {
          modules: 2442,
          imports: 11389,
          modulesInKnots: 663,
          largestKnot: 449,
          mainKnot: 449,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2610,
          noCircularWarnings: 1864
        },
        knots: [
          { id: 0, size: 449 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'scripts/ui/components/asyncDialog.ts',
            'scripts/ui/dialog.ts',
            'scripts/ui/toggleSwitch.ts'
          ],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 25,
        kind: 'commit',
        parent: 24,
        sha: '32d7b02f2ecf6107b3a78fb07e3e3f4a5257d6c4',
        short: '32d7b02f2e',
        date: '2026-10-08T02:33:47Z',
        subject:
          'refactor: move the empty-workflow dialog out of appModeStore.enterBuilder',
        pr: 19094,
        fe3037: true,
        stats: {
          modules: 2443,
          imports: 11394,
          modulesInKnots: 662,
          largestKnot: 448,
          mainKnot: 448,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2606,
          noCircularWarnings: 1861
        },
        knots: [
          { id: 0, size: 448 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: ['components/builder/useEmptyWorkflowDialog.ts'],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 26,
        kind: 'commit',
        parent: 25,
        sha: '382303f5ceabd3dbded47b433fcf838b2d1bf7eb',
        short: '382303f5ce',
        date: '2026-10-08T02:44:00Z',
        subject:
          'FE-3292 fix(billing-web): label a recovered payment with its own plan',
        pr: 20456,
        fe3037: false,
        stats: {
          modules: 2443,
          imports: 11394,
          modulesInKnots: 662,
          largestKnot: 448,
          mainKnot: 448,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2606,
          noCircularWarnings: 1861
        },
        knots: [
          { id: 0, size: 448 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 27,
        kind: 'commit',
        parent: 26,
        sha: '75050386a72c0e56207377f558214aa25d1eb6c6',
        short: '75050386a7',
        date: '2026-10-08T03:11:48Z',
        subject: 'fix: restore canvas pan/zoom after cancelling a title edit',
        pr: 18520,
        fe3037: false,
        stats: {
          modules: 2443,
          imports: 11394,
          modulesInKnots: 662,
          largestKnot: 448,
          mainKnot: 448,
          secondKnot: 160,
          knotCount: 12,
          importsInKnots: 2606,
          noCircularWarnings: 1861
        },
        knots: [
          { id: 0, size: 448 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 28,
        kind: 'commit',
        parent: 27,
        sha: '86a47c0c21a0fcf1e62a04dca8a9f418f4167fb7',
        short: '86a47c0c21',
        date: '2026-10-08T03:47:03Z',
        subject:
          'refactor: extract PositionConfig and layer editor dialog key into leaf modules',
        pr: 19112,
        fe3037: true,
        stats: {
          modules: 2445,
          imports: 11397,
          modulesInKnots: 660,
          largestKnot: 444,
          mainKnot: 444,
          secondKnot: 160,
          knotCount: 13,
          importsInKnots: 2578,
          noCircularWarnings: 1860
        },
        knots: [
          { id: 0, size: 444 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/graph/widgets/MultiSelectWidget.vue',
            'composables/element/useAbsolutePosition.ts'
          ],
          entangled: [],
          splits: [{ from: 0, into: [12] }]
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 29,
        kind: 'commit',
        parent: 28,
        sha: '03bca8ad7f4c928cdc860e34f44ba5274454e1e8',
        short: '03bca8ad7f',
        date: '2026-10-08T03:48:51Z',
        subject:
          'feat(agent): add an asset tray with independent inline references',
        pr: 20156,
        fe3037: false,
        stats: {
          modules: 2457,
          imports: 11438,
          modulesInKnots: 660,
          largestKnot: 444,
          mainKnot: 444,
          secondKnot: 160,
          knotCount: 13,
          importsInKnots: 2577,
          noCircularWarnings: 1859
        },
        knots: [
          { id: 0, size: 444 },
          { id: 9, size: 160 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'workbench/extensions/agent/composables/agent/useComposer.ts'
          ],
          entangled: ['workbench/extensions/agent/types/composerAttachment.ts'],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 30,
        kind: 'commit',
        parent: 29,
        sha: 'f36080c65314a6b2c2d8ad502a23a73f88360563',
        short: 'f36080c653',
        date: '2026-10-08T04:31:01Z',
        subject:
          'feat(light-info): 3D viewport widget for CreateLightInfo node',
        pr: 17696,
        fe3037: false,
        stats: {
          modules: 2470,
          imports: 11495,
          modulesInKnots: 663,
          largestKnot: 446,
          mainKnot: 446,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2584,
          noCircularWarnings: 1864
        },
        knots: [
          { id: 0, size: 446 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [],
          entangled: [
            'extensions/core/lightInfo.ts',
            'lib/litegraph/src/widgets/LightInfoWidget.ts',
            'renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 31,
        kind: 'commit',
        parent: 30,
        sha: '409c6eb00e51f3cb58f436a6133677d5077f165b',
        short: '409c6eb00e',
        date: '2026-10-08T04:44:17Z',
        subject: 'refactor(agent): doc reseed review nits',
        pr: 20264,
        fe3037: false,
        stats: {
          modules: 2470,
          imports: 11495,
          modulesInKnots: 663,
          largestKnot: 446,
          mainKnot: 446,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2584,
          noCircularWarnings: 1864
        },
        knots: [
          { id: 0, size: 446 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 32,
        kind: 'commit',
        parent: 31,
        sha: '0446e414717a6f10149933a4a94c5337de2e3efa',
        short: '0446e41471',
        date: '2026-10-08T04:55:13Z',
        subject:
          'refactor: register the asset browser modal from the app shell',
        pr: 19108,
        fe3037: true,
        stats: {
          modules: 2471,
          imports: 11499,
          modulesInKnots: 650,
          largestKnot: 433,
          mainKnot: 433,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2541,
          noCircularWarnings: 1834
        },
        knots: [
          { id: 0, size: 433 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'platform/assets/components/AssetBrowserModal.vue',
            'platform/assets/components/AssetCard.vue',
            'platform/assets/components/AssetGrid.vue',
            'platform/assets/components/UploadModelConfirmation.vue',
            'platform/assets/components/UploadModelDialog.vue',
            'platform/assets/components/UploadModelProgress.vue',
            'platform/assets/components/UploadModelUpgradeModal.vue',
            'platform/assets/components/UploadModelUrlInput.vue',
            'platform/assets/components/modelInfo/ModelInfoPanel.vue',
            'platform/assets/composables/useAssetBrowser.ts',
            'platform/assets/composables/useModelTypes.ts',
            'platform/assets/composables/useModelUpload.ts',
            'platform/assets/composables/useUploadModelWizard.ts'
          ],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 33,
        kind: 'commit',
        parent: 32,
        sha: '8aad94f19f5948f5a1788716b70eb5c41c47ecce',
        short: '8aad94f19f',
        date: '2026-10-08T04:55:14Z',
        subject: 'refactor: register core bottom panel tabs from GraphView',
        pr: 19111,
        fe3037: true,
        stats: {
          modules: 2472,
          imports: 11501,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1823
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue',
            'components/bottomPanel/tabs/shortcuts/ShortcutsList.vue',
            'components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue',
            'components/bottomPanel/tabs/terminal/LogsTerminal.vue',
            'composables/bottomPanelTabs/useCommandSubcategories.ts',
            'composables/bottomPanelTabs/useLogsTerminal.ts',
            'composables/bottomPanelTabs/useShortcutsTab.ts',
            'composables/bottomPanelTabs/useTerminalTabs.ts'
          ],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 34,
        kind: 'commit',
        parent: 33,
        sha: 'acc583a77fbe08c70acefc9964d281f6d9d05680',
        short: 'acc583a77f',
        date: '2026-10-08T05:10:25Z',
        subject: 'test: spy on console globally in Vitest setup',
        pr: 20498,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11501,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1823
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 35,
        kind: 'commit',
        parent: 34,
        sha: '302d95fe3654db4c538ef08171f40fd25dd81b36',
        short: '302d95fe36',
        date: '2026-10-07T22:42:09-07:00',
        subject:
          'fix(agent): reuse an in-session upload when the same file is attached again',
        pr: 20417,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11501,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1823
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 36,
        kind: 'commit',
        parent: 35,
        sha: '98c9d581f519d439b40d0036b2be723350aa8aa1',
        short: '98c9d581f5',
        date: '2026-10-08T05:46:30Z',
        subject:
          'fix: stop Nodes Manager grid overflowing the dialog at >=3000px viewports',
        pr: 18605,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11501,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1823
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 37,
        kind: 'commit',
        parent: 36,
        sha: 'e541bbdf052a73d778539da1dfe580af82e2fe6a',
        short: 'e541bbdf05',
        date: '2026-10-08T05:50:17Z',
        subject:
          'refactor: move mask editor node menu item into Comfy.MaskEditor extension',
        pr: 19109,
        fe3037: true,
        stats: {
          modules: 2472,
          imports: 11502,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 38,
        kind: 'commit',
        parent: 37,
        sha: '6b0f2bd013fa16c33932085ba519cf8967b03fa7',
        short: '6b0f2bd013',
        date: '2026-10-08T05:50:35Z',
        subject: 'fix: pointer gesture review follow-ups',
        pr: 20455,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11503,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 39,
        kind: 'commit',
        parent: 38,
        sha: '3cad6c3bfe82b18d4c389bae51f5f8fa4f145477',
        short: '3cad6c3bfe',
        date: '2026-10-08T09:20:46Z',
        subject: 'perf: virtualize combo widget dropdown (FE-1166)',
        pr: 20523,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11503,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 40,
        kind: 'commit',
        parent: 39,
        sha: 'b1d9ab95774b0173fd42c332978b63455c2e30ce',
        short: 'b1d9ab9577',
        date: '2026-10-08T09:28:32Z',
        subject:
          'FE-3317 fix(billing-web): wait for the web-session decision instead of falling back to a stale sign-in',
        pr: 20532,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11503,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 41,
        kind: 'commit',
        parent: 40,
        sha: '60d58f22520fbe90d3b31912e1c89b5e9348a154',
        short: '60d58f2252',
        date: '2026-10-08T09:34:34Z',
        subject:
          'chore(deps): pin @comfyorg/comfy-multi-player 0.3.10, with the browser proof of what it fixes (FE-3036)',
        pr: 20096,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11503,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 42,
        kind: 'commit',
        parent: 41,
        sha: 'df04d57055a9794fe525a4ec45cf7aa19fef8743',
        short: 'df04d57055',
        date: '2026-10-08T11:35:14Z',
        subject:
          'FE-3319 fix(auth): close open dialogs when signed out from another tab',
        pr: 20545,
        fe3037: false,
        stats: {
          modules: 2472,
          imports: 11504,
          modulesInKnots: 642,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 161,
          knotCount: 13,
          importsInKnots: 2522,
          noCircularWarnings: 1821
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 161 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 43,
        kind: 'commit',
        parent: 42,
        sha: '10132676ea207fe1af52b5b701e8356cf429abc6',
        short: '10132676ea',
        date: '2026-10-08T12:11:01Z',
        subject:
          'refactor: split litegraph interfaces into leaf and graph-bound types',
        pr: 19088,
        fe3037: true,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'lib/litegraph/src/LGraphBadge.ts',
            'lib/litegraph/src/LGraphButton.ts',
            'lib/litegraph/src/canvas/reduceGesture.ts',
            'lib/litegraph/src/infrastructure/ConstrainedSize.ts',
            'lib/litegraph/src/infrastructure/Rectangle.ts',
            'lib/litegraph/src/interfaces.ts',
            'lib/litegraph/src/measure.ts',
            'lib/litegraph/src/node/SlotBase.ts',
            'stores/linkStore.ts',
            'stores/rerouteStore.ts',
            'types/linkTopology.ts'
          ],
          entangled: [
            'lib/litegraph/src/types/contextMenu.ts',
            'lib/litegraph/src/types/linkNetwork.ts',
            'lib/litegraph/src/types/panel.ts',
            'lib/litegraph/src/types/slots.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 44,
        kind: 'commit',
        parent: 43,
        sha: '9a9fa365578f7270cac91b3a1e5caf73dfcf5a0e',
        short: '9a9fa36557',
        date: '2026-10-08T12:24:12Z',
        subject:
          'FE-3320 fix(workspace): keep workflow drafts per workspace under the web session',
        pr: 20547,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 45,
        kind: 'commit',
        parent: 44,
        sha: 'b786346badf345d2782e81504bf46b4df122e374',
        short: 'b786346bad',
        date: '2026-10-08T14:49:27Z',
        subject:
          "FE-3322 fix(workspace): refuse a removed member's Run instead of moving it to Personal",
        pr: 20558,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 46,
        kind: 'commit',
        parent: 45,
        sha: '91e07cf1443d69b31e3b331cf4c0df90c4ee698a',
        short: '91e07cf144',
        date: '2026-10-08T17:28:28Z',
        subject:
          'feat(website): restructure top navigation with Enterprise menu and merged Company menu',
        pr: 20504,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 47,
        kind: 'commit',
        parent: 46,
        sha: '75e3fcaf09e8d1b231fd4b7dc399c0bbbab4e3c5',
        short: '75e3fcaf09',
        date: '2026-10-08T17:50:03Z',
        subject:
          "FE-3267 chore(qa): point a Desktop local install at a frontend PR's CI build",
        pr: 20559,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 48,
        kind: 'commit',
        parent: 47,
        sha: '45e4e161d191b48bc8e03785929587e908924385',
        short: '45e4e161d1',
        date: '2026-10-08T18:13:05Z',
        subject:
          'FE-3297 refactor(auth): use bridge types 0.5.0 and report Desktop workspace refresh failures',
        pr: 20531,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 49,
        kind: 'commit',
        parent: 48,
        sha: '4187b4ef8283e7839a27b0b1ac3711019d12ee17',
        short: '4187b4ef82',
        date: '2026-10-08T18:14:13Z',
        subject:
          'FE-3323 fix(billing-web): read the checkout UI flag on the shared web session',
        pr: 20567,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 50,
        kind: 'commit',
        parent: 49,
        sha: 'f5304f171effd1afe1c7ea6fc5afbb4426141fb1',
        short: 'f5304f171e',
        date: '2026-10-08T18:18:49Z',
        subject:
          'FE-3298 test(cloud): pin the full-page SSO return to the served consent path',
        pr: 20533,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 51,
        kind: 'commit',
        parent: 50,
        sha: 'bade42b3044791c664f21c21c8685bcd4ef6b814',
        short: 'bade42b304',
        date: '2026-10-08T18:22:28Z',
        subject:
          "FE-3267 fix(auth): stop repeating a Desktop account's email as its name",
        pr: 20536,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11582,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2465,
          noCircularWarnings: 1751
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 52,
        kind: 'commit',
        parent: 51,
        sha: '956b31e5922b6a5d78a573b5e3c87239f8feeebb',
        short: '956b31e592',
        date: '2026-10-08T18:23:25Z',
        subject:
          "FE-3318 fix(billing): name the client on the subscribe and top-up callers' own operation events",
        pr: 20535,
        fe3037: false,
        stats: {
          modules: 2476,
          imports: 11583,
          modulesInKnots: 635,
          largestKnot: 425,
          mainKnot: 425,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2466,
          noCircularWarnings: 1752
        },
        knots: [
          { id: 0, size: 425 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 53,
        kind: 'commit',
        parent: 52,
        sha: '0ef0276323b5819258571bbffe24af14af47dc2e',
        short: '0ef0276323',
        date: '2026-10-08T19:35:06Z',
        subject:
          'refactor: move model library asset browser routing onto the sidebar tab',
        pr: 19113,
        fe3037: true,
        stats: {
          modules: 2476,
          imports: 11583,
          modulesInKnots: 631,
          largestKnot: 421,
          mainKnot: 421,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2451,
          noCircularWarnings: 1741
        },
        knots: [
          { id: 0, size: 421 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'composables/node/startModelNodeDragFromAsset.ts',
            'composables/node/useNodeDragToCanvas.ts',
            'platform/assets/composables/openModelLibraryBrowser.ts',
            'platform/assets/utils/resolveModelNodeFromAsset.ts'
          ],
          entangled: [],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 54,
        kind: 'commit',
        parent: 53,
        sha: '481b5a6043f99cef7900e15bd9ce06cfca99bb82',
        short: '481b5a6043',
        date: '2026-10-08T19:46:52Z',
        subject:
          'fix(paste): ignore clipboard node metadata left by an earlier copy',
        pr: 15884,
        fe3037: false,
        stats: {
          modules: 2477,
          imports: 11590,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: ['composables/useCopy.ts'], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 55,
        kind: 'commit',
        parent: 54,
        sha: 'b209d37d76a79f6f962fcb1d1b4a53f88dca3b63',
        short: 'b209d37d76',
        date: '2026-10-08T20:12:53Z',
        subject:
          'fix(telemetry): keep platform axes and desktop entry props across logout reset',
        pr: 13503,
        fe3037: false,
        stats: {
          modules: 2477,
          imports: 11590,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 56,
        kind: 'commit',
        parent: 55,
        sha: 'e7316710a9b15e3a4bf45df07aff28ceb10b06c6',
        short: 'e7316710a9',
        date: '2026-10-08T20:15:21Z',
        subject: 'ci: bump cursor-review to github-workflows@06f835f',
        pr: 20505,
        fe3037: false,
        stats: {
          modules: 2477,
          imports: 11590,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 57,
        kind: 'commit',
        parent: 56,
        sha: 'eaad63d7260ad1ceae6def39c2d97bf31c476555',
        short: 'eaad63d726',
        date: '2026-10-08T20:41:51Z',
        subject: 'fix(surveys): preserve pending feature usage',
        pr: 20581,
        fe3037: false,
        stats: {
          modules: 2477,
          imports: 11590,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 58,
        kind: 'commit',
        parent: 57,
        sha: 'ad31b1ed7feb2c141f963d55e414b8f794fb2fa6',
        short: 'ad31b1ed7f',
        date: '2026-10-08T20:58:58Z',
        subject: 'fix(website): uppercase desktop nav category headings',
        pr: 20582,
        fe3037: false,
        stats: {
          modules: 2477,
          imports: 11590,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 59,
        kind: 'commit',
        parent: 58,
        sha: '9668c9f8047f4240628a9ba913d9b27188a6fb5e',
        short: '9668c9f804',
        date: '2026-10-08T21:00:32Z',
        subject:
          'fix(telemetry): instrument Vue directive failures and repair source maps',
        pr: 20000,
        fe3037: false,
        stats: {
          modules: 2478,
          imports: 11591,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 60,
        kind: 'commit',
        parent: 59,
        sha: 'efdb54e71ab09bb11d531c8bf2bc3a4285609ada',
        short: 'efdb54e71a',
        date: '2026-10-08T21:02:25Z',
        subject:
          'feat(deploy): hand the workflow to a coding agent as a Comfy API brief',
        pr: 17966,
        fe3037: false,
        stats: {
          modules: 2481,
          imports: 11607,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 61,
        kind: 'commit',
        parent: 60,
        sha: '559647b5da239413188f226434ff96c96d7fd0fe',
        short: '559647b5da',
        date: '2026-10-08T14:42:13-07:00',
        subject: 'fix(agent): route promoted widgets through callbacks',
        pr: 19332,
        fe3037: false,
        stats: {
          modules: 2481,
          imports: 11607,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 62,
        kind: 'commit',
        parent: 61,
        sha: 'ef9481abcec3f45b73396568818fc0ba976657a4',
        short: 'ef9481abce',
        date: '2026-10-08T22:09:25Z',
        subject: 'test: make the network guard the shared fetch mock',
        pr: 20499,
        fe3037: false,
        stats: {
          modules: 2481,
          imports: 11607,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 63,
        kind: 'commit',
        parent: 62,
        sha: '400f638ba1e9248a6913982fe6082e36eaf5e16d',
        short: '400f638ba1',
        date: '2026-10-08T23:11:02Z',
        subject:
          'FE-3267 chore(qa): build a Desktop QA frontend against one backend with --env',
        pr: 20589,
        fe3037: false,
        stats: {
          modules: 2481,
          imports: 11607,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 64,
        kind: 'commit',
        parent: 63,
        sha: '341dce21c1f575456d026f567f1015d15a52980b',
        short: '341dce21c1',
        date: '2026-10-08T23:11:22Z',
        subject:
          'FE-3326 fix(cloud): render dialogs on the Cloud sign-in pages in the dark theme',
        pr: 20590,
        fe3037: false,
        stats: {
          modules: 2482,
          imports: 11609,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 65,
        kind: 'commit',
        parent: 64,
        sha: 'a6a494b65bd367b899b67fc21e8970cbfc507ed0',
        short: 'a6a494b65b',
        date: '2026-10-08T23:29:25Z',
        subject:
          'chore(deps): bump actions/upload-pages-artifact from 3.0.1 to 5.0.0',
        pr: 15496,
        fe3037: false,
        stats: {
          modules: 2482,
          imports: 11609,
          modulesInKnots: 632,
          largestKnot: 422,
          mainKnot: 422,
          secondKnot: 154,
          knotCount: 13,
          importsInKnots: 2454,
          noCircularWarnings: 1743
        },
        knots: [
          { id: 0, size: 422 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 66,
        kind: 'commit',
        parent: 65,
        sha: '9b91a0c8331da05cf9d92f408688d1e6b3d16561',
        short: '9b91a0c833',
        date: '2026-10-08T23:33:20Z',
        subject:
          'refactor: load extensions from the bootstrap step, not extensionService',
        pr: 19092,
        fe3037: true,
        stats: {
          modules: 2483,
          imports: 11612,
          modulesInKnots: 501,
          largestKnot: 286,
          mainKnot: 286,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2037,
          noCircularWarnings: 1510
        },
        knots: [
          { id: 0, size: 286 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [
            'components/cameraAngle/CameraAngle.vue',
            'components/cameraInfo/CameraInfo.vue',
            'components/custom/widget/TemplateFilterControls.vue',
            'components/custom/widget/WorkflowTemplateSelectorDialog.vue',
            'components/load3d/Load3D.vue',
            'components/load3d/Load3DAdvanced.vue',
            'components/load3d/Load3DMenuBar.vue',
            'components/load3d/Load3dViewerContent.vue',
            'components/load3d/controls/ViewerControls.vue',
            'components/load3d/controls/viewer/ViewerLightControls.vue',
            'components/load3d/menubar/LightMenuGroup.vue',
            'components/maskeditor/ImageLayerSettingsPanel.vue',
            'components/maskeditor/MaskEditorContent.vue',
            'components/maskeditor/PointerZone.vue',
            'components/maskeditor/SidePanel.vue',
            'components/maskeditor/ToolPanel.vue',
            'components/maskeditor/dialog/TopBarHeader.vue',
            'composables/maskeditor/useBrushDrawing.ts',
            'composables/maskeditor/useBrushPersistence.ts',
            'composables/maskeditor/useMaskEditor.ts',
            'composables/maskeditor/useMaskEditorLoader.ts',
            'composables/maskeditor/useMaskEditorSaver.ts',
            'composables/maskeditor/useToolManager.ts',
            'composables/useCameraAngle.ts',
            'composables/useCameraInfo.ts',
            'composables/useTemplateFiltering.ts',
            'composables/useViewportNodeWiring.ts',
            'composables/useWorkflowTemplateSelectorDialog.ts',
            'extensions/core/agentPanel.ts',
            'extensions/core/cameraAngle.ts',
            'extensions/core/cameraAngle/CameraAngleViewport.ts',
            'extensions/core/cameraInfo.ts',
            'extensions/core/cameraInfo/CameraInfoViewport.ts',
            'extensions/core/clipspace.ts',
            'extensions/core/cloudBadges.ts',
            'extensions/core/cloudFeedbackTopbarButton.ts',
            'extensions/core/cloudRemoteConfig.ts',
            'extensions/core/cloudSessionCookie.ts',
            'extensions/core/contextMenuFilter.ts',
            'extensions/core/createBoundingBoxes.ts',
            'extensions/core/customWidgets.ts',
            'extensions/core/dynamicPrompts.ts',
            'extensions/core/editAttention.ts',
            'extensions/core/electronAdapter.ts',
            'extensions/core/groupNode.ts',
            'extensions/core/groupOptions.ts',
            'extensions/core/imageCompare.ts',
            'extensions/core/imageCompositor.ts',
            'extensions/core/imageCrop.ts',
            'extensions/core/index.ts',
            'extensions/core/layerEditor.ts',
            'extensions/core/lightInfo.ts',
            'extensions/core/load3d.ts',
            'extensions/core/load3d/HDRIManager.ts',
            'extensions/core/load3d/Load3DConfiguration.ts',
            'extensions/core/load3d/Load3d.ts',
            'extensions/core/load3d/LoaderManager.ts',
            'extensions/core/load3d/MeshModelAdapter.ts',
            'extensions/core/load3d/ModelAdapter.ts',
            'extensions/core/load3d/PointCloudModelAdapter.ts',
            'extensions/core/load3d/SceneManager.ts',
            'extensions/core/load3d/SceneModelManager.ts',
            'extensions/core/load3d/SplatModelAdapter.ts',
            'extensions/core/load3d/Viewport3d.ts',
            'extensions/core/load3d/createLoad3d.ts',
            'extensions/core/load3d/createViewport3d.ts',
            'extensions/core/load3d/exportMenuHelper.ts',
            'extensions/core/load3d/load3dSerialize.ts',
            'extensions/core/load3dAdvanced.ts',
            'extensions/core/load3dLazy.ts',
            'extensions/core/load3dPreviewExtensions.ts',
            'extensions/core/maskeditor.ts',
            'extensions/core/nodeTemplates.ts',
            'extensions/core/noteNode.ts',
            'extensions/core/painter.ts',
            'extensions/core/previewAny.ts',
            'extensions/core/rerouteNode.ts',
            'extensions/core/saveImageExtraOutput.ts',
            'extensions/core/saveMesh.ts',
            'extensions/core/saveText.ts',
            'extensions/core/selectionBorder.ts',
            'extensions/core/simpleTouchSupport.ts',
            'extensions/core/slotDefaultTypes.ts',
            'extensions/core/slotDefaults.ts',
            'extensions/core/textPreviewWidgets.ts',
            'extensions/core/uploadAudio.ts',
            'extensions/core/uploadImage.ts',
            'extensions/core/webcamCapture.ts',
            'extensions/core/widgetValuePropagation.ts',
            'platform/assets/utils/assetPreviewUtil.ts',
            'platform/assets/utils/assetUrlUtil.ts',
            'platform/missingModel/folderPathCache.ts',
            'platform/onboarding/onboardingTourStore.ts',
            'platform/onboarding/useTourTriggers.ts',
            'platform/settings/globalSettingsApi.ts',
            'platform/support/feedbackDialog.ts',
            'platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue',
            'platform/workflow/sharing/composables/useSharedWorkflowUrlLoader.ts',
            'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
            'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
            'platform/workflow/templates/composables/useTemplateWorkflows.ts',
            'platform/workflow/templates/services/templateInputService.ts',
            'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
            'platform/workflow/templates/utils/templateModelMetadata.ts',
            'platform/workflow/templates/utils/templateModelSetup.ts',
            'renderer/extensions/compositor/composables/compositorSession.ts',
            'renderer/extensions/firstRunTour/gettingStarted/firstRunEntry.ts',
            'renderer/extensions/firstRunTour/roles/resolveTourRoles.ts',
            'renderer/extensions/firstRunTour/roles/tourSequence.ts',
            'renderer/extensions/firstRunTour/tour/cameraFraming.ts',
            'renderer/extensions/firstRunTour/tour/canvasCoachTarget.ts',
            'renderer/extensions/firstRunTour/tour/firstRunTourDefinition.ts',
            'renderer/extensions/firstRunTour/tour/useFirstRunTourController.ts',
            'renderer/extensions/layerEditor/components/LayerEditorContent.vue',
            'renderer/extensions/layerEditor/composables/layerEditorDialog.ts',
            'renderer/extensions/layerEditor/composables/useLayerEditor.ts',
            'renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue',
            'renderer/extensions/vueNodes/widgets/utils/audioUtils.ts',
            'services/audioService.ts',
            'services/useNewUserService.ts',
            'stores/modelStore.ts',
            'types/index.ts',
            'workbench/extensions/agent/composables/agent/useAgentConsent.ts',
            'workbench/extensions/agent/crdt/docOpMinter.ts',
            'workbench/extensions/agent/crdt/restoreOpMinter.ts',
            'workbench/extensions/agent/services/agent/workflowTabActivityTracker.ts',
            'workbench/extensions/agent/stores/agent/agentComposerStore.ts',
            'workbench/extensions/agent/stores/agent/agentConsentStore.ts',
            'workbench/extensions/agent/types/composerAttachment.ts',
            'workbench/extensions/agent/types/composerPrompt.ts',
            'workbench/extensions/agent/utils/composerPrompt.ts'
          ],
          entangled: [],
          splits: [{ from: 0, into: [13, 14] }]
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 67,
        kind: 'commit',
        parent: 66,
        sha: 'e2f3d6f9ac4a51640de301614b35c4c16784c081',
        short: 'e2f3d6f9ac',
        date: '2026-10-09T00:36:39Z',
        subject:
          'FE-3329 fix(auth): send an sso_required refusal at customer creation to SSO',
        pr: 20595,
        fe3037: false,
        stats: {
          modules: 2483,
          imports: 11613,
          modulesInKnots: 501,
          largestKnot: 286,
          mainKnot: 286,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2038,
          noCircularWarnings: 1510
        },
        knots: [
          { id: 0, size: 286 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 68,
        kind: 'commit',
        parent: 67,
        sha: '8bcbd9f3cd912fe28e21d05b02439f71591d250d',
        short: '8bcbd9f3cd',
        date: '2026-10-09T01:11:16Z',
        subject:
          'fix(agent): stop a run-mode change from overtaking a message already sent',
        pr: 18706,
        fe3037: false,
        stats: {
          modules: 2485,
          imports: 11617,
          modulesInKnots: 501,
          largestKnot: 286,
          mainKnot: 286,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2038,
          noCircularWarnings: 1510
        },
        knots: [
          { id: 0, size: 286 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 69,
        kind: 'commit',
        parent: 68,
        sha: '6e5d1b09e610c829a2486cbce3a3a1e866b02f02',
        short: '6e5d1b09e6',
        date: '2026-10-09T01:17:27Z',
        subject:
          'FE-3330 fix(workspace): hide the lone Active members tab when there is no Pending tab',
        pr: 20597,
        fe3037: false,
        stats: {
          modules: 2485,
          imports: 11617,
          modulesInKnots: 501,
          largestKnot: 286,
          mainKnot: 286,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2038,
          noCircularWarnings: 1510
        },
        knots: [
          { id: 0, size: 286 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 70,
        kind: 'commit',
        parent: 69,
        sha: 'ad519d7d089aa11eb37e036366b739a2f0f50104',
        short: 'ad519d7d08',
        date: '2026-10-09T01:27:58Z',
        subject:
          'FE-3331 feat(workspace): disable creating a workspace when an SSO organization manages them',
        pr: 20600,
        fe3037: false,
        stats: {
          modules: 2485,
          imports: 11617,
          modulesInKnots: 501,
          largestKnot: 286,
          mainKnot: 286,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2038,
          noCircularWarnings: 1510
        },
        knots: [
          { id: 0, size: 286 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 71,
        kind: 'commit',
        parent: 70,
        sha: '18a9c4210382fab896a7e00c7db5b141cefadef6',
        short: '18a9c42103',
        date: '2026-10-09T01:30:07Z',
        subject: '[Phase 6a] Replace PrimeVue Toast with design-system toast',
        pr: 16313,
        fe3037: false,
        stats: {
          modules: 2491,
          imports: 11687,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [],
          entangled: [
            'base/common/downloadUtil.ts',
            'components/ui/toast/toastStore.ts',
            'composables/useCopyToClipboard.ts',
            'composables/useErrorHandling.ts',
            'platform/workflow/sharing/components/publish/ComfyHubExamplesStep.vue',
            'platform/workflow/sharing/components/publish/ComfyHubThumbnailStep.vue',
            'platform/workflow/sharing/utils/validateFileSize.ts',
            'platform/workflow/validation/composables/useWorkflowValidation.ts',
            'platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
            'services/uploadTempFile.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 72,
        kind: 'commit',
        parent: 71,
        sha: 'e3e1b1513fe0663cffaf0d60b964ef4ece93bd1e',
        short: 'e3e1b1513f',
        date: '2026-10-09T04:34:54Z',
        subject: 'feat(website): add a footer language switcher',
        pr: 20351,
        fe3037: false,
        stats: {
          modules: 2491,
          imports: 11687,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 73,
        kind: 'commit',
        parent: 72,
        sha: '2df273eba61476df129984a423cd686634622d3a',
        short: '2df273eba6',
        date: '2026-10-08T23:27:08-07:00',
        subject: 'feat(agent): run starter prompt set experiment',
        pr: 20272,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11694,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 74,
        kind: 'commit',
        parent: 73,
        sha: 'f5e2dddc56b60c0cf4f10c48c41d750ae6e9e31d',
        short: 'f5e2dddc56',
        date: '2026-10-09T06:05:54Z',
        subject: 'fix: anchor popovers correctly inside transformed nodes',
        pr: 20592,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 75,
        kind: 'commit',
        parent: 74,
        sha: 'f9be289d9b15dd19df1326004a382d1fff624cb9',
        short: 'f9be289d9b',
        date: '2026-10-09T07:03:32Z',
        subject: 'test: pass mocks to expect without vi.mocked',
        pr: 20501,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 76,
        kind: 'commit',
        parent: 75,
        sha: '6848aae66dae7d3e18d4fc2c495eb092819c2969',
        short: '6848aae66d',
        date: '2026-10-09T10:36:33Z',
        subject: '[chore] Update Ingest API types from cloud@ec94fb3',
        pr: 20408,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 77,
        kind: 'commit',
        parent: 76,
        sha: 'aaaf9541a0c1df911f2f7baf0ca7b0af199109d9',
        short: 'aaaf9541a0',
        date: '2026-10-09T10:55:23Z',
        subject: 'account-core 1.0.0-alpha.4',
        pr: 20628,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 78,
        kind: 'commit',
        parent: 77,
        sha: '70c0a86139dfa96b51eadeafed43f60c49e7096d',
        short: '70c0a86139',
        date: '2026-10-09T11:46:33Z',
        subject: 'ingest-types 1.2.0',
        pr: 20635,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 79,
        kind: 'commit',
        parent: 78,
        sha: 'a15cc51782933d53597a767aedb1cef546e24e35',
        short: 'a15cc51782',
        date: '2026-10-09T14:29:23Z',
        subject:
          'FE-3342 fix(billing-web): offer Continue with SSO on an sso_required refusal',
        pr: 20632,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 80,
        kind: 'commit',
        parent: 79,
        sha: '5d0752358d42a5f59c257828dd09d60a0e765d4d',
        short: '5d0752358d',
        date: '2026-10-09T14:30:11Z',
        subject:
          "FE-3343 feat(workspace): open the SSO organization's workspace after an SSO sign-in",
        pr: 20634,
        fe3037: false,
        stats: {
          modules: 2492,
          imports: 11695,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 81,
        kind: 'commit',
        parent: 80,
        sha: '3d8e7bb91b33aeb21a57f8d74d3e5d5966b22e89',
        short: '3d8e7bb91b',
        date: '2026-10-09T14:32:00Z',
        subject: 'feat: add slash skill selection to Agent composer',
        pr: 20314,
        fe3037: false,
        stats: {
          modules: 2502,
          imports: 11749,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 82,
        kind: 'commit',
        parent: 81,
        sha: 'dcbefa02208af48cd0c5d28a8764f1c8f30a1282',
        short: 'dcbefa0220',
        date: '2026-10-09T15:39:23Z',
        subject: '[chore] Update Ingest API types from cloud@4e01169',
        pr: 20646,
        fe3037: false,
        stats: {
          modules: 2502,
          imports: 11749,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 83,
        kind: 'commit',
        parent: 82,
        sha: '206b0087cf7e48c672c8de2bdb944e5256c180f3',
        short: '206b0087cf',
        date: '2026-10-09T16:01:38Z',
        subject:
          'FE-3346 fix(billing-web): offer Continue with SSO when the shared session is refused sso_required',
        pr: 20649,
        fe3037: false,
        stats: {
          modules: 2502,
          imports: 11749,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 84,
        kind: 'commit',
        parent: 83,
        sha: 'bcee1acf0983aa31289fb5076429776a7351bf5e',
        short: 'bcee1acf09',
        date: '2026-10-09T16:32:42Z',
        subject:
          'fix(website): show sitewide Comfy Agent banner on /platform and /events',
        pr: 20619,
        fe3037: false,
        stats: {
          modules: 2502,
          imports: 11749,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 85,
        kind: 'commit',
        parent: 84,
        sha: 'f5da1a971809216a2345b7e4f1053081bf1b2842',
        short: 'f5da1a9718',
        date: '2026-10-09T16:33:06Z',
        subject:
          'fix(execution): land run outputs on agent-inserted nodes (PM-2037)',
        pr: 20601,
        fe3037: false,
        stats: {
          modules: 2502,
          imports: 11749,
          modulesInKnots: 511,
          largestKnot: 296,
          mainKnot: 296,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2121,
          noCircularWarnings: 1628
        },
        knots: [
          { id: 0, size: 296 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: { freed: [], entangled: [], splits: [] },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      },
      {
        index: 86,
        kind: 'commit',
        parent: 85,
        sha: '85a816b0937cca7fe432894676d3f3b27d30c740',
        short: '85a816b093',
        date: '2026-10-09T17:14:34Z',
        subject:
          'FE-3345 feat(auth): show the SSO-required notice inline on Cloud sign-in pages',
        pr: 20647,
        fe3037: false,
        stats: {
          modules: 2505,
          imports: 11759,
          modulesInKnots: 513,
          largestKnot: 298,
          mainKnot: 298,
          secondKnot: 154,
          knotCount: 15,
          importsInKnots: 2125,
          noCircularWarnings: 1630
        },
        knots: [
          { id: 0, size: 298 },
          { id: 9, size: 154 },
          { id: 1, size: 28 },
          { id: 8, size: 6 },
          { id: 10, size: 5 },
          { id: 13, size: 3 },
          { id: 11, size: 3 },
          { id: 2, size: 2 },
          { id: 3, size: 2 },
          { id: 12, size: 2 },
          { id: 4, size: 2 },
          { id: 5, size: 2 },
          { id: 6, size: 2 },
          { id: 14, size: 2 },
          { id: 7, size: 2 }
        ],
        delta: {
          freed: [],
          entangled: [
            'platform/auth/sso/ssoRequiredInline.ts',
            'platform/auth/sso/useContinueWithSso.ts'
          ],
          splits: []
        },
        architecture: {
          workspacePackages: [
            'account-core',
            'account-ui',
            'billing-contract',
            'design-system',
            'ingest-types',
            'object-info-parser',
            'registry-types',
            'shared-frontend-utils',
            'tailwind-utils',
            'test-utils'
          ],
          status: 'no-records'
        }
      }
    ],
    openPrs: {
      label: 'refactor-gordian-knot',
      fetchedAt: '2026-10-09T17:40:10.367Z',
      main: '85a816b0937cca7fe432894676d3f3b27d30c740',
      states: [
        {
          index: 87,
          kind: 'pr',
          parent: 71,
          sha: 'f1908f4bdd9a2e3b14764f7c9a3d63e06d718b4a',
          short: 'f1908f4bdd',
          date: '2026-10-09T01:43:14Z',
          subject:
            'refactor: split widget constructor type and value-control helpers out of scripts/widgets',
          pr: 19093,
          stats: {
            modules: 2493,
            imports: 11699,
            modulesInKnots: 496,
            largestKnot: 281,
            mainKnot: 281,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2085,
            noCircularWarnings: 1610
          },
          knots: [
            { id: 0, size: 281 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'renderer/extensions/vueNodes/widgets/composables/useBooleanWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useChartWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useColorWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useColorsWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useCompositorWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useCurveWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useRangeWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useResolutionPreviewWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useTextareaWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget.ts'
            ],
            entangled: [
              'core/graph/subgraph/promotedWidgetControl.ts',
              'core/graph/widgets/valueControlWidgets.ts'
            ],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 88,
          kind: 'pr',
          parent: 71,
          sha: 'dd32a979ac2ff2e894972ee88cff4267bfceeed9',
          short: 'dd32a979ac',
          date: '2026-10-08T19:37:05Z',
          subject:
            'refactor: move progress text previews out of executionStore',
          pr: 19116,
          stats: {
            modules: 2492,
            imports: 11691,
            modulesInKnots: 508,
            largestKnot: 293,
            mainKnot: 293,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2112,
            noCircularWarnings: 1620
          },
          knots: [
            { id: 0, size: 293 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'components/graph/widgets/TextPreviewWidget.vue',
              'composables/node/useNodeProgressText.ts',
              'renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget.ts'
            ],
            entangled: [],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 89,
          kind: 'pr',
          parent: 71,
          sha: '4e31bda28797f0c58642cebedbcd0d8ade93ecce',
          short: '4e31bda287',
          date: '2026-10-09T02:19:56Z',
          subject:
            'refactor: inject the api auth provider from the composition root',
          pr: 19118,
          stats: {
            modules: 2494,
            imports: 11697,
            modulesInKnots: 457,
            largestKnot: 232,
            mainKnot: 232,
            secondKnot: 154,
            knotCount: 17,
            importsInKnots: 1811,
            noCircularWarnings: 1341
          },
          knots: [
            { id: 0, size: 232 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 15, size: 5 },
            { id: 16, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'base/common/downloadUtil.ts',
              'components/dialog/content/ApiNodesSignInContent.vue',
              'components/ui/toast/toastStore.ts',
              'composables/auth/useTurnstile.ts',
              'composables/node/useNodeDragAndDrop.ts',
              'composables/node/useNodePricing.ts',
              'composables/useCopyToClipboard.ts',
              'composables/useErrorHandling.ts',
              'composables/useFeatureFlags.ts',
              'platform/assets/composables/useAssetsQuery.ts',
              'platform/assets/schemas/assetMetadataSchema.ts',
              'platform/assets/schemas/mediaAssetSchema.ts',
              'platform/assets/services/assetService.ts',
              'platform/errorCatalog/executionErrorResolver.ts',
              'platform/errorCatalog/promptErrorResolver.ts',
              'platform/errorCatalog/runtimeErrorCopy.ts',
              'platform/errorCatalog/types.ts',
              'platform/errorCatalog/validationErrorResolver.ts',
              'platform/nodeReplacement/nodeReplacementService.ts',
              'platform/nodeReplacement/nodeReplacementStore.ts',
              'platform/remoteConfig/refreshRemoteConfig.ts',
              'platform/settings/missingWarningVisibility.ts',
              'platform/settings/settingStore.ts',
              'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
              'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubExamplesStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubThumbnailStep.vue',
              'platform/workflow/sharing/services/comfyHubService.ts',
              'platform/workflow/sharing/utils/validateFileSize.ts',
              'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
              'platform/workflow/validation/composables/useWorkflowValidation.ts',
              'platform/workspace/api/workspaceApiUrl.ts',
              'platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
              'scripts/metadata/parser.ts',
              'scripts/pnginfo.ts',
              'scripts/promotedWidgetControl.ts',
              'services/uploadTempFile.ts',
              'stores/assetDownloadStore.ts',
              'stores/jobPreviewStore.ts',
              'stores/modelToNodeStore.ts',
              'stores/resultItemParsing.ts',
              'stores/systemStatsStore.ts',
              'stores/userFileStore.ts',
              'stores/workspace/rightSidePanelStore.ts',
              'systems/badgeSystem.ts',
              'utils/createAnnotatedPath.ts',
              'utils/errorSeverityClassification.ts',
              'utils/eventUtils.ts',
              'utils/imageUtil.ts',
              'utils/nodeOutputUtil.ts',
              'utils/resultItem.ts',
              'utils/resultItemUrl.ts',
              'utils/syncUtil.ts',
              'workbench/utils/nodeDefOrderingUtil.ts'
            ],
            entangled: [],
            splits: [{ from: 0, into: [15, 16] }]
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 90,
          kind: 'pr',
          parent: 89,
          sha: '30e44c21793583f5741c8f6e7109dbf66ae94550',
          short: '30e44c2179',
          date: '2026-10-08T22:10:39Z',
          subject:
            'refactor: install workspace api credentials from the composition root',
          pr: 19121,
          stats: {
            modules: 2495,
            imports: 11699,
            modulesInKnots: 437,
            largestKnot: 212,
            mainKnot: 212,
            secondKnot: 154,
            knotCount: 17,
            importsInKnots: 1726,
            noCircularWarnings: 1291
          },
          knots: [
            { id: 0, size: 212 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 15, size: 5 },
            { id: 16, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'composables/billing/billingRail.ts',
              'platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts',
              'platform/cloud/subscription/utils/billingPlanTelemetry.ts',
              'platform/cloud/subscription/utils/planCreditGrant.ts',
              'platform/cloud/subscription/utils/subscriptionCancellationTelemetry.ts',
              'platform/workspace/api/workspaceApi.ts',
              'platform/workspace/billing/customerAttention.ts',
              'platform/workspace/billing/sdk/billingCapabilitiesView.ts',
              'platform/workspace/billing/sdk/billingPlansView.ts',
              'platform/workspace/billing/sdk/billingStatusView.ts',
              'platform/workspace/billing/sdk/operationRecordView.ts',
              'platform/workspace/billing/sdk/subscriptionOperationView.ts',
              'platform/workspace/billing/sdk/topupOperationView.ts',
              'platform/workspace/billing/subscribeInput.ts',
              'platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue',
              'platform/workspace/components/WorkspaceProfilePic.vue',
              'platform/workspace/components/subscriptionPanelWorkspace.logic.ts',
              'platform/workspace/composables/readOnRail.ts',
              'platform/workspace/composables/useWorkspaceTierLabel.ts',
              'platform/workspace/utils/pendingSubscriptionCheckout.ts'
            ],
            entangled: [],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 91,
          kind: 'pr',
          parent: 87,
          sha: 'c72a6d5b270990b072962c49d178f005b1310469',
          short: 'c72a6d5b27',
          date: '2026-09-27T23:13:02Z',
          subject: 'refactor: split feature dialogs out of dialogService',
          pr: 19131,
          stats: {
            modules: 2503,
            imports: 11738,
            modulesInKnots: 484,
            largestKnot: 269,
            mainKnot: 269,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2046,
            noCircularWarnings: 1558
          },
          knots: [
            { id: 0, size: 269 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'platform/settings/composables/useSettingsDialog.ts',
              'platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue',
              'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubExamplesStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubFinishStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue',
              'platform/workflow/sharing/components/publish/ComfyHubThumbnailStep.vue',
              'platform/workflow/sharing/composables/useComfyHubProfileGate.ts',
              'platform/workflow/sharing/composables/useComfyHubPublishSubmission.ts',
              'platform/workflow/sharing/composables/useComfyHubPublishWizard.ts',
              'platform/workflow/sharing/services/comfyHubService.ts',
              'platform/workflow/sharing/services/workflowShareService.ts',
              'platform/workflow/sharing/utils/validateFileSize.ts'
            ],
            entangled: [
              'composables/auth/useAuthDialogs.ts',
              'composables/billing/useBillingDialogs.ts',
              'platform/workspace/composables/useWorkspaceDialogs.ts'
            ],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 92,
          kind: 'pr',
          parent: 91,
          sha: '79fa9488f7b79d62caeae96e6e9f40c838c7bc88',
          short: '79fa9488f7',
          date: '2026-09-28T00:31:49Z',
          subject:
            'refactor: read the app singleton through useApp() below scripts/app',
          pr: 19143,
          stats: {
            modules: 2506,
            imports: 11760,
            modulesInKnots: 417,
            largestKnot: 154,
            mainKnot: 154,
            secondKnot: 154,
            knotCount: 16,
            importsInKnots: 1686,
            noCircularWarnings: 1246
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 154 },
            { id: 17, size: 48 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 3, size: 2 },
            { id: 2, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'components/dialog/content/ApiNodesSignInContent.vue',
              'components/dialog/content/signin/ApiKeyForm.vue',
              'components/dialog/content/signin/SignUpForm.vue',
              'components/topbar/CloudBadge.vue',
              'components/topbar/TopbarBadge.vue',
              'composables/auth/useTurnstile.ts',
              'composables/billing/billingRail.ts',
              'composables/billing/topupBalanceRefresh.ts',
              'composables/billing/useBillingRouting.ts',
              'composables/billing/usePartnerNodesRunGate.ts',
              'composables/billing/usePendingTopup.ts',
              'composables/element/useCanvasPositionConversion.ts',
              'composables/node/useNodePricing.ts',
              'composables/node/usePartnerNodesInGraph.ts',
              'composables/useCopy.ts',
              'composables/usePaste.ts',
              'core/graph/subgraph/promotedWidgetControl.ts',
              'extensions/core/load3d/Load3dUtils.ts',
              'platform/cloud/subscription/composables/useAccountPreconditionDialog.ts',
              'platform/cloud/subscription/composables/useFreeTierQuota.ts',
              'platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts',
              'platform/cloud/subscription/utils/billingPlanTelemetry.ts',
              'platform/cloud/subscription/utils/planCreditGrant.ts',
              'platform/cloud/subscription/utils/subscriptionCancellationTelemetry.ts',
              'platform/cloud/subscription/utils/subscriptionCheckoutUtil.ts',
              'platform/keybindings/keybindingService.ts',
              'platform/missingMedia/missingMediaPipeline.ts',
              'platform/missingMedia/missingMediaScan.ts',
              'platform/nodeReplacement/missingNodeScan.ts',
              'platform/nodeReplacement/nodeReplacementService.ts',
              'platform/nodeReplacement/nodeReplacementStore.ts',
              'platform/telemetry/nodeAdded/installNodeAddedTelemetry.ts',
              'platform/telemetry/utils/billingFailureCategory.ts',
              'platform/telemetry/utils/billingPortalTelemetry.ts',
              'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
              'platform/workflow/validation/composables/useWorkflowValidation.ts',
              'platform/workspace/billing/customerAttention.ts',
              'platform/workspace/billing/sdk/billingCapabilitiesView.ts',
              'platform/workspace/billing/sdk/billingPlansView.ts',
              'platform/workspace/billing/sdk/billingStatusView.ts',
              'platform/workspace/billing/sdk/webSessionBillingSession.ts',
              'platform/workspace/billing/subscribeInput.ts',
              'platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue',
              'platform/workspace/components/WorkspaceProfilePic.vue',
              'platform/workspace/components/dialogs/ChangeMemberRoleDialogContent.vue',
              'platform/workspace/components/dialogs/CreateWorkspaceDialogContent.vue',
              'platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue',
              'platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
              'platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue',
              'platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue',
              'platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue',
              'platform/workspace/components/dialogs/TeamWorkspacesDialogContent.vue',
              'platform/workspace/components/subscriptionPanelWorkspace.logic.ts',
              'platform/workspace/composables/readOnRail.ts',
              'platform/workspace/composables/useWorkspaceSwitch.ts',
              'platform/workspace/composables/useWorkspaceTierLabel.ts',
              'platform/workspace/utils/pendingSubscriptionCheckout.ts',
              'platform/workspace/utils/platformLink.ts',
              'platform/workspace/utils/workspaceCheckoutTelemetry.ts',
              'renderer/core/canvas/interaction/canvasInteractionMode.ts',
              'scripts/app.ts',
              'scripts/metadata/parser.ts',
              'scripts/pnginfo.ts',
              'services/customerEventsService.ts',
              'services/subgraphService.ts',
              'services/uploadTempFile.ts',
              'systems/badgeSystem.ts',
              'utils/eventUtils.ts',
              'utils/executionUtil.ts',
              'workbench/eventHelpers.ts'
            ],
            entangled: [
              'scripts/appInstance.ts',
              'scripts/appRegistry.ts',
              'scripts/clipspace.ts'
            ],
            splits: [{ from: 0, into: [17] }]
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 93,
          kind: 'pr',
          parent: 92,
          sha: '6a802eca61eccfca4be4fedbe2f4a42781a0273c',
          short: '6a802eca61',
          date: '2026-09-28T02:09:00Z',
          subject: 'refactor: make types/comfy a leaf of the app runtime',
          pr: 19153,
          stats: {
            modules: 2508,
            imports: 11762,
            modulesInKnots: 375,
            largestKnot: 154,
            mainKnot: 63,
            secondKnot: 154,
            knotCount: 17,
            importsInKnots: 1441,
            noCircularWarnings: 1046
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 63 },
            { id: 18, size: 49 },
            { id: 17, size: 48 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 3, size: 2 },
            { id: 2, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: {
            freed: [
              'composables/node/useNodeDragAndDrop.ts',
              'composables/useRunButtonTelemetry.ts',
              'core/graph/widgets/valueControlWidgets.ts',
              'platform/assets/composables/useAssetBrowserDialog.ts',
              'platform/assets/composables/useAssetsQuery.ts',
              'platform/assets/schemas/assetMetadataSchema.ts',
              'platform/assets/schemas/mediaAssetSchema.ts',
              'platform/assets/services/assetService.ts',
              'platform/missingModel/missingModelDownload.ts',
              'platform/missingModel/missingModelGrouping.ts',
              'platform/missingModel/missingModelMetadata.ts',
              'platform/missingModel/missingModelPipeline.ts',
              'platform/missingModel/missingModelScan.ts',
              'platform/nodeReplacement/missingNodesErrorStore.ts',
              'platform/settings/missingWarningVisibility.ts',
              'platform/telemetry/utils/getExecutionContext.ts',
              'platform/workflow/core/utils/pendingWarnings.ts',
              'platform/workflow/persistence/stores/workflowDraftStoreV2.ts',
              'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
              'renderer/extensions/vueNodes/widgets/composables/useFloatWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useIntWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts',
              'renderer/extensions/vueNodes/widgets/composables/useStringWidget.ts',
              'renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas.ts',
              'renderer/extensions/vueNodes/widgets/utils/multilineTextarea.ts',
              'scripts/errorNodeWidgets.ts',
              'scripts/ui/imagePreview.ts',
              'services/colorPaletteService.ts',
              'stores/assetDownloadStore.ts',
              'stores/extensionStore.ts',
              'stores/jobPreviewStore.ts',
              'stores/modelToNodeStore.ts',
              'stores/resultItemParsing.ts',
              'stores/workspace/bottomPanelStore.ts',
              'stores/workspace/rightSidePanelStore.ts',
              'stores/workspace/sidebarTabStore.ts',
              'utils/createAnnotatedPath.ts',
              'utils/errorSeverityClassification.ts',
              'utils/imageUtil.ts',
              'utils/nodeOutputUtil.ts',
              'utils/resultItem.ts',
              'utils/resultItemUrl.ts',
              'workbench/utils/nodeDefOrderingUtil.ts'
            ],
            entangled: [
              'platform/workflow/management/stores/workflowStoreTypes.ts',
              'services/dialogServiceTypes.ts'
            ],
            splits: [{ from: 0, into: [18] }]
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 94,
          kind: 'pr',
          parent: 93,
          sha: '2bca9fe2b22a58f7f666aab6356484870a0e69fa',
          short: '2bca9fe2b2',
          date: '2026-09-28T04:10:08Z',
          subject: 'refactor: break the workbench import cycles',
          pr: 19186,
          stats: {
            modules: 2510,
            imports: 11769,
            modulesInKnots: 345,
            largestKnot: 154,
            mainKnot: 63,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 1368,
            noCircularWarnings: 1000
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 63 },
            { id: 18, size: 49 },
            { id: 17, size: 48 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 3, size: 2 },
            { id: 2, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 }
          ],
          delta: {
            freed: [
              'workbench/extensions/agent/crdt/crdtSnapshot.ts',
              'workbench/extensions/agent/crdt/useAgentCrdtFollower.ts',
              'workbench/extensions/manager/components/manager/ManagerDialog.vue',
              'workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue',
              'workbench/extensions/manager/components/manager/PackVersionBadge.vue',
              'workbench/extensions/manager/components/manager/PackVersionSelectorPopover.vue',
              'workbench/extensions/manager/components/manager/button/PackEnableToggle.vue',
              'workbench/extensions/manager/components/manager/button/PackInstallButton.vue',
              'workbench/extensions/manager/components/manager/button/PackTryUpdateButton.vue',
              'workbench/extensions/manager/components/manager/button/PackUninstallButton.vue',
              'workbench/extensions/manager/components/manager/button/PackUpdateButton.vue',
              'workbench/extensions/manager/components/manager/infoPanel/InfoPanel.vue',
              'workbench/extensions/manager/components/manager/infoPanel/InfoPanelMultiItem.vue',
              'workbench/extensions/manager/components/manager/packCard/PackCard.vue',
              'workbench/extensions/manager/components/manager/packCard/PackCardFooter.vue',
              'workbench/extensions/manager/composables/nodePack/useInstalledPacks.ts',
              'workbench/extensions/manager/composables/nodePack/useMissingNodes.ts',
              'workbench/extensions/manager/composables/nodePack/usePackInstall.ts',
              'workbench/extensions/manager/composables/nodePack/usePackUpdateStatus.ts',
              'workbench/extensions/manager/composables/nodePack/usePacksSelection.ts',
              'workbench/extensions/manager/composables/nodePack/useUpdateAvailableNodes.ts',
              'workbench/extensions/manager/composables/useConflictDetection.ts',
              'workbench/extensions/manager/composables/useImportFailedDetection.ts',
              'workbench/extensions/manager/composables/useManagerDialog.ts',
              'workbench/extensions/manager/composables/useManagerDisplayPacks.ts',
              'workbench/extensions/manager/composables/useManagerState.ts',
              'workbench/extensions/manager/composables/useNodeConflictDialog.ts',
              'workbench/extensions/manager/services/comfyManagerService.ts',
              'workbench/extensions/manager/stores/comfyManagerStore.ts',
              'workbench/extensions/manager/utils/packUpdateStatus.ts'
            ],
            entangled: [],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 95,
          kind: 'pr',
          parent: 94,
          sha: 'be7f95b456f3fc2ab0557500825a5bba0c03c0b4',
          short: 'be7f95b456',
          date: '2026-09-28T04:56:04Z',
          subject: 'refactor: break the small app import cycles',
          pr: 19189,
          stats: {
            modules: 2516,
            imports: 11807,
            modulesInKnots: 307,
            largestKnot: 154,
            mainKnot: 58,
            secondKnot: 154,
            knotCount: 5,
            importsInKnots: 1309,
            noCircularWarnings: 970
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 58 },
            { id: 18, size: 49 },
            { id: 17, size: 43 },
            { id: 13, size: 3 }
          ],
          delta: {
            freed: [
              'components/dialog/content/SignInContent.vue',
              'components/dialog/content/UpdatePasswordContent.vue',
              'components/dialog/content/setting/keybinding/EditKeybindingContent.vue',
              'components/dialog/content/setting/keybinding/EditKeybindingFooter.vue',
              'components/dialog/content/signin/SignInForm.vue',
              'components/searchbox/NodeSearchBoxPopover.vue',
              'components/searchbox/v2/NodeSearchFilterBar.vue',
              'components/searchbox/v2/NodeSearchTypeFilterPopover.vue',
              'composables/auth/useAuthDialogs.ts',
              'composables/graph/contextMenuConverter.ts',
              'composables/graph/useGroupMenuOptions.ts',
              'composables/graph/useImageMenuOptions.ts',
              'composables/graph/useMoreOptionsMenu.ts',
              'composables/graph/useNodeMenuOptions.ts',
              'composables/graph/useSelectionMenuOptions.ts',
              'composables/maskeditor/useCanvasHistory.ts',
              'composables/useEditKeybindingDialog.ts',
              'constants/serverConfig.ts',
              'extensions/core/widgetInputs.ts',
              'platform/auth/social/useSocialSignIn.ts',
              'platform/cloud/subscription/constants/tierPricing.ts',
              'platform/cloud/subscription/utils/subscriptionTierRank.ts',
              'platform/remoteConfig/remoteConfig.ts',
              'platform/remoteConfig/types.ts',
              'platform/settings/types.ts',
              'platform/telemetry/types.ts',
              'renderer/core/spatial/QuadTree.ts',
              'scripts/domWidget.ts',
              'services/nodeSearchService.ts',
              'stores/domWidgetStore.ts',
              'stores/maskEditorStore.ts',
              'stores/nodeDefStore.ts',
              'stores/workspace/searchBoxStore.ts',
              'types/nodeOrganizationTypes.ts',
              'types/spatialIndex.ts',
              'types/treeExplorerTypes.ts',
              'utils/treeUtil.ts'
            ],
            entangled: [],
            splits: []
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 96,
          kind: 'pr',
          parent: 95,
          sha: '240dfbeb985edd934a45f6883905c3aa853e5527',
          short: '240dfbeb98',
          date: '2026-10-08T22:20:05Z',
          subject:
            'refactor: let billing rails announce refreshes instead of reading the context',
          pr: 19148,
          stats: {
            modules: 2519,
            imports: 11814,
            modulesInKnots: 277,
            largestKnot: 154,
            mainKnot: 58,
            secondKnot: 154,
            knotCount: 6,
            importsInKnots: 1209,
            noCircularWarnings: 905
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 58 },
            { id: 18, size: 49 },
            { id: 17, size: 10 },
            { id: 19, size: 3 },
            { id: 13, size: 3 }
          ],
          delta: {
            freed: [
              'components/dialog/content/TopUpCreditsDialogContentLegacy.vue',
              'components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
              'composables/auth/useAuthActions.ts',
              'composables/billing/useBillingContext.ts',
              'composables/billing/useLegacyBilling.ts',
              'platform/cloud/subscription/components/CancellationFlowDialogContent.vue',
              'platform/cloud/subscription/components/PricingTable.vue',
              'platform/cloud/subscription/components/RetentionOfferStep.vue',
              'platform/cloud/subscription/composables/useBillingPlans.ts',
              'platform/cloud/subscription/composables/useCancellationPlan.ts',
              'platform/cloud/subscription/composables/useRetentionOffer.ts',
              'platform/cloud/subscription/composables/useSubscription.ts',
              'platform/cloud/subscription/launchCancellationFlow.ts',
              'platform/workspace/billing/openHostedBillingTab.ts',
              'platform/workspace/components/InviteMembersForm.vue',
              'platform/workspace/components/PricingTableWorkspace.vue',
              'platform/workspace/components/SubscriptionSuccessWorkspace.vue',
              'platform/workspace/components/SubscriptionTransitionPreviewWorkspace.vue',
              'platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue',
              'platform/workspace/components/UnifiedPricingTable.vue',
              'platform/workspace/components/dialogs/InviteMemberDialogContent.vue',
              'platform/workspace/components/dialogs/InviteWrongAccountDialogContent.vue',
              'platform/workspace/components/dialogs/RemoveMemberDialogContent.vue',
              'platform/workspace/components/dialogs/RevokeInviteDialogContent.vue',
              'platform/workspace/composables/useDowngradeToPersonal.ts',
              'platform/workspace/composables/useScheduledPlanChange.ts',
              'platform/workspace/composables/useSubscriptionRail.ts',
              'platform/workspace/composables/useTopupOperation.ts',
              'platform/workspace/composables/useWorkspaceBilling.ts',
              'platform/workspace/composables/useWorkspaceUI.ts',
              'platform/workspace/stores/billingOperationStore.ts'
            ],
            entangled: ['composables/billing/useSubscriptionPaywall.ts'],
            splits: [{ from: 17, into: [19] }]
          },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'no-records'
          }
        },
        {
          index: 97,
          kind: 'pr',
          parent: 72,
          sha: 'b1060fb11d6ad5d8123e65c8f023932408172aa2',
          short: 'b1060fb11d',
          date: '2026-10-09T05:08:33Z',
          subject: 'tool: add domain architecture census and ratchet',
          pr: 19768,
          stats: {
            modules: 2491,
            imports: 11687,
            modulesInKnots: 511,
            largestKnot: 296,
            mainKnot: 296,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2121,
            noCircularWarnings: 1628
          },
          knots: [
            { id: 0, size: 296 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: { freed: [], entangled: [], splits: [] },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'measured',
            tool: {
              sha: 'afcc41d54ec8fe160cc043cac87472493d532337',
              own: false
            },
            totals: {
              sourceFiles: 4339,
              classifiedFiles: 133,
              domains: 2,
              readyDomains: 0,
              extractedDomains: 0,
              internalImports: 22731,
              allowed: 323,
              legacy: 22404,
              forbidden: 4,
              deepImports: 72,
              suppressions: 21
            },
            domains: [
              {
                id: 'mask-editor',
                capability: 'Mask editor',
                owners: [
                  '@trsommer',
                  '@jtydhr88',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 86,
                paths: [
                  'components/maskeditor/BrushCursor.test.ts',
                  'components/maskeditor/BrushCursor.vue',
                  'components/maskeditor/BrushSettingsPanel.test.ts',
                  'components/maskeditor/BrushSettingsPanel.vue',
                  'components/maskeditor/ColorSelectSettingsPanel.test.ts',
                  'components/maskeditor/ColorSelectSettingsPanel.vue',
                  'components/maskeditor/ImageLayerSettingsPanel.test.ts',
                  'components/maskeditor/ImageLayerSettingsPanel.vue',
                  'components/maskeditor/MaskEditorContent.test.ts',
                  'components/maskeditor/MaskEditorContent.vue',
                  'components/maskeditor/MaskEditorToolIcon.vue',
                  'components/maskeditor/PaintBucketSettingsPanel.test.ts',
                  'components/maskeditor/PaintBucketSettingsPanel.vue',
                  'components/maskeditor/PointerZone.test.ts',
                  'components/maskeditor/PointerZone.vue',
                  'components/maskeditor/SettingsPanelContainer.test.ts',
                  'components/maskeditor/SettingsPanelContainer.vue',
                  'components/maskeditor/SidePanel.test.ts',
                  'components/maskeditor/SidePanel.vue',
                  'components/maskeditor/ToolPanel.test.ts',
                  'components/maskeditor/ToolPanel.vue',
                  'components/maskeditor/controls/DropdownControl.test.ts',
                  'components/maskeditor/controls/DropdownControl.vue',
                  'components/maskeditor/controls/SliderControl.test.ts',
                  'components/maskeditor/controls/SliderControl.vue',
                  'components/maskeditor/controls/ToggleControl.test.ts',
                  'components/maskeditor/controls/ToggleControl.vue',
                  'components/maskeditor/dialog/TopBarHeader.test.ts',
                  'components/maskeditor/dialog/TopBarHeader.vue',
                  'composables/maskeditor/ShiftClick.test.ts',
                  'composables/maskeditor/StrokeProcessor.test.ts',
                  'composables/maskeditor/StrokeProcessor.ts',
                  'composables/maskeditor/brushDrawingUtils.test.ts',
                  'composables/maskeditor/brushDrawingUtils.ts',
                  'composables/maskeditor/brushUtils.test.ts',
                  'composables/maskeditor/brushUtils.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.test.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.ts',
                  'composables/maskeditor/gpu/brushShaders.ts',
                  'composables/maskeditor/gpu/gpuSchema.ts',
                  'composables/maskeditor/gpuUtils.test.ts',
                  'composables/maskeditor/gpuUtils.ts',
                  'composables/maskeditor/imageWidgetAdapter.test.ts',
                  'composables/maskeditor/imageWidgetAdapter.ts',
                  'composables/maskeditor/panZoomUtils.test.ts',
                  'composables/maskeditor/panZoomUtils.ts',
                  'composables/maskeditor/splineUtils.ts',
                  'composables/maskeditor/useBrushAdjustment.test.ts',
                  'composables/maskeditor/useBrushAdjustment.ts',
                  'composables/maskeditor/useBrushDrawing.test.ts',
                  'composables/maskeditor/useBrushDrawing.ts',
                  'composables/maskeditor/useBrushPersistence.test.ts',
                  'composables/maskeditor/useBrushPersistence.ts',
                  'composables/maskeditor/useCanvasHistory.test.ts',
                  'composables/maskeditor/useCanvasHistory.ts',
                  'composables/maskeditor/useCanvasManager.test.ts',
                  'composables/maskeditor/useCanvasManager.ts',
                  'composables/maskeditor/useCanvasTools.test.ts',
                  'composables/maskeditor/useCanvasTools.ts',
                  'composables/maskeditor/useCanvasTransform.test.ts',
                  'composables/maskeditor/useCanvasTransform.ts',
                  'composables/maskeditor/useCoordinateTransform.test.ts',
                  'composables/maskeditor/useCoordinateTransform.ts',
                  'composables/maskeditor/useGPUResources.test.ts',
                  'composables/maskeditor/useGPUResources.ts',
                  'composables/maskeditor/useImageLoader.test.ts',
                  'composables/maskeditor/useImageLoader.ts',
                  'composables/maskeditor/useKeyboard.test.ts',
                  'composables/maskeditor/useKeyboard.ts',
                  'composables/maskeditor/useMaskEditor.test.ts',
                  'composables/maskeditor/useMaskEditor.ts',
                  'composables/maskeditor/useMaskEditorLoader.test.ts',
                  'composables/maskeditor/useMaskEditorLoader.ts',
                  'composables/maskeditor/useMaskEditorSaver.test.ts',
                  'composables/maskeditor/useMaskEditorSaver.ts',
                  'composables/maskeditor/usePanAndZoom.test.ts',
                  'composables/maskeditor/usePanAndZoom.ts',
                  'composables/maskeditor/useToolManager.test.ts',
                  'composables/maskeditor/useToolManager.ts',
                  'extensions/core/maskeditor/types.ts',
                  'extensions/core/maskeditor.test.ts',
                  'extensions/core/maskeditor.ts',
                  'stores/maskEditorDataStore.test.ts',
                  'stores/maskEditorDataStore.ts',
                  'stores/maskEditorStore.test.ts',
                  'stores/maskEditorStore.ts'
                ],
                roles: {
                  domain: 1,
                  application: 54,
                  presentation: 29,
                  integration: 2
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 256,
                  inbound: 10,
                  inboundSources: 8,
                  outbound: 80,
                  outboundToUnclassified: 80
                },
                deepImports: 10,
                forbidden: 4,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'workflow-templates',
                capability: 'Workflow templates',
                owners: [
                  '@christian-byrne',
                  '@comfyui-wiki',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 47,
                paths: [
                  'components/templates/thumbnails/AudioThumbnail.test.ts',
                  'components/templates/thumbnails/AudioThumbnail.vue',
                  'components/templates/thumbnails/BaseThumbnail.test.ts',
                  'components/templates/thumbnails/BaseThumbnail.vue',
                  'components/templates/thumbnails/CompareSliderThumbnail.test.ts',
                  'components/templates/thumbnails/CompareSliderThumbnail.vue',
                  'components/templates/thumbnails/DefaultThumbnail.test.ts',
                  'components/templates/thumbnails/DefaultThumbnail.vue',
                  'components/templates/thumbnails/HoverDissolveThumbnail.test.ts',
                  'components/templates/thumbnails/HoverDissolveThumbnail.vue',
                  'components/templates/thumbnails/LogoOverlay.test.ts',
                  'components/templates/thumbnails/LogoOverlay.vue',
                  'components/templates/thumbnails/TemplatePreview.test.ts',
                  'components/templates/thumbnails/TemplatePreview.vue',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.test.ts',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.test.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.test.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.ts',
                  'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
                  'platform/workflow/templates/schemas/templateSchema.ts',
                  'platform/workflow/templates/services/templateInputService.test.ts',
                  'platform/workflow/templates/services/templateInputService.ts',
                  'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
                  'platform/workflow/templates/types/template.ts',
                  'platform/workflow/templates/types/templateDetail.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.test.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.ts',
                  'platform/workflow/templates/utils/templateDisplay.test.ts',
                  'platform/workflow/templates/utils/templateDisplay.ts',
                  'platform/workflow/templates/utils/templateInputAssets.test.ts',
                  'platform/workflow/templates/utils/templateInputAssets.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.test.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.test.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.test.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.test.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.ts',
                  'platform/workflow/templates/utils/templateModelSetup.test.ts',
                  'platform/workflow/templates/utils/templateModelSetup.ts'
                ],
                roles: {
                  domain: 19,
                  application: 13,
                  infrastructure: 1,
                  presentation: 14
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'inventory',
                  dependencies: 'error'
                },
                imports: {
                  inside: 71,
                  inbound: 62,
                  inboundSources: 28,
                  outbound: 96,
                  outboundToUnclassified: 96
                },
                deepImports: 62,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              }
            ],
            links: [
              {
                from: null,
                to: 'workflow-templates',
                allowed: 0,
                legacy: 62,
                forbidden: 0
              },
              {
                from: null,
                to: 'mask-editor',
                allowed: 0,
                legacy: 10,
                forbidden: 0
              },
              {
                from: 'mask-editor',
                to: null,
                allowed: 0,
                legacy: 80,
                forbidden: 0
              },
              {
                from: 'workflow-templates',
                to: null,
                allowed: 0,
                legacy: 96,
                forbidden: 0
              }
            ]
          }
        },
        {
          index: 98,
          kind: 'pr',
          parent: 97,
          sha: 'dffd90c7deebd457c2293443f7cb9668a7220514',
          short: 'dffd90c7de',
          date: '2026-10-09T09:21:22Z',
          subject: 'feat: classify image crop, compare, and painter domains',
          pr: 19855,
          stats: {
            modules: 2491,
            imports: 11687,
            modulesInKnots: 511,
            largestKnot: 296,
            mainKnot: 296,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2121,
            noCircularWarnings: 1628
          },
          knots: [
            { id: 0, size: 296 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: { freed: [], entangled: [], splits: [] },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'measured',
            tool: {
              sha: 'afcc41d54ec8fe160cc043cac87472493d532337',
              own: false
            },
            totals: {
              sourceFiles: 4339,
              classifiedFiles: 153,
              domains: 5,
              readyDomains: 0,
              extractedDomains: 0,
              internalImports: 22731,
              allowed: 334,
              legacy: 22388,
              forbidden: 9,
              deepImports: 80,
              suppressions: 21
            },
            domains: [
              {
                id: 'image-compare',
                capability: 'Image compare',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 7,
                paths: [
                  'extensions/core/imageCompare.ts',
                  'lib/litegraph/src/widgets/ImageCompareWidget.ts',
                  'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.test.ts',
                  'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.test.ts',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 3 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 3,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 30,
                  outboundToUnclassified: 30
                },
                deepImports: 4,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'image-crop',
                capability: 'Image crop',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 6,
                paths: [
                  'components/imagecrop/WidgetImageCrop.test.ts',
                  'components/imagecrop/WidgetImageCrop.vue',
                  'composables/useImageCrop.test.ts',
                  'composables/useImageCrop.ts',
                  'extensions/core/imageCrop.ts',
                  'lib/litegraph/src/widgets/ImageCropWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 2 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 5,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 34,
                  outboundToUnclassified: 34
                },
                deepImports: 4,
                forbidden: 1,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'mask-editor',
                capability: 'Mask editor',
                owners: [
                  '@trsommer',
                  '@jtydhr88',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 86,
                paths: [
                  'components/maskeditor/BrushCursor.test.ts',
                  'components/maskeditor/BrushCursor.vue',
                  'components/maskeditor/BrushSettingsPanel.test.ts',
                  'components/maskeditor/BrushSettingsPanel.vue',
                  'components/maskeditor/ColorSelectSettingsPanel.test.ts',
                  'components/maskeditor/ColorSelectSettingsPanel.vue',
                  'components/maskeditor/ImageLayerSettingsPanel.test.ts',
                  'components/maskeditor/ImageLayerSettingsPanel.vue',
                  'components/maskeditor/MaskEditorContent.test.ts',
                  'components/maskeditor/MaskEditorContent.vue',
                  'components/maskeditor/MaskEditorToolIcon.vue',
                  'components/maskeditor/PaintBucketSettingsPanel.test.ts',
                  'components/maskeditor/PaintBucketSettingsPanel.vue',
                  'components/maskeditor/PointerZone.test.ts',
                  'components/maskeditor/PointerZone.vue',
                  'components/maskeditor/SettingsPanelContainer.test.ts',
                  'components/maskeditor/SettingsPanelContainer.vue',
                  'components/maskeditor/SidePanel.test.ts',
                  'components/maskeditor/SidePanel.vue',
                  'components/maskeditor/ToolPanel.test.ts',
                  'components/maskeditor/ToolPanel.vue',
                  'components/maskeditor/controls/DropdownControl.test.ts',
                  'components/maskeditor/controls/DropdownControl.vue',
                  'components/maskeditor/controls/SliderControl.test.ts',
                  'components/maskeditor/controls/SliderControl.vue',
                  'components/maskeditor/controls/ToggleControl.test.ts',
                  'components/maskeditor/controls/ToggleControl.vue',
                  'components/maskeditor/dialog/TopBarHeader.test.ts',
                  'components/maskeditor/dialog/TopBarHeader.vue',
                  'composables/maskeditor/ShiftClick.test.ts',
                  'composables/maskeditor/StrokeProcessor.test.ts',
                  'composables/maskeditor/StrokeProcessor.ts',
                  'composables/maskeditor/brushDrawingUtils.test.ts',
                  'composables/maskeditor/brushDrawingUtils.ts',
                  'composables/maskeditor/brushUtils.test.ts',
                  'composables/maskeditor/brushUtils.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.test.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.ts',
                  'composables/maskeditor/gpu/brushShaders.ts',
                  'composables/maskeditor/gpu/gpuSchema.ts',
                  'composables/maskeditor/gpuUtils.test.ts',
                  'composables/maskeditor/gpuUtils.ts',
                  'composables/maskeditor/imageWidgetAdapter.test.ts',
                  'composables/maskeditor/imageWidgetAdapter.ts',
                  'composables/maskeditor/panZoomUtils.test.ts',
                  'composables/maskeditor/panZoomUtils.ts',
                  'composables/maskeditor/splineUtils.ts',
                  'composables/maskeditor/useBrushAdjustment.test.ts',
                  'composables/maskeditor/useBrushAdjustment.ts',
                  'composables/maskeditor/useBrushDrawing.test.ts',
                  'composables/maskeditor/useBrushDrawing.ts',
                  'composables/maskeditor/useBrushPersistence.test.ts',
                  'composables/maskeditor/useBrushPersistence.ts',
                  'composables/maskeditor/useCanvasHistory.test.ts',
                  'composables/maskeditor/useCanvasHistory.ts',
                  'composables/maskeditor/useCanvasManager.test.ts',
                  'composables/maskeditor/useCanvasManager.ts',
                  'composables/maskeditor/useCanvasTools.test.ts',
                  'composables/maskeditor/useCanvasTools.ts',
                  'composables/maskeditor/useCanvasTransform.test.ts',
                  'composables/maskeditor/useCanvasTransform.ts',
                  'composables/maskeditor/useCoordinateTransform.test.ts',
                  'composables/maskeditor/useCoordinateTransform.ts',
                  'composables/maskeditor/useGPUResources.test.ts',
                  'composables/maskeditor/useGPUResources.ts',
                  'composables/maskeditor/useImageLoader.test.ts',
                  'composables/maskeditor/useImageLoader.ts',
                  'composables/maskeditor/useKeyboard.test.ts',
                  'composables/maskeditor/useKeyboard.ts',
                  'composables/maskeditor/useMaskEditor.test.ts',
                  'composables/maskeditor/useMaskEditor.ts',
                  'composables/maskeditor/useMaskEditorLoader.test.ts',
                  'composables/maskeditor/useMaskEditorLoader.ts',
                  'composables/maskeditor/useMaskEditorSaver.test.ts',
                  'composables/maskeditor/useMaskEditorSaver.ts',
                  'composables/maskeditor/usePanAndZoom.test.ts',
                  'composables/maskeditor/usePanAndZoom.ts',
                  'composables/maskeditor/useToolManager.test.ts',
                  'composables/maskeditor/useToolManager.ts',
                  'extensions/core/maskeditor/types.ts',
                  'extensions/core/maskeditor.test.ts',
                  'extensions/core/maskeditor.ts',
                  'stores/maskEditorDataStore.test.ts',
                  'stores/maskEditorDataStore.ts',
                  'stores/maskEditorStore.test.ts',
                  'stores/maskEditorStore.ts'
                ],
                roles: {
                  domain: 1,
                  application: 54,
                  presentation: 29,
                  integration: 2
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 256,
                  inbound: 10,
                  inboundSources: 8,
                  outbound: 80,
                  outboundToUnclassified: 80
                },
                deepImports: 6,
                forbidden: 8,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'painter',
                capability: 'Painter',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 7,
                paths: [
                  'components/painter/WidgetPainter.test.ts',
                  'components/painter/WidgetPainter.vue',
                  'composables/painter/usePainter.test.ts',
                  'composables/painter/usePainter.ts',
                  'extensions/core/painter.ts',
                  'lib/litegraph/src/widgets/PainterWidget.ts',
                  'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 3 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 4,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 38,
                  outboundToUnclassified: 34
                },
                deepImports: 4,
                forbidden: 4,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'workflow-templates',
                capability: 'Workflow templates',
                owners: [
                  '@christian-byrne',
                  '@comfyui-wiki',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 47,
                paths: [
                  'components/templates/thumbnails/AudioThumbnail.test.ts',
                  'components/templates/thumbnails/AudioThumbnail.vue',
                  'components/templates/thumbnails/BaseThumbnail.test.ts',
                  'components/templates/thumbnails/BaseThumbnail.vue',
                  'components/templates/thumbnails/CompareSliderThumbnail.test.ts',
                  'components/templates/thumbnails/CompareSliderThumbnail.vue',
                  'components/templates/thumbnails/DefaultThumbnail.test.ts',
                  'components/templates/thumbnails/DefaultThumbnail.vue',
                  'components/templates/thumbnails/HoverDissolveThumbnail.test.ts',
                  'components/templates/thumbnails/HoverDissolveThumbnail.vue',
                  'components/templates/thumbnails/LogoOverlay.test.ts',
                  'components/templates/thumbnails/LogoOverlay.vue',
                  'components/templates/thumbnails/TemplatePreview.test.ts',
                  'components/templates/thumbnails/TemplatePreview.vue',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.test.ts',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.test.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.test.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.ts',
                  'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
                  'platform/workflow/templates/schemas/templateSchema.ts',
                  'platform/workflow/templates/services/templateInputService.test.ts',
                  'platform/workflow/templates/services/templateInputService.ts',
                  'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
                  'platform/workflow/templates/types/template.ts',
                  'platform/workflow/templates/types/templateDetail.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.test.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.ts',
                  'platform/workflow/templates/utils/templateDisplay.test.ts',
                  'platform/workflow/templates/utils/templateDisplay.ts',
                  'platform/workflow/templates/utils/templateInputAssets.test.ts',
                  'platform/workflow/templates/utils/templateInputAssets.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.test.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.test.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.test.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.test.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.ts',
                  'platform/workflow/templates/utils/templateModelSetup.test.ts',
                  'platform/workflow/templates/utils/templateModelSetup.ts'
                ],
                roles: {
                  domain: 19,
                  application: 13,
                  infrastructure: 1,
                  presentation: 14
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'inventory',
                  dependencies: 'error'
                },
                imports: {
                  inside: 71,
                  inbound: 62,
                  inboundSources: 28,
                  outbound: 96,
                  outboundToUnclassified: 96
                },
                deepImports: 62,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              }
            ],
            links: [
              {
                from: null,
                to: 'workflow-templates',
                allowed: 0,
                legacy: 62,
                forbidden: 0
              },
              {
                from: null,
                to: 'mask-editor',
                allowed: 0,
                legacy: 6,
                forbidden: 0
              },
              {
                from: 'image-crop',
                to: null,
                allowed: 0,
                legacy: 34,
                forbidden: 0
              },
              {
                from: 'mask-editor',
                to: null,
                allowed: 0,
                legacy: 80,
                forbidden: 0
              },
              {
                from: 'painter',
                to: null,
                allowed: 0,
                legacy: 34,
                forbidden: 0
              },
              {
                from: 'workflow-templates',
                to: null,
                allowed: 0,
                legacy: 96,
                forbidden: 0
              },
              {
                from: 'painter',
                to: 'mask-editor',
                allowed: 0,
                legacy: 0,
                forbidden: 4
              },
              {
                from: null,
                to: 'image-crop',
                allowed: 0,
                legacy: 4,
                forbidden: 0
              },
              {
                from: 'image-compare',
                to: null,
                allowed: 0,
                legacy: 30,
                forbidden: 0
              },
              {
                from: null,
                to: 'image-compare',
                allowed: 0,
                legacy: 4,
                forbidden: 0
              },
              { from: null, to: 'painter', allowed: 0, legacy: 4, forbidden: 0 }
            ]
          }
        },
        {
          index: 99,
          kind: 'pr',
          parent: 98,
          sha: 'afcc41d54ec8fe160cc043cac87472493d532337',
          short: 'afcc41d54e',
          date: '2026-10-09T09:27:09Z',
          subject: 'feat: classify image compositor domain',
          pr: 19856,
          stats: {
            modules: 2491,
            imports: 11687,
            modulesInKnots: 511,
            largestKnot: 296,
            mainKnot: 296,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2121,
            noCircularWarnings: 1628
          },
          knots: [
            { id: 0, size: 296 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 13, size: 3 },
            { id: 11, size: 3 },
            { id: 2, size: 2 },
            { id: 3, size: 2 },
            { id: 12, size: 2 },
            { id: 4, size: 2 },
            { id: 5, size: 2 },
            { id: 6, size: 2 },
            { id: 14, size: 2 },
            { id: 7, size: 2 }
          ],
          delta: { freed: [], entangled: [], splits: [] },
          architecture: {
            workspacePackages: [
              'account-core',
              'account-ui',
              'billing-contract',
              'design-system',
              'ingest-types',
              'object-info-parser',
              'registry-types',
              'shared-frontend-utils',
              'tailwind-utils',
              'test-utils'
            ],
            status: 'measured',
            tool: {
              sha: 'afcc41d54ec8fe160cc043cac87472493d532337',
              own: false
            },
            totals: {
              sourceFiles: 4339,
              classifiedFiles: 178,
              domains: 6,
              readyDomains: 0,
              extractedDomains: 0,
              internalImports: 22731,
              allowed: 381,
              legacy: 22341,
              forbidden: 9,
              deepImports: 93,
              suppressions: 21
            },
            domains: [
              {
                id: 'image-compare',
                capability: 'Image compare',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 7,
                paths: [
                  'extensions/core/imageCompare.ts',
                  'lib/litegraph/src/widgets/ImageCompareWidget.ts',
                  'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.test.ts',
                  'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.test.ts',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
                  'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 3 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 3,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 30,
                  outboundToUnclassified: 30
                },
                deepImports: 4,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'image-compositor',
                capability: 'Image compositor',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 25,
                paths: [
                  'extensions/core/imageCompositor.test.ts',
                  'extensions/core/imageCompositor.ts',
                  'lib/litegraph/src/widgets/CompositorWidget.ts',
                  'renderer/extensions/compositor/components/WidgetCompositor.test.ts',
                  'renderer/extensions/compositor/components/WidgetCompositor.vue',
                  'renderer/extensions/compositor/components/types.ts',
                  'renderer/extensions/compositor/composables/compositorLayerState.test.ts',
                  'renderer/extensions/compositor/composables/compositorLayerState.ts',
                  'renderer/extensions/compositor/composables/compositorPaths.test.ts',
                  'renderer/extensions/compositor/composables/compositorPaths.ts',
                  'renderer/extensions/compositor/composables/compositorSave.test.ts',
                  'renderer/extensions/compositor/composables/compositorSave.ts',
                  'renderer/extensions/compositor/composables/compositorSession.test.ts',
                  'renderer/extensions/compositor/composables/compositorSession.ts',
                  'renderer/extensions/compositor/composables/compositorWidgets.test.ts',
                  'renderer/extensions/compositor/composables/compositorWidgets.ts',
                  'renderer/extensions/compositor/composables/useCompositorAutoSave.test.ts',
                  'renderer/extensions/compositor/composables/useCompositorAutoSave.ts',
                  'renderer/extensions/compositor/composables/useCompositorEditor.test.ts',
                  'renderer/extensions/compositor/composables/useCompositorEditor.ts',
                  'renderer/extensions/compositor/composables/useCompositorLayers.test.ts',
                  'renderer/extensions/compositor/composables/useCompositorLayers.ts',
                  'renderer/extensions/compositor/composables/useCompositorPsdDownload.test.ts',
                  'renderer/extensions/compositor/composables/useCompositorPsdDownload.ts',
                  'renderer/extensions/vueNodes/widgets/composables/useCompositorWidget.ts'
                ],
                roles: { application: 19, presentation: 2, integration: 4 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 47,
                  inbound: 13,
                  inboundSources: 8,
                  outbound: 94,
                  outboundToUnclassified: 94
                },
                deepImports: 13,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'image-crop',
                capability: 'Image crop',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 6,
                paths: [
                  'components/imagecrop/WidgetImageCrop.test.ts',
                  'components/imagecrop/WidgetImageCrop.vue',
                  'composables/useImageCrop.test.ts',
                  'composables/useImageCrop.ts',
                  'extensions/core/imageCrop.ts',
                  'lib/litegraph/src/widgets/ImageCropWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 2 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 5,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 34,
                  outboundToUnclassified: 34
                },
                deepImports: 4,
                forbidden: 1,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'mask-editor',
                capability: 'Mask editor',
                owners: [
                  '@trsommer',
                  '@jtydhr88',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 86,
                paths: [
                  'components/maskeditor/BrushCursor.test.ts',
                  'components/maskeditor/BrushCursor.vue',
                  'components/maskeditor/BrushSettingsPanel.test.ts',
                  'components/maskeditor/BrushSettingsPanel.vue',
                  'components/maskeditor/ColorSelectSettingsPanel.test.ts',
                  'components/maskeditor/ColorSelectSettingsPanel.vue',
                  'components/maskeditor/ImageLayerSettingsPanel.test.ts',
                  'components/maskeditor/ImageLayerSettingsPanel.vue',
                  'components/maskeditor/MaskEditorContent.test.ts',
                  'components/maskeditor/MaskEditorContent.vue',
                  'components/maskeditor/MaskEditorToolIcon.vue',
                  'components/maskeditor/PaintBucketSettingsPanel.test.ts',
                  'components/maskeditor/PaintBucketSettingsPanel.vue',
                  'components/maskeditor/PointerZone.test.ts',
                  'components/maskeditor/PointerZone.vue',
                  'components/maskeditor/SettingsPanelContainer.test.ts',
                  'components/maskeditor/SettingsPanelContainer.vue',
                  'components/maskeditor/SidePanel.test.ts',
                  'components/maskeditor/SidePanel.vue',
                  'components/maskeditor/ToolPanel.test.ts',
                  'components/maskeditor/ToolPanel.vue',
                  'components/maskeditor/controls/DropdownControl.test.ts',
                  'components/maskeditor/controls/DropdownControl.vue',
                  'components/maskeditor/controls/SliderControl.test.ts',
                  'components/maskeditor/controls/SliderControl.vue',
                  'components/maskeditor/controls/ToggleControl.test.ts',
                  'components/maskeditor/controls/ToggleControl.vue',
                  'components/maskeditor/dialog/TopBarHeader.test.ts',
                  'components/maskeditor/dialog/TopBarHeader.vue',
                  'composables/maskeditor/ShiftClick.test.ts',
                  'composables/maskeditor/StrokeProcessor.test.ts',
                  'composables/maskeditor/StrokeProcessor.ts',
                  'composables/maskeditor/brushDrawingUtils.test.ts',
                  'composables/maskeditor/brushDrawingUtils.ts',
                  'composables/maskeditor/brushUtils.test.ts',
                  'composables/maskeditor/brushUtils.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.test.ts',
                  'composables/maskeditor/gpu/GPUBrushRenderer.ts',
                  'composables/maskeditor/gpu/brushShaders.ts',
                  'composables/maskeditor/gpu/gpuSchema.ts',
                  'composables/maskeditor/gpuUtils.test.ts',
                  'composables/maskeditor/gpuUtils.ts',
                  'composables/maskeditor/imageWidgetAdapter.test.ts',
                  'composables/maskeditor/imageWidgetAdapter.ts',
                  'composables/maskeditor/panZoomUtils.test.ts',
                  'composables/maskeditor/panZoomUtils.ts',
                  'composables/maskeditor/splineUtils.ts',
                  'composables/maskeditor/useBrushAdjustment.test.ts',
                  'composables/maskeditor/useBrushAdjustment.ts',
                  'composables/maskeditor/useBrushDrawing.test.ts',
                  'composables/maskeditor/useBrushDrawing.ts',
                  'composables/maskeditor/useBrushPersistence.test.ts',
                  'composables/maskeditor/useBrushPersistence.ts',
                  'composables/maskeditor/useCanvasHistory.test.ts',
                  'composables/maskeditor/useCanvasHistory.ts',
                  'composables/maskeditor/useCanvasManager.test.ts',
                  'composables/maskeditor/useCanvasManager.ts',
                  'composables/maskeditor/useCanvasTools.test.ts',
                  'composables/maskeditor/useCanvasTools.ts',
                  'composables/maskeditor/useCanvasTransform.test.ts',
                  'composables/maskeditor/useCanvasTransform.ts',
                  'composables/maskeditor/useCoordinateTransform.test.ts',
                  'composables/maskeditor/useCoordinateTransform.ts',
                  'composables/maskeditor/useGPUResources.test.ts',
                  'composables/maskeditor/useGPUResources.ts',
                  'composables/maskeditor/useImageLoader.test.ts',
                  'composables/maskeditor/useImageLoader.ts',
                  'composables/maskeditor/useKeyboard.test.ts',
                  'composables/maskeditor/useKeyboard.ts',
                  'composables/maskeditor/useMaskEditor.test.ts',
                  'composables/maskeditor/useMaskEditor.ts',
                  'composables/maskeditor/useMaskEditorLoader.test.ts',
                  'composables/maskeditor/useMaskEditorLoader.ts',
                  'composables/maskeditor/useMaskEditorSaver.test.ts',
                  'composables/maskeditor/useMaskEditorSaver.ts',
                  'composables/maskeditor/usePanAndZoom.test.ts',
                  'composables/maskeditor/usePanAndZoom.ts',
                  'composables/maskeditor/useToolManager.test.ts',
                  'composables/maskeditor/useToolManager.ts',
                  'extensions/core/maskeditor/types.ts',
                  'extensions/core/maskeditor.test.ts',
                  'extensions/core/maskeditor.ts',
                  'stores/maskEditorDataStore.test.ts',
                  'stores/maskEditorDataStore.ts',
                  'stores/maskEditorStore.test.ts',
                  'stores/maskEditorStore.ts'
                ],
                roles: {
                  domain: 1,
                  application: 54,
                  presentation: 29,
                  integration: 2
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 256,
                  inbound: 10,
                  inboundSources: 8,
                  outbound: 80,
                  outboundToUnclassified: 80
                },
                deepImports: 6,
                forbidden: 8,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'painter',
                capability: 'Painter',
                owners: ['@jtydhr88', '@Comfy-Org/comfy_frontend_devs'],
                files: 7,
                paths: [
                  'components/painter/WidgetPainter.test.ts',
                  'components/painter/WidgetPainter.vue',
                  'composables/painter/usePainter.test.ts',
                  'composables/painter/usePainter.ts',
                  'extensions/core/painter.ts',
                  'lib/litegraph/src/widgets/PainterWidget.ts',
                  'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts'
                ],
                roles: { application: 2, presentation: 2, integration: 3 },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'baseline',
                  dependencies: 'baseline'
                },
                imports: {
                  inside: 4,
                  inbound: 4,
                  inboundSources: 4,
                  outbound: 38,
                  outboundToUnclassified: 34
                },
                deepImports: 4,
                forbidden: 4,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: false,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              },
              {
                id: 'workflow-templates',
                capability: 'Workflow templates',
                owners: [
                  '@christian-byrne',
                  '@comfyui-wiki',
                  '@Comfy-Org/comfy_frontend_devs'
                ],
                files: 47,
                paths: [
                  'components/templates/thumbnails/AudioThumbnail.test.ts',
                  'components/templates/thumbnails/AudioThumbnail.vue',
                  'components/templates/thumbnails/BaseThumbnail.test.ts',
                  'components/templates/thumbnails/BaseThumbnail.vue',
                  'components/templates/thumbnails/CompareSliderThumbnail.test.ts',
                  'components/templates/thumbnails/CompareSliderThumbnail.vue',
                  'components/templates/thumbnails/DefaultThumbnail.test.ts',
                  'components/templates/thumbnails/DefaultThumbnail.vue',
                  'components/templates/thumbnails/HoverDissolveThumbnail.test.ts',
                  'components/templates/thumbnails/HoverDissolveThumbnail.vue',
                  'components/templates/thumbnails/LogoOverlay.test.ts',
                  'components/templates/thumbnails/LogoOverlay.vue',
                  'components/templates/thumbnails/TemplatePreview.test.ts',
                  'components/templates/thumbnails/TemplatePreview.vue',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.test.ts',
                  'platform/workflow/templates/composables/useTemplateInputDownloadGraphSync.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.test.ts',
                  'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.test.ts',
                  'platform/workflow/templates/composables/useTemplateUrlLoader.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.test.ts',
                  'platform/workflow/templates/composables/useTemplateWorkflows.ts',
                  'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
                  'platform/workflow/templates/schemas/templateSchema.ts',
                  'platform/workflow/templates/services/templateInputService.test.ts',
                  'platform/workflow/templates/services/templateInputService.ts',
                  'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
                  'platform/workflow/templates/types/template.ts',
                  'platform/workflow/templates/types/templateDetail.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.test.ts',
                  'platform/workflow/templates/utils/refreshDownloadedTemplateInputBindings.ts',
                  'platform/workflow/templates/utils/templateDisplay.test.ts',
                  'platform/workflow/templates/utils/templateDisplay.ts',
                  'platform/workflow/templates/utils/templateInputAssets.test.ts',
                  'platform/workflow/templates/utils/templateInputAssets.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.test.ts',
                  'platform/workflow/templates/utils/templateModelAvailability.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.test.ts',
                  'platform/workflow/templates/utils/templateModelDownloadState.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.test.ts',
                  'platform/workflow/templates/utils/templateModelMetadata.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.test.ts',
                  'platform/workflow/templates/utils/templateModelRequirements.ts',
                  'platform/workflow/templates/utils/templateModelSetup.test.ts',
                  'platform/workflow/templates/utils/templateModelSetup.ts'
                ],
                roles: {
                  domain: 19,
                  application: 13,
                  infrastructure: 1,
                  presentation: 14
                },
                publicEntryPoints: 0,
                enforcement: {
                  deepImports: 'inventory',
                  dependencies: 'error'
                },
                imports: {
                  inside: 71,
                  inbound: 62,
                  inboundSources: 28,
                  outbound: 96,
                  outboundToUnclassified: 96
                },
                deepImports: 62,
                forbidden: 0,
                checks: {
                  noDeepImports: false,
                  noUnclassifiedDependencies: false,
                  noForbiddenEdges: true,
                  publicEntryPoint: false,
                  enforced: false
                },
                ready: false,
                extracted: false
              }
            ],
            links: [
              {
                from: null,
                to: 'workflow-templates',
                allowed: 0,
                legacy: 62,
                forbidden: 0
              },
              {
                from: null,
                to: 'mask-editor',
                allowed: 0,
                legacy: 6,
                forbidden: 0
              },
              {
                from: 'image-crop',
                to: null,
                allowed: 0,
                legacy: 34,
                forbidden: 0
              },
              {
                from: 'mask-editor',
                to: null,
                allowed: 0,
                legacy: 80,
                forbidden: 0
              },
              {
                from: 'painter',
                to: null,
                allowed: 0,
                legacy: 34,
                forbidden: 0
              },
              {
                from: 'workflow-templates',
                to: null,
                allowed: 0,
                legacy: 96,
                forbidden: 0
              },
              {
                from: 'painter',
                to: 'mask-editor',
                allowed: 0,
                legacy: 0,
                forbidden: 4
              },
              {
                from: null,
                to: 'image-crop',
                allowed: 0,
                legacy: 4,
                forbidden: 0
              },
              {
                from: 'image-compare',
                to: null,
                allowed: 0,
                legacy: 30,
                forbidden: 0
              },
              {
                from: 'image-compositor',
                to: null,
                allowed: 0,
                legacy: 94,
                forbidden: 0
              },
              {
                from: null,
                to: 'image-compare',
                allowed: 0,
                legacy: 4,
                forbidden: 0
              },
              {
                from: null,
                to: 'image-compositor',
                allowed: 0,
                legacy: 13,
                forbidden: 0
              },
              { from: null, to: 'painter', allowed: 0, legacy: 4, forbidden: 0 }
            ]
          }
        }
      ],
      prs: [
        {
          number: 19093,
          title:
            'refactor: split widget constructor type and value-control helpers out of scripts/widgets',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19093',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: null,
          additions: 285,
          deletions: 243,
          changedFiles: 43,
          baseRefName: 'main',
          headRefName: 'drjkl/widgets-registry-split',
          head: 'f1908f4bdd9a2e3b14764f7c9a3d63e06d718b4a',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 87,
          baseState: 71
        },
        {
          number: 19116,
          title: 'refactor: move progress text previews out of executionStore',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19116',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: 'APPROVED',
          additions: 355,
          deletions: 352,
          changedFiles: 8,
          baseRefName: 'main',
          headRefName: 'drjkl/progress-text-previews-view',
          head: 'dd32a979ac2ff2e894972ee88cff4267bfceeed9',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 88,
          baseState: 71
        },
        {
          number: 19118,
          title:
            'refactor: inject the api auth provider from the composition root',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19118',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 197,
          deletions: 118,
          changedFiles: 13,
          baseRefName: 'main',
          headRefName: 'drjkl/api-auth-provider',
          head: '4e31bda28797f0c58642cebedbcd0d8ade93ecce',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 89,
          baseState: 71
        },
        {
          number: 19121,
          title:
            'refactor: install workspace api credentials from the composition root',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19121',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: 'APPROVED',
          additions: 48,
          deletions: 7,
          changedFiles: 5,
          baseRefName: 'drjkl/api-auth-provider',
          headRefName: 'drjkl/workspace-api-auth',
          head: '30e44c21793583f5741c8f6e7109dbf66ae94550',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19118,
          containsParentHead: true,
          depth: 1,
          state: 90,
          baseState: 71
        },
        {
          number: 19131,
          title: 'refactor: split feature dialogs out of dialogService',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19131',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 1379,
          deletions: 1053,
          changedFiles: 81,
          baseRefName: 'drjkl/widgets-registry-split',
          headRefName: 'drjkl/dialog-service-split',
          head: 'c72a6d5b270990b072962c49d178f005b1310469',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19093,
          containsParentHead: true,
          depth: 1,
          state: 91,
          baseState: 71
        },
        {
          number: 19143,
          title:
            'refactor: read the app singleton through useApp() below scripts/app',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19143',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 807,
          deletions: 439,
          changedFiles: 58,
          baseRefName: 'drjkl/dialog-service-split',
          headRefName: 'drjkl/app-instance-leaf',
          head: '79fa9488f7b79d62caeae96e6e9f40c838c7bc88',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19131,
          containsParentHead: true,
          depth: 2,
          state: 92,
          baseState: 71
        },
        {
          number: 19148,
          title:
            'refactor: let billing rails announce refreshes instead of reading the context',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19148',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 491,
          deletions: 365,
          changedFiles: 40,
          baseRefName: 'drjkl/app-small-cycles',
          headRefName: 'drjkl/billing-layering',
          head: '240dfbeb985edd934a45f6883905c3aa853e5527',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19189,
          containsParentHead: true,
          depth: 6,
          state: 96,
          baseState: 71
        },
        {
          number: 19153,
          title: 'refactor: make types/comfy a leaf of the app runtime',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19153',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 558,
          deletions: 412,
          changedFiles: 25,
          baseRefName: 'drjkl/app-instance-leaf',
          headRefName: 'drjkl/comfy-types-leaf',
          head: '6a802eca61eccfca4be4fedbe2f4a42781a0273c',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19143,
          containsParentHead: true,
          depth: 3,
          state: 93,
          baseState: 71
        },
        {
          number: 19186,
          title: 'refactor: break the workbench import cycles',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19186',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 320,
          deletions: 214,
          changedFiles: 24,
          baseRefName: 'drjkl/comfy-types-leaf',
          headRefName: 'drjkl/workbench-cycles',
          head: '2bca9fe2b22a58f7f666aab6356484870a0e69fa',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19153,
          containsParentHead: true,
          depth: 4,
          state: 94,
          baseState: 71
        },
        {
          number: 19189,
          title: 'refactor: break the small app import cycles',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19189',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 889,
          deletions: 835,
          changedFiles: 154,
          baseRefName: 'drjkl/workbench-cycles',
          headRefName: 'drjkl/app-small-cycles',
          head: 'be7f95b456f3fc2ab0557500825a5bba0c03c0b4',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 15,
          parentPr: 19186,
          containsParentHead: true,
          depth: 5,
          state: 95,
          baseState: 71
        },
        {
          number: 19768,
          title: 'tool: add domain architecture census and ratchet',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19768',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: 'CHANGES_REQUESTED',
          additions: 2732,
          deletions: 5,
          changedFiles: 18,
          baseRefName: 'main',
          headRefName: 'feat/ddd-architecture-ratchet',
          head: 'b1060fb11d6ad5d8123e65c8f023932408172aa2',
          mergeBase: 'e3e1b1513fe0663cffaf0d60b964ef4ece93bd1e',
          behindMain: 14,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 97,
          baseState: 72
        },
        {
          number: 19855,
          title: 'feat: classify image crop, compare, and painter domains',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19855',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 468,
          deletions: 16,
          changedFiles: 12,
          baseRefName: 'feat/ddd-architecture-ratchet',
          headRefName: 'feat/ddd-classify-media-tools',
          head: 'dffd90c7deebd457c2293443f7cb9668a7220514',
          mergeBase: 'e3e1b1513fe0663cffaf0d60b964ef4ece93bd1e',
          behindMain: 14,
          parentPr: 19768,
          containsParentHead: true,
          depth: 1,
          state: 98,
          baseState: 72
        },
        {
          number: 19856,
          title: 'feat: classify image compositor domain',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19856',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 217,
          deletions: 6,
          changedFiles: 6,
          baseRefName: 'feat/ddd-classify-media-tools',
          headRefName: 'feat/ddd-classify-compositor',
          head: 'afcc41d54ec8fe160cc043cac87472493d532337',
          mergeBase: 'e3e1b1513fe0663cffaf0d60b964ef4ece93bd1e',
          behindMain: 14,
          parentPr: 19855,
          containsParentHead: true,
          depth: 2,
          state: 99,
          baseState: 72
        }
      ]
    }
  },
  graph: {
    notes: [
      'x and y are 0..1 layout coordinates, y pointing down.',
      'states is a list of [fromState, knotId] changes over the state indexes of timeline.json; -1 is not in a knot, -2 is file absent.',
      'edges are [nodeIndex, nodeIndex, [[firstState, lastState], ...]] for imports inside one knot.'
    ],
    aspect: 0.9791,
    nodes: [
      {
        path: 'base/common/downloadUtil.ts',
        x: 0.5134,
        y: 0.5821,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue',
        x: 0.2862,
        y: 0.7183,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ShortcutsList.vue',
        x: 0.2698,
        y: 0.7226,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue',
        x: 0.2895,
        y: 0.7277,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/terminal/LogsTerminal.vue',
        x: 0.379,
        y: 0.8581,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/boundingBoxes/WidgetBoundingBoxes.vue',
        x: 0.8698,
        y: 0.7369,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/builder/useEmptyWorkflowDialog.ts',
        x: 0.4833,
        y: 0.4938,
        states: [
          [0, 0],
          [25, -1]
        ]
      },
      {
        path: 'components/cameraAngle/CameraAngle.vue',
        x: 0.7529,
        y: 0.5887,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/cameraInfo/CameraInfo.vue',
        x: 0.8301,
        y: 0.6338,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/common/BackgroundImageUpload.vue',
        x: 0.3782,
        y: 0.7882,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/common/CustomizationDialog.vue',
        x: 0.4687,
        y: 0.2579,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/FormItem.vue',
        x: 0.3011,
        y: 0.8297,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorer.vue',
        x: 0.4411,
        y: 0.4157,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerTreeNode.vue',
        x: 0.4397,
        y: 0.3531,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2.vue',
        x: 0.5013,
        y: 0.3498,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2Node.vue',
        x: 0.5243,
        y: 0.351,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/WaveAudioPlayer.vue',
        x: 0.4201,
        y: 1,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/curve/WidgetCurve.vue',
        x: 0.7981,
        y: 0.7025,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/custom/widget/TemplateFilterControls.vue',
        x: 0.3286,
        y: 0.3108,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetail.vue',
        x: 0.3128,
        y: 0.1669,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetailGroup.vue',
        x: 0.2658,
        y: 0.0457,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadFailure.vue',
        x: 0.3272,
        y: 0.0006,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadStatus.vue',
        x: 0.3082,
        y: 0.0307,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateModelStatus.vue',
        x: 0.2636,
        y: 0,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateSelectorDialog.vue',
        x: 0.3964,
        y: 0.3678,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/dialog/content/ApiNodesSignInContent.vue',
        x: 0.39,
        y: 0.4004,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/ConfirmationDialogContent.vue',
        x: 0.3628,
        y: 0.5918,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/ErrorDialogContent.vue',
        x: 0.4487,
        y: 0.6355,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/SignInContent.vue',
        x: 0.2974,
        y: 0.4279,
        states: [
          [0, 0],
          [92, 17],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/TopUpCreditsDialogContentLegacy.vue',
        x: 0.3091,
        y: 0.5047,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/UpdatePasswordContent.vue',
        x: 0.271,
        y: 0.417,
        states: [
          [0, 0],
          [92, 17],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/error/FindIssueButton.vue',
        x: 0.3291,
        y: 0.6377,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/AboutPanel.vue',
        x: 0.3162,
        y: 0.7155,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/CreditsPanel.vue',
        x: 0.2562,
        y: 0.5579,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/CurrentUserMessage.vue',
        x: 0.2149,
        y: 0.7291,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/KeybindingPanel.vue',
        x: 0.3534,
        y: 0.6801,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/UsageLogsTable.vue',
        x: 0.2321,
        y: 0.4931,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/UserPanel.vue',
        x: 0.262,
        y: 0.596,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingContent.vue',
        x: 0.0805,
        y: 0.792,
        states: [
          [0, 0],
          [17, 11],
          [95, -1],
          [97, 11]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingFooter.vue',
        x: 0.2716,
        y: 0.7658,
        states: [
          [0, 0],
          [17, 11],
          [95, -1],
          [97, 11]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingCommandRows.vue',
        x: 0.2902,
        y: 0.7062,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingPresetToolbar.vue',
        x: 0.3061,
        y: 0.773,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/signin/ApiKeyForm.vue',
        x: 0.3036,
        y: 0.4102,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignInForm.vue',
        x: 0.2587,
        y: 0.3862,
        states: [
          [0, 0],
          [92, 17],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignUpForm.vue',
        x: 0.201,
        y: 0.3578,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/TurnstileWidget.vue',
        x: 0.0868,
        y: 0.2753,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
        x: 0.2577,
        y: 0.5217,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/gradientslider/GradientSlider.vue',
        x: 0.9597,
        y: 0.4748,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/gradientslider/gradients.ts',
        x: 0.9689,
        y: 0.4077,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/graph/widgets/MultiSelectWidget.vue',
        x: 0.7709,
        y: 0.7202,
        states: [
          [0, 0],
          [28, -1]
        ]
      },
      {
        path: 'components/graph/widgets/TextPreviewWidget.vue',
        x: 0.6407,
        y: 0.7091,
        states: [
          [0, 0],
          [88, -1],
          [89, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'components/imagecrop/WidgetImageCrop.vue',
        x: 0.8844,
        y: 0.6976,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/load3d/Load3D.vue',
        x: 0.7293,
        y: 0.6217,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3DAdvanced.vue',
        x: 0.8144,
        y: 0.673,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3DMenuBar.vue',
        x: 0.7894,
        y: 0.6751,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3dViewerContent.vue',
        x: 0.6681,
        y: 0.6984,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/controls/ViewerControls.vue',
        x: 0.796,
        y: 0.6779,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/controls/viewer/ViewerLightControls.vue',
        x: 0.5813,
        y: 0.7385,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/menubar/LightMenuGroup.vue',
        x: 0.6674,
        y: 0.7164,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/ImageLayerSettingsPanel.vue',
        x: 0.8645,
        y: 0.967,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/MaskEditorContent.vue',
        x: 0.8096,
        y: 0.7596,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/PointerZone.vue',
        x: 0.8708,
        y: 0.8895,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/SidePanel.vue',
        x: 0.8575,
        y: 0.9077,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/ToolPanel.vue',
        x: 0.8614,
        y: 0.8949,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/dialog/TopBarHeader.vue',
        x: 0.7823,
        y: 0.7584,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/node/NodeHelpContent.vue',
        x: 0.5239,
        y: 0.2617,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreview.vue',
        x: 0.5832,
        y: 0.4044,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreviewCard.vue',
        x: 0.6045,
        y: 0.3174,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePricingBadge.vue',
        x: 0.5695,
        y: 0.2519,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodeProviderBadge.vue',
        x: 0.5589,
        y: 0.2539,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/painter/WidgetPainter.vue',
        x: 0.8382,
        y: 0.7469,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/palette/WidgetColors.vue',
        x: 0.9275,
        y: 0.7315,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/JobHistoryActionsMenu.vue',
        x: 0.4496,
        y: 0.6758,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/dialogs/QueueClearHistoryDialog.vue',
        x: 0.4588,
        y: 0.889,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobAssetsList.vue',
        x: 0.4401,
        y: 0.858,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsHoverPopover.vue',
        x: 0.367,
        y: 0.8558,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsPopover.vue',
        x: 0.4359,
        y: 0.695,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobFilterActions.vue',
        x: 0.4424,
        y: 0.8753,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/buildVirtualJobRows.ts',
        x: 0.4214,
        y: 0.9152,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useJobErrorReporting.ts',
        x: 0.3775,
        y: 0.693,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useQueueEstimates.ts',
        x: 0.4554,
        y: 0.7404,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/RangeEditor.vue',
        x: 0.9003,
        y: 0.6094,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/WidgetRange.vue',
        x: 0.8473,
        y: 0.6412,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/rangeUtils.ts',
        x: 0.9558,
        y: 0.6301,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/searchbox/NodeSearchFilter.vue',
        x: 0.4901,
        y: 0.3076,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AppsSidebarTab.vue',
        x: 0.4174,
        y: 0.5591,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarGridView.vue',
        x: 0.5377,
        y: 0.9416,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarListView.vue',
        x: 0.5267,
        y: 0.8619,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarTab.vue',
        x: 0.5504,
        y: 0.7898,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/BaseWorkflowsSidebarTab.vue',
        x: 0.4526,
        y: 0.4669,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/JobHistorySidebarTab.vue',
        x: 0.4822,
        y: 0.7493,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/ModelLibrarySidebarTab.vue',
        x: 0.4037,
        y: 0.5084,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTab.vue',
        x: 0.4719,
        y: 0.4353,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTabV2.vue',
        x: 0.4423,
        y: 0.4294,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabCloseButton.vue',
        x: 0.4217,
        y: 0.4447,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabTemplate.vue',
        x: 0.4599,
        y: 0.5803,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/WorkflowsSidebarTab.vue',
        x: 0.3852,
        y: 0.3776,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/DownloadItem.vue',
        x: 0.2658,
        y: 0.2225,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue',
        x: 0.3072,
        y: 0.3208,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ModelPreview.vue',
        x: 0.325,
        y: 0.5895,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/AllNodesPanel.vue',
        x: 0.472,
        y: 0.3304,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodeCard.vue',
        x: 0.5285,
        y: 0.2955,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodesPanel.vue',
        x: 0.4827,
        y: 0.2961,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeBookmarkTreeExplorer.vue',
        x: 0.5066,
        y: 0.3958,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue',
        x: 0.4657,
        y: 0.3261,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/MediaLightbox.vue',
        x: 0.4841,
        y: 0.8677,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultAudio.vue',
        x: 0.4563,
        y: 0.9316,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultText.vue',
        x: 0.4698,
        y: 0.9223,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultVideo.vue',
        x: 0.4974,
        y: 0.7602,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue',
        x: 0.4721,
        y: 0.3904,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/topbar/CloudBadge.vue',
        x: 0.4117,
        y: 0.6369,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/topbar/TopbarBadge.vue',
        x: 0.4688,
        y: 0.7014,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'components/ui/toast/toastStore.ts',
        x: 0.4195,
        y: 0.5331,
        states: [
          [0, -2],
          [71, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'components/videoEdit/VideoEditPanel.vue',
        x: 0.889,
        y: 0.6888,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/VideoFilmstripTrim.vue',
        x: 0.9699,
        y: 0.6726,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/WidgetVideoEdit.vue',
        x: 0.7767,
        y: 0.6389,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/auth/useAuthActions.ts',
        x: 0.3332,
        y: 0.4712,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/auth/useAuthDialogs.ts',
        x: 0.3029,
        y: 0.3885,
        states: [
          [0, -2],
          [91, 0],
          [92, 17],
          [95, -1],
          [97, -2]
        ]
      },
      {
        path: 'composables/auth/useCurrentUser.ts',
        x: 0.3594,
        y: 0.5213,
        states: [[0, 0]]
      },
      {
        path: 'composables/auth/useTurnstile.ts',
        x: 0.2146,
        y: 0.4153,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/billingRail.ts',
        x: 0.1353,
        y: 0.501,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/topupBalanceRefresh.ts',
        x: 0.2568,
        y: 0.3747,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/types.ts',
        x: 0.2165,
        y: 0.5076,
        states: [[0, 0]]
      },
      {
        path: 'composables/billing/useBillingContext.ts',
        x: 0.2341,
        y: 0.5095,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/useBillingDialogs.ts',
        x: 0.2784,
        y: 0.5327,
        states: [
          [0, -2],
          [91, 0],
          [92, 17],
          [97, -2]
        ]
      },
      {
        path: 'composables/billing/useBillingRouting.ts',
        x: 0.2095,
        y: 0.5263,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/useLegacyBilling.ts',
        x: 0.2309,
        y: 0.4597,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/useNextInvoice.ts',
        x: 0.1102,
        y: 0.5,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'composables/billing/usePartnerNodesRunGate.ts',
        x: 0.4225,
        y: 0.521,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/usePendingTopup.ts',
        x: 0.2547,
        y: 0.4467,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/billing/useSubscriptionPaywall.ts',
        x: 0.1476,
        y: 0.5581,
        states: [
          [0, -2],
          [96, 17],
          [97, -2]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useCommandSubcategories.ts',
        x: 0.2665,
        y: 0.7105,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useLogsTerminal.ts',
        x: 0.4693,
        y: 0.7391,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useShortcutsTab.ts',
        x: 0.3459,
        y: 0.7113,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useTerminalTabs.ts',
        x: 0.3873,
        y: 0.7576,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/boundingBoxes/useBoundingBoxes.ts',
        x: 0.7451,
        y: 0.6344,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/canvas/useSelectedLiteGraphItems.ts',
        x: 0.6497,
        y: 0.4716,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/canvas/visibleCanvasViewport.ts',
        x: 0.6435,
        y: 0.4561,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/element/useAbsolutePosition.ts',
        x: 0.6293,
        y: 0.4914,
        states: [
          [0, 0],
          [28, -1]
        ]
      },
      {
        path: 'composables/element/useCanvasPositionConversion.ts',
        x: 0.6815,
        y: 0.4404,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/graph/contextMenuConverter.ts',
        x: 0.8011,
        y: 0.5312,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useCanvasRefresh.ts',
        x: 0.6234,
        y: 0.4175,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useFrameNodes.ts',
        x: 0.6205,
        y: 0.5012,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useGroupMenuOptions.ts',
        x: 0.6209,
        y: 0.4826,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useImageMenuOptions.ts',
        x: 0.5986,
        y: 0.577,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useMoreOptionsMenu.ts',
        x: 0.6815,
        y: 0.5548,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useNodeArrangement.ts',
        x: 0.7161,
        y: 0.4271,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeCustomization.ts',
        x: 0.6781,
        y: 0.4025,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeErrorFlagSync.ts',
        x: 0.6139,
        y: 0.5451,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/graph/useNodeMenuOptions.ts',
        x: 0.6681,
        y: 0.4437,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectedNodeActions.ts',
        x: 0.5857,
        y: 0.4954,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionMenuOptions.ts',
        x: 0.6569,
        y: 0.4593,
        states: [
          [0, 0],
          [1, 8],
          [95, -1],
          [97, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectionOperations.ts',
        x: 0.5707,
        y: 0.5052,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionState.ts',
        x: 0.6227,
        y: 0.4743,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSubgraphOperations.ts',
        x: 0.5906,
        y: 0.5101,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/maskeditor/imageWidgetAdapter.ts',
        x: 0.7749,
        y: 0.6492,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushDrawing.ts',
        x: 0.7509,
        y: 0.9628,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushPersistence.ts',
        x: 0.6469,
        y: 0.8821,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useImageLoader.ts',
        x: 0.8788,
        y: 0.8243,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditor.ts',
        x: 0.7645,
        y: 0.6473,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorLoader.ts',
        x: 0.6948,
        y: 0.6541,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorSaver.ts',
        x: 0.6804,
        y: 0.6491,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useToolManager.ts',
        x: 0.7776,
        y: 0.8312,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/node/canvasImagePreviewTypes.ts',
        x: 0.7423,
        y: 0.3753,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/startModelNodeDragFromAsset.ts',
        x: 0.4064,
        y: 0.544,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'composables/node/useNodeAnimatedImage.ts',
        x: 0.663,
        y: 0.5179,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodeCanvasImagePreview.ts',
        x: 0.7102,
        y: 0.4386,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragAndDrop.ts',
        x: 0.6215,
        y: 0.6799,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragToCanvas.ts',
        x: 0.5265,
        y: 0.4519,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'composables/node/useNodeFileInput.ts',
        x: 0.6679,
        y: 0.5942,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodeImage.ts',
        x: 0.5336,
        y: 0.5147,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodeImageUpload.ts',
        x: 0.5554,
        y: 0.6003,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodePaste.ts',
        x: 0.6662,
        y: 0.6347,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodePreviewAndDrag.ts',
        x: 0.5252,
        y: 0.3934,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/node/useNodePricing.ts',
        x: 0.7101,
        y: 0.4493,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/useNodeProgressText.ts',
        x: 0.6634,
        y: 0.5777,
        states: [
          [0, 0],
          [88, -1],
          [89, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/node/usePartnerNodesInGraph.ts',
        x: 0.5345,
        y: 0.5232,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/painter/usePainter.ts',
        x: 0.7105,
        y: 0.6456,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobList.ts',
        x: 0.482,
        y: 0.757,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobMenu.ts',
        x: 0.5161,
        y: 0.6311,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueClearHistoryDialog.ts',
        x: 0.4353,
        y: 0.9205,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueFeatureFlags.ts',
        x: 0.4459,
        y: 0.7143,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueProgress.ts',
        x: 0.4747,
        y: 0.7751,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useResultGallery.ts',
        x: 0.4809,
        y: 0.8222,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useAssetsSidebarTab.ts',
        x: 0.4653,
        y: 0.6844,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useJobHistorySidebarTab.ts',
        x: 0.4203,
        y: 0.6973,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useModelLibrarySidebarTab.ts',
        x: 0.373,
        y: 0.4737,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useNodeLibrarySidebarTab.ts',
        x: 0.4387,
        y: 0.5144,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/tree/useTreeFolderOperations.ts',
        x: 0.4087,
        y: 0.2885,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useAppMode.ts',
        x: 0.5183,
        y: 0.4858,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'composables/useCameraAngle.ts',
        x: 0.8325,
        y: 0.6743,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useCameraInfo.ts',
        x: 0.9238,
        y: 0.6493,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useCopy.ts',
        x: 0.595,
        y: 0.3564,
        states: [
          [0, -1],
          [54, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/useCopyToClipboard.ts',
        x: 0.3504,
        y: 0.6462,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'composables/useEditKeybindingDialog.ts',
        x: 0.2243,
        y: 0.7053,
        states: [
          [0, 0],
          [17, 11],
          [95, -1],
          [97, 11]
        ]
      },
      {
        path: 'composables/useErrorHandling.ts',
        x: 0.3852,
        y: 0.4769,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'composables/useEssentialTileNodeDef.ts',
        x: 0.5151,
        y: 0.2514,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useFeatureFlags.ts',
        x: 0.3649,
        y: 0.5757,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'composables/useImageCrop.ts',
        x: 0.8134,
        y: 0.638,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useLoad3d.ts',
        x: 0.658,
        y: 0.6405,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'composables/useLoad3dViewer.ts',
        x: 0.6626,
        y: 0.697,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'composables/useNodeHelpContent.ts',
        x: 0.5102,
        y: 0.2834,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/usePaste.ts',
        x: 0.5594,
        y: 0.4765,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/useRangeEditor.ts',
        x: 0.942,
        y: 0.6588,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useRunButtonTelemetry.ts',
        x: 0.4173,
        y: 0.5046,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'composables/useTemplateFiltering.ts',
        x: 0.3867,
        y: 0.4658,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useTreeExpansion.ts',
        x: 0.4193,
        y: 0.3914,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useUpstreamValue.ts',
        x: 0.8047,
        y: 0.613,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useViewportNodeWiring.ts',
        x: 0.9027,
        y: 0.68,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useVueFeatureFlags.ts',
        x: 0.5037,
        y: 0.5322,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'composables/useWaveAudioPlayer.ts',
        x: 0.4321,
        y: 0.8528,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useWorkflowTemplateSelectorDialog.ts',
        x: 0.3801,
        y: 0.4482,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/video/useCropRatioLock.ts',
        x: 0.9617,
        y: 0.7242,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useTimelineScrub.ts',
        x: 0.9894,
        y: 0.7617,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoEditModel.ts',
        x: 0.9121,
        y: 0.6483,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoFilmstrip.ts',
        x: 0.8069,
        y: 0.7766,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoSourceUrl.ts',
        x: 0.6501,
        y: 0.5932,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'config/billingWeb.ts',
        x: 0.2289,
        y: 0.4484,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/comfyApi.ts',
        x: 0.2668,
        y: 0.4416,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/firebase.ts',
        x: 0.1987,
        y: 0.3816,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/turnstile.ts',
        x: 0.1568,
        y: 0.339,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellLifecycle.ts',
        x: 0.7326,
        y: 0.4819,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellState.ts',
        x: 0.8048,
        y: 0.3928,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/adoptPromotedWidgetValue.ts',
        x: 0.83,
        y: 0.4926,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/liftNodeErrorsToBoundary.ts',
        x: 0.652,
        y: 0.5665,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/preview/previewExposureChain.ts',
        x: 0.959,
        y: 0.3804,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedInputWidget.ts',
        x: 0.703,
        y: 0.4966,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedWidgetControl.ts',
        x: 0.5494,
        y: 0.6691,
        states: [
          [0, -2],
          [87, 0],
          [88, -2],
          [91, 0],
          [92, -1],
          [97, -2]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedWidgetTypes.ts',
        x: 0.6906,
        y: 0.5546,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotionUtils.ts',
        x: 0.6918,
        y: 0.4787,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveConcretePromotedWidget.ts',
        x: 0.6933,
        y: 0.49,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolvePromotedWidgetSource.ts',
        x: 0.7356,
        y: 0.519,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputLink.ts',
        x: 0.7873,
        y: 0.3893,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputTarget.ts',
        x: 0.7306,
        y: 0.4476,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/transferLinkPresentation.ts',
        x: 0.8421,
        y: 0.362,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/comboWidgetInventory.ts',
        x: 0.7091,
        y: 0.5715,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicGroupWidget.ts',
        x: 0.747,
        y: 0.5009,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicInputSpec.ts',
        x: 0.6872,
        y: 0.5348,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicWidgets.ts',
        x: 0.7314,
        y: 0.5244,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'core/graph/widgets/nodeWidgetValues.ts',
        x: 0.7874,
        y: 0.6232,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/valueControlWidgets.ts',
        x: 0.676,
        y: 0.6336,
        states: [
          [0, -2],
          [87, 0],
          [88, -2],
          [91, 0],
          [93, -1],
          [97, -2]
        ]
      },
      {
        path: 'core/schemas/parseNodePropertyArray.ts',
        x: 0.9608,
        y: 0.4443,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/previewExposureSchema.ts',
        x: 0.912,
        y: 0.4364,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/promotionSchema.ts',
        x: 0.9715,
        y: 0.4541,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/proxyWidgetQuarantineSchema.ts',
        x: 0.92,
        y: 0.4825,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'extensions/core/agentPanel.ts',
        x: 0.4575,
        y: 0.5112,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraAngle.ts',
        x: 0.7233,
        y: 0.5914,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraAngle/CameraAngleViewport.ts',
        x: 0.9436,
        y: 0.8115,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraInfo.ts',
        x: 0.7384,
        y: 0.6096,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraInfo/CameraInfoViewport.ts',
        x: 0.9451,
        y: 0.7617,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/clipspace.ts',
        x: 0.5683,
        y: 0.6437,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudBadges.ts',
        x: 0.5019,
        y: 0.5006,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudFeedbackTopbarButton.ts',
        x: 0.5068,
        y: 0.5211,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudRemoteConfig.ts',
        x: 0.4268,
        y: 0.54,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudSessionCookie.ts',
        x: 0.4851,
        y: 0.5674,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/contextMenuFilter.ts',
        x: 0.7052,
        y: 0.5063,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/createBoundingBoxes.ts',
        x: 0.5741,
        y: 0.4524,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/customWidgets.ts',
        x: 0.7519,
        y: 0.554,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/dynamicPrompts.ts',
        x: 0.6971,
        y: 0.5303,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/editAttention.ts',
        x: 0.6143,
        y: 0.6624,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/electronAdapter.ts',
        x: 0.4991,
        y: 0.5507,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/groupNode.ts',
        x: 0.6784,
        y: 0.4987,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/groupOptions.ts',
        x: 0.6479,
        y: 0.529,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCompare.ts',
        x: 0.6873,
        y: 0.5212,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCompositor.ts',
        x: 0.7031,
        y: 0.6098,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCrop.ts',
        x: 0.6933,
        y: 0.52,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/index.ts',
        x: 0.6202,
        y: 0.5478,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/layerEditor.ts',
        x: 0.6837,
        y: 0.6674,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/lightInfo.ts',
        x: 0.6282,
        y: 0.699,
        states: [
          [0, -2],
          [30, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d.ts',
        x: 0.6685,
        y: 0.601,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/GizmoManager.ts',
        x: 0.8012,
        y: 0.8813,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/HDRIManager.ts',
        x: 0.6947,
        y: 0.8299,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3DConfiguration.ts',
        x: 0.6843,
        y: 0.6076,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3d.ts',
        x: 0.7387,
        y: 0.7526,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3dUtils.ts',
        x: 0.6078,
        y: 0.686,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/LoaderManager.ts',
        x: 0.711,
        y: 0.9032,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/MeshModelAdapter.ts',
        x: 0.714,
        y: 0.9902,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/ModelAdapter.ts',
        x: 0.6574,
        y: 0.8514,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/PointCloudModelAdapter.ts',
        x: 0.6325,
        y: 0.8061,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneManager.ts',
        x: 0.7889,
        y: 0.822,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneModelManager.ts',
        x: 0.7173,
        y: 0.8798,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SplatModelAdapter.ts',
        x: 0.7027,
        y: 0.993,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Viewport3d.ts',
        x: 0.8807,
        y: 0.7993,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/createLoad3d.ts',
        x: 0.7209,
        y: 0.8157,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/createViewport3d.ts',
        x: 0.9288,
        y: 0.861,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/exportMenuHelper.ts',
        x: 0.7637,
        y: 0.6119,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dSerialize.ts',
        x: 0.7881,
        y: 0.6557,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dViewport.ts',
        x: 0.8469,
        y: 0.8333,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3dAdvanced.ts',
        x: 0.7456,
        y: 0.5961,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3dLazy.ts',
        x: 0.6602,
        y: 0.6071,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3dPreviewExtensions.ts',
        x: 0.6894,
        y: 0.6044,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/maskeditor.ts',
        x: 0.7026,
        y: 0.5803,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/nodeTemplates.ts',
        x: 0.571,
        y: 0.5343,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/noteNode.ts',
        x: 0.712,
        y: 0.5556,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/painter.ts',
        x: 0.5841,
        y: 0.4482,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/previewAny.ts',
        x: 0.6754,
        y: 0.5505,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/rerouteNode.ts',
        x: 0.7315,
        y: 0.5059,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveImageExtraOutput.ts',
        x: 0.7168,
        y: 0.567,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveMesh.ts',
        x: 0.6945,
        y: 0.5859,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveText.ts',
        x: 0.6383,
        y: 0.6489,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/selectionBorder.ts',
        x: 0.6614,
        y: 0.4734,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/simpleTouchSupport.ts',
        x: 0.6569,
        y: 0.4826,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/slotDefaultTypes.ts',
        x: 0.6972,
        y: 0.3891,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/slotDefaults.ts',
        x: 0.6827,
        y: 0.4868,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/textPreviewWidgets.ts',
        x: 0.7006,
        y: 0.5926,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/uploadAudio.ts',
        x: 0.6397,
        y: 0.6013,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/uploadImage.ts',
        x: 0.7147,
        y: 0.5336,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/webcamCapture.ts',
        x: 0.6451,
        y: 0.5858,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/widgetInputs.ts',
        x: 0.73,
        y: 0.5662,
        states: [
          [0, 0],
          [66, 14],
          [95, -1],
          [97, 14]
        ]
      },
      {
        path: 'extensions/core/widgetValuePropagation.ts',
        x: 0.7667,
        y: 0.5237,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/CanvasPointer.ts',
        x: 0.8708,
        y: 0.4292,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/ContextMenu.ts',
        x: 0.8699,
        y: 0.4436,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/CurveEditor.ts',
        x: 0.8767,
        y: 0.4366,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/DragAndScale.ts',
        x: 0.7469,
        y: 0.4182,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraph.ts',
        x: 0.7691,
        y: 0.4207,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphBadge.ts',
        x: 0.8299,
        y: 0.3849,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphButton.ts',
        x: 0.868,
        y: 0.4643,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphCanvas.ts',
        x: 0.7919,
        y: 0.435,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphGroup.ts',
        x: 0.8129,
        y: 0.4218,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphNode.ts',
        x: 0.791,
        y: 0.5122,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LLink.ts',
        x: 0.7956,
        y: 0.4187,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LinkMap.ts',
        x: 0.8677,
        y: 0.3066,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LiteGraphGlobal.ts',
        x: 0.8224,
        y: 0.4357,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/Reroute.ts',
        x: 0.813,
        y: 0.4085,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/FloatingRenderLink.ts',
        x: 0.8702,
        y: 0.415,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/InputIndicators.ts',
        x: 0.9111,
        y: 0.3405,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/LinkConnector.ts',
        x: 0.8253,
        y: 0.4338,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingInputLink.ts',
        x: 0.8242,
        y: 0.4209,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingLinkBase.ts',
        x: 0.8468,
        y: 0.4038,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingOutputLink.ts',
        x: 0.8342,
        y: 0.4261,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/RenderLink.ts',
        x: 0.818,
        y: 0.4278,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/SelectedItemsView.ts',
        x: 0.8521,
        y: 0.354,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputFromIoNodeLink.ts',
        x: 0.8186,
        y: 0.4121,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputRenderLink.ts',
        x: 0.8443,
        y: 0.4386,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromIoNodeLink.ts',
        x: 0.8355,
        y: 0.3986,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromRerouteLink.ts',
        x: 0.8174,
        y: 0.3985,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputRenderLink.ts',
        x: 0.8364,
        y: 0.4429,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/getCanvasContextMenuTarget.ts',
        x: 0.833,
        y: 0.3552,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/hitTesting.ts',
        x: 0.8156,
        y: 0.353,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadgeRenderer.ts',
        x: 0.8291,
        y: 0.3594,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadges.ts',
        x: 0.8608,
        y: 0.3792,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkGeometry.ts',
        x: 0.7996,
        y: 0.3836,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkVisibility.ts',
        x: 0.8408,
        y: 0.3792,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/measureSlots.ts',
        x: 0.8505,
        y: 0.4663,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/reduceGesture.ts',
        x: 0.9457,
        y: 0.3511,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/resolvePointerTarget.ts',
        x: 0.8415,
        y: 0.3956,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/contextMenuCompat.ts',
        x: 0.7077,
        y: 0.4633,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/draw.ts',
        x: 0.8787,
        y: 0.452,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/extensionPersistence.ts',
        x: 0.8698,
        y: 0.3813,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/graphIntents.ts',
        x: 0.673,
        y: 0.4896,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/idAllocation.ts',
        x: 0.8335,
        y: 0.3717,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/ConstrainedSize.ts',
        x: 0.9309,
        y: 0.3734,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphCanvasEventMap.ts',
        x: 0.8575,
        y: 0.4374,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphEventMap.ts',
        x: 0.8553,
        y: 0.4269,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LinkConnectorEventMap.ts',
        x: 0.8649,
        y: 0.4316,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/Rectangle.ts',
        x: 0.85,
        y: 0.4502,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphEventMap.ts',
        x: 0.847,
        y: 0.4722,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphInputEventMap.ts',
        x: 0.8696,
        y: 0.4896,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/interfaces.ts',
        x: 0.7892,
        y: 0.4692,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/linkDeduplication.ts',
        x: 0.6673,
        y: 0.431,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraph.ts',
        x: 0.7244,
        y: 0.508,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraphInstance.ts',
        x: 0.9002,
        y: 0.4603,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/measure.ts',
        x: 0.8057,
        y: 0.4376,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeInputSlot.ts',
        x: 0.8289,
        y: 0.4691,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeOutputSlot.ts',
        x: 0.8337,
        y: 0.4614,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeSlot.ts',
        x: 0.8392,
        y: 0.4806,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/SlotBase.ts',
        x: 0.9187,
        y: 0.4122,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotDescriptorView.ts',
        x: 0.8909,
        y: 0.4523,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotLinks.ts',
        x: 0.7802,
        y: 0.4615,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotUtils.ts',
        x: 0.8118,
        y: 0.4455,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/widgetsView.ts',
        x: 0.825,
        y: 0.5087,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/nodeBadgeDraw.ts',
        x: 0.7577,
        y: 0.3744,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/remintLinkRemap.ts',
        x: 0.811,
        y: 0.3295,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/strings.ts',
        x: 0.8029,
        y: 0.4056,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphInput.ts',
        x: 0.8658,
        y: 0.4091,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphOutput.ts',
        x: 0.8658,
        y: 0.4026,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/ExecutableNodeDTO.ts',
        x: 0.815,
        y: 0.4771,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/Subgraph.ts',
        x: 0.8086,
        y: 0.4521,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphIONodeBase.ts',
        x: 0.826,
        y: 0.4161,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInput.ts',
        x: 0.8204,
        y: 0.4505,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInputNode.ts',
        x: 0.8386,
        y: 0.4111,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphNode.ts',
        x: 0.7983,
        y: 0.4793,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutput.ts',
        x: 0.835,
        y: 0.4341,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutputNode.ts',
        x: 0.8352,
        y: 0.4158,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphSlotBase.ts',
        x: 0.8486,
        y: 0.4295,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/promotedWidgetStoreProjection.ts',
        x: 0.8462,
        y: 0.5158,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphDeduplication.ts',
        x: 0.7395,
        y: 0.3604,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphUtils.ts',
        x: 0.7981,
        y: 0.4436,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/unpackSubgraph.ts',
        x: 0.8021,
        y: 0.4253,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/NodeLike.ts',
        x: 0.8586,
        y: 0.4094,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/contextMenu.ts',
        x: 0.8596,
        y: 0.4546,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/events.ts',
        x: 0.8273,
        y: 0.4521,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/linkNetwork.ts',
        x: 0.8324,
        y: 0.4109,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/panel.ts',
        x: 0.9044,
        y: 0.4744,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/serialisation.ts',
        x: 0.7595,
        y: 0.4395,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/slots.ts',
        x: 0.826,
        y: 0.4431,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/widgets.ts',
        x: 0.8251,
        y: 0.5496,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/arrange.ts',
        x: 0.8132,
        y: 0.3765,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/collections.ts',
        x: 0.8575,
        y: 0.3939,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/feedback.ts',
        x: 0.8219,
        y: 0.4891,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/linkColors.ts',
        x: 0.8767,
        y: 0.4204,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiff.ts',
        x: 0.7683,
        y: 0.4662,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiffTelemetry.ts',
        x: 0.6279,
        y: 0.4518,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/type.ts',
        x: 0.809,
        y: 0.4725,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/widget.ts',
        x: 0.841,
        y: 0.5442,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/AssetWidget.ts',
        x: 0.9312,
        y: 0.5174,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseSteppedWidget.ts',
        x: 0.963,
        y: 0.5003,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseWidget.ts',
        x: 0.8911,
        y: 0.5206,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BooleanWidget.ts',
        x: 0.9723,
        y: 0.5593,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxWidget.ts',
        x: 0.9868,
        y: 0.5167,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxesWidget.ts',
        x: 0.9835,
        y: 0.5034,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ButtonWidget.ts',
        x: 0.9307,
        y: 0.5086,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ChartWidget.ts',
        x: 1,
        y: 0.5406,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorWidget.ts',
        x: 0.9855,
        y: 0.5265,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorsWidget.ts',
        x: 0.9733,
        y: 0.5395,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ComboWidget.ts',
        x: 0.8719,
        y: 0.5025,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CompositorWidget.ts',
        x: 0.9995,
        y: 0.5506,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CurveWidget.ts',
        x: 0.9702,
        y: 0.5698,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/FileUploadWidget.ts',
        x: 0.9842,
        y: 0.5819,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GalleriaWidget.ts',
        x: 0.9948,
        y: 0.5756,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GradientSliderWidget.ts',
        x: 0.95,
        y: 0.5497,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCompareWidget.ts',
        x: 0.9924,
        y: 0.5571,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCropWidget.ts',
        x: 0.9742,
        y: 0.524,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/KnobWidget.ts',
        x: 0.9466,
        y: 0.5601,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LegacyWidget.ts',
        x: 0.8443,
        y: 0.5519,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LightInfoWidget.ts',
        x: 0.9768,
        y: 0.4966,
        states: [
          [0, -2],
          [30, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MarkdownWidget.ts',
        x: 0.9997,
        y: 0.5298,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MultiSelectWidget.ts',
        x: 0.9867,
        y: 0.5714,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/NumberWidget.ts',
        x: 0.9498,
        y: 0.5306,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/PainterWidget.ts',
        x: 0.9804,
        y: 0.512,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/RangeWidget.ts',
        x: 0.9719,
        y: 0.5123,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SelectButtonWidget.ts',
        x: 0.9981,
        y: 0.5632,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SliderWidget.ts',
        x: 0.946,
        y: 0.567,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextWidget.ts',
        x: 0.9297,
        y: 0.5279,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextareaWidget.ts',
        x: 0.9737,
        y: 0.5501,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TreeSelectWidget.ts',
        x: 0.9801,
        y: 0.5447,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VideoEditWidget.ts',
        x: 0.9789,
        y: 0.5319,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VueOnlyWidget.ts',
        x: 0.9416,
        y: 0.5434,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/widgetMap.ts',
        x: 0.9052,
        y: 0.5273,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/assets/components/AssetBrowserModal.vue',
        x: 0.3764,
        y: 0.7103,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/AssetCard.vue',
        x: 0.429,
        y: 0.724,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/AssetGrid.vue',
        x: 0.3441,
        y: 0.8051,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/Media3DTop.vue',
        x: 0.5069,
        y: 0.8995,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAssetCard.vue',
        x: 0.506,
        y: 0.8541,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAudioTop.vue',
        x: 0.4771,
        y: 0.9639,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaImageTop.vue',
        x: 0.4958,
        y: 0.9593,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaTextTop.vue',
        x: 0.5051,
        y: 0.9635,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaVideoTop.vue',
        x: 0.5145,
        y: 0.9586,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelConfirmation.vue',
        x: 0.2773,
        y: 0.8507,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelDialog.vue',
        x: 0.2596,
        y: 0.8093,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelProgress.vue',
        x: 0.2514,
        y: 0.866,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUpgradeModal.vue',
        x: 0.1671,
        y: 0.6717,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUrlInput.vue',
        x: 0.2523,
        y: 0.6955,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/modelInfo/ModelInfoPanel.vue',
        x: 0.3716,
        y: 0.7219,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/media/assetMappers.ts',
        x: 0.4999,
        y: 0.7862,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/composables/openModelLibraryBrowser.ts',
        x: 0.3812,
        y: 0.5715,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowser.ts',
        x: 0.386,
        y: 0.7194,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowserDialog.ts',
        x: 0.4359,
        y: 0.6196,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetDownload.ts',
        x: 0.4589,
        y: 0.6019,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetGridSelection.ts',
        x: 0.7477,
        y: 0.8413,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetSelection.ts',
        x: 0.56,
        y: 0.9403,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetZipExport.ts',
        x: 0.4686,
        y: 0.6343,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetsQuery.ts',
        x: 0.4404,
        y: 0.7657,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useMediaAssetActions.ts',
        x: 0.5291,
        y: 0.6481,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useModelTypes.ts',
        x: 0.3463,
        y: 0.7735,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useModelUpload.ts',
        x: 0.2842,
        y: 0.764,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useNodeOutputsExport.ts',
        x: 0.5373,
        y: 0.5889,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useOutputStacks.ts',
        x: 0.5453,
        y: 0.8938,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useUploadModelWizard.ts',
        x: 0.3645,
        y: 0.7407,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/schemas/assetMetadataSchema.ts',
        x: 0.5422,
        y: 0.7754,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/schemas/mediaAssetSchema.ts',
        x: 0.5195,
        y: 0.8167,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/services/assetService.ts',
        x: 0.5164,
        y: 0.6592,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/utils/assetDragUtil.ts',
        x: 0.4994,
        y: 0.8461,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/assetPreviewUtil.ts',
        x: 0.5135,
        y: 0.7492,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/assets/utils/assetUrlUtil.ts',
        x: 0.4771,
        y: 0.7407,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/assets/utils/clearDeletedAssetWidgetValues.ts',
        x: 0.6592,
        y: 0.6593,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/clearNodePreviewCacheForValues.ts',
        x: 0.6442,
        y: 0.6235,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/createAssetWidget.ts',
        x: 0.6139,
        y: 0.5658,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/assets/utils/markDeletedAssetsAsMissingMedia.ts',
        x: 0.6303,
        y: 0.6105,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/marqueeSelectionUtil.ts',
        x: 0.8633,
        y: 0.8568,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/mediaIconUtil.ts',
        x: 0.5284,
        y: 0.9657,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetCountUtil.ts',
        x: 0.5429,
        y: 0.8434,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetUtil.ts',
        x: 0.5312,
        y: 0.8079,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputExportUtil.ts',
        x: 0.514,
        y: 0.7039,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/resolveModelNodeFromAsset.ts',
        x: 0.3937,
        y: 0.6428,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'platform/auth/firebaseIdentity.ts',
        x: 0.2951,
        y: 0.4845,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/auth/session/cloudWebSessionStore.ts',
        x: 0.336,
        y: 0.5448,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/session/components/SignOutEverywhereButton.vue',
        x: 0.2305,
        y: 0.5535,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/auth/session/useSessionCookie.ts',
        x: 0.3618,
        y: 0.5637,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/social/useSocialSignIn.ts',
        x: 0.3352,
        y: 0.4125,
        states: [
          [0, 0],
          [92, 17],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/auth/sso/SsoRequiredDialogContent.vue',
        x: 0.2848,
        y: 0.3961,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/sso/ssoRequired.ts',
        x: 0.317,
        y: 0.4565,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/sso/ssoRequiredInline.ts',
        x: 0.1909,
        y: 0.3227,
        states: [
          [0, -2],
          [86, 0],
          [87, -2]
        ]
      },
      {
        path: 'platform/auth/sso/useContinueWithSso.ts',
        x: 0.2904,
        y: 0.3887,
        states: [
          [0, -2],
          [86, 0],
          [87, -2]
        ]
      },
      {
        path: 'platform/auth/unified/remintRetry.ts',
        x: 0.3466,
        y: 0.5307,
        states: [[0, 0]]
      },
      {
        path: 'platform/canvas/minimapDecorationRegistry.ts',
        x: 0.531,
        y: 0.3252,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/churnkey/churnkeyClient.ts',
        x: 0.3056,
        y: 0.5121,
        states: [
          [0, 0],
          [14, -2]
        ]
      },
      {
        path: 'platform/cloud/notification/components/CloudNotificationContent.vue',
        x: 0.2963,
        y: 0.4445,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CancellationFlowDialogContent.vue',
        x: 0.2697,
        y: 0.5317,
        states: [
          [0, -2],
          [14, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CreditsTile.vue',
        x: 0.2431,
        y: 0.4792,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/PricingTable.vue',
        x: 0.2725,
        y: 0.4654,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/RetentionOfferStep.vue',
        x: 0.2323,
        y: 0.5668,
        states: [
          [0, -2],
          [14, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscribeButton.vue',
        x: 0.2121,
        y: 0.5557,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionFooterLinks.vue',
        x: 0.1485,
        y: 0.4732,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue',
        x: 0.3017,
        y: 0.5541,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useAccountPreconditionDialog.ts',
        x: 0.3717,
        y: 0.5018,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useBillingPlans.ts',
        x: 0.2888,
        y: 0.4736,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useCancellationPlan.ts',
        x: 0.124,
        y: 0.5406,
        states: [
          [0, -2],
          [14, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useFreeTierQuota.ts',
        x: 0.3941,
        y: 0.4974,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useRetentionOffer.ts',
        x: 0.2539,
        y: 0.5359,
        states: [
          [0, -2],
          [14, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscription.ts',
        x: 0.2809,
        y: 0.4747,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionActions.ts',
        x: 0.2994,
        y: 0.5009,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts',
        x: 0.2028,
        y: 0.4309,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCredits.ts',
        x: 0.1156,
        y: 0.4349,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionDialog.ts',
        x: 0.2429,
        y: 0.5125,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/constants/tierPricing.ts',
        x: 0.1814,
        y: 0.4744,
        states: [
          [0, 0],
          [4, 10],
          [95, -1],
          [97, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/launchCancellationFlow.ts',
        x: 0.2874,
        y: 0.5076,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/billingPlanTelemetry.ts',
        x: 0.1215,
        y: 0.4776,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/checkoutAttributionLoader.ts',
        x: 0.1448,
        y: 0.3466,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/paymentReturnUrl.ts',
        x: 0.1603,
        y: 0.3995,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/planCreditGrant.ts',
        x: 0.0388,
        y: 0.5187,
        states: [
          [0, -2],
          [14, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCancellationTelemetry.ts',
        x: 0.202,
        y: 0.4844,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutTracker.ts',
        x: 0.2207,
        y: 0.4271,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutUtil.ts',
        x: 0.2746,
        y: 0.4467,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionTierRank.ts',
        x: 0.2138,
        y: 0.4645,
        states: [
          [0, 0],
          [4, 10],
          [95, -1],
          [97, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/tierBenefits.ts',
        x: 0.0568,
        y: 0.4458,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/errorCatalog/errorMessageResolver.ts',
        x: 0.4041,
        y: 0.8324,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/executionErrorResolver.ts',
        x: 0.3664,
        y: 0.8951,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/missingErrorResolver.ts',
        x: 0.4923,
        y: 0.8549,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/promptErrorResolver.ts',
        x: 0.3744,
        y: 0.9015,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/runtimeErrorCopy.ts',
        x: 0.3683,
        y: 0.9184,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/types.ts',
        x: 0.4496,
        y: 0.756,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/validationErrorResolver.ts',
        x: 0.3846,
        y: 0.9059,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/keybindings/keybindingService.ts',
        x: 0.4259,
        y: 0.6658,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/keybindings/presetService.ts',
        x: 0.4142,
        y: 0.6735,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaAssetResolver.ts',
        x: 0.5072,
        y: 0.6213,
        states: [
          [0, 0],
          [10, -2]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaGrouping.ts',
        x: 0.5633,
        y: 0.8396,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaPipeline.ts',
        x: 0.5596,
        y: 0.5627,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaScan.ts',
        x: 0.6168,
        y: 0.5552,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaStore.ts',
        x: 0.6062,
        y: 0.597,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingMedia/types.ts',
        x: 0.5724,
        y: 0.6566,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingModel/folderPathCache.ts',
        x: 0.4129,
        y: 0.4727,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/missingModel/missingModelDownload.ts',
        x: 0.4081,
        y: 0.3827,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelGrouping.ts',
        x: 0.577,
        y: 0.7304,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelMetadata.ts',
        x: 0.4727,
        y: 0.3764,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelPipeline.ts',
        x: 0.5437,
        y: 0.5452,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelScan.ts',
        x: 0.6485,
        y: 0.5447,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelStore.ts',
        x: 0.5785,
        y: 0.5409,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/missingModel/types.ts',
        x: 0.5689,
        y: 0.6311,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/nodeReplacement/cnrIdUtil.ts',
        x: 0.6396,
        y: 0.4706,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodeScan.ts',
        x: 0.5976,
        y: 0.5391,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodesErrorStore.ts',
        x: 0.5951,
        y: 0.553,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementService.ts',
        x: 0.419,
        y: 0.7221,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementStore.ts',
        x: 0.4826,
        y: 0.6144,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/onboarding/coachmarkRegistry.ts',
        x: 0.5342,
        y: 0.3383,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingReplay.ts',
        x: 0.3535,
        y: 0.4213,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTourStore.ts',
        x: 0.4404,
        y: 0.4431,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTours.ts',
        x: 0.4519,
        y: 0.3796,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/tourState.ts',
        x: 0.3945,
        y: 0.2959,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/useTourTriggers.ts',
        x: 0.5178,
        y: 0.408,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/remote/comfyui/execution/types.ts',
        x: 0.5738,
        y: 0.6616,
        states: [
          [0, 0],
          [89, 15],
          [91, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/fetchJobs.ts',
        x: 0.5238,
        y: 0.683,
        states: [
          [0, 0],
          [89, 15],
          [91, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/jobTypes.ts',
        x: 0.5107,
        y: 0.7289,
        states: [
          [0, 0],
          [89, 15],
          [91, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/refreshRemoteConfig.ts',
        x: 0.3547,
        y: 0.5503,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/remoteConfig.ts',
        x: 0.3003,
        y: 0.4562,
        states: [
          [0, 0],
          [4, 10],
          [95, -1],
          [97, 10]
        ]
      },
      {
        path: 'platform/remoteConfig/types.ts',
        x: 0.235,
        y: 0.3805,
        states: [
          [0, 0],
          [4, 10],
          [95, -1],
          [97, 10]
        ]
      },
      {
        path: 'platform/secrets/api/secretsApi.ts',
        x: 0.2753,
        y: 0.815,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/components/SecretFormDialog.vue',
        x: 0.0627,
        y: 0.9127,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/components/SecretsPanel.vue',
        x: 0.1563,
        y: 0.8011,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecretForm.ts',
        x: 0.137,
        y: 0.9206,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecrets.ts',
        x: 0.1477,
        y: 0.8898,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ColorPaletteMessage.vue',
        x: 0.4148,
        y: 0.5945,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ExtensionPanel.vue',
        x: 0.4188,
        y: 0.6572,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ServerConfigPanel.vue',
        x: 0.3654,
        y: 0.7127,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingDialog.vue',
        x: 0.3035,
        y: 0.5998,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingGroup.vue',
        x: 0.1939,
        y: 0.8265,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingItem.vue',
        x: 0.3393,
        y: 0.7513,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingsPanel.vue',
        x: 0.1728,
        y: 0.7365,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingsWorkspaceHeader.vue',
        x: 0.1378,
        y: 0.6023,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingSearch.ts',
        x: 0.4021,
        y: 0.589,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingUI.ts',
        x: 0.3182,
        y: 0.6236,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingsDialog.ts',
        x: 0.3166,
        y: 0.597,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/settings/globalSettingsApi.ts',
        x: 0.3401,
        y: 0.5524,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/settings/missingWarningVisibility.ts',
        x: 0.5573,
        y: 0.6169,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/settings/settingStore.ts',
        x: 0.5244,
        y: 0.5779,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/skills/api/skillsApi.ts',
        x: 0.3285,
        y: 0.6744,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/components/SkillPackFormDialog.vue',
        x: 0.1228,
        y: 0.7108,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/components/SkillPacksPanel.vue',
        x: 0.1865,
        y: 0.6903,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPackForm.ts',
        x: 0.2679,
        y: 0.6354,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPacks.ts',
        x: 0.2914,
        y: 0.6272,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/stores/skillPacksStore.ts',
        x: 0.3187,
        y: 0.6121,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/support/feedbackDialog.ts',
        x: 0.3889,
        y: 0.4535,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/tasks/services/taskService.ts',
        x: 0.4817,
        y: 0.7307,
        states: [
          [0, 0],
          [89, 15],
          [91, 0]
        ]
      },
      {
        path: 'platform/telemetry/hostTelemetryEnabled.ts',
        x: 0.34,
        y: 0.3752,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/imageFailureDiagnostics.ts',
        x: 0.406,
        y: 0.4195,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/index.ts',
        x: 0.3758,
        y: 0.515,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/installNodeAddedTelemetry.ts',
        x: 0.5496,
        y: 0.5121,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/nodeAddSource.ts',
        x: 0.4901,
        y: 0.5085,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/perf/bootstrapTracer.ts',
        x: 0.4614,
        y: 0.535,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/reportError.ts',
        x: 0.4508,
        y: 0.4976,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/searchQuery/useSearchQueryTracking.ts',
        x: 0.3659,
        y: 0.4655,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/types.ts',
        x: 0.3484,
        y: 0.4941,
        states: [
          [0, 0],
          [4, 10],
          [95, -1],
          [97, 10]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingFailureCategory.ts',
        x: 0.2491,
        y: 0.4683,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingPortalTelemetry.ts',
        x: 0.2349,
        y: 0.4351,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/checkoutAttribution.ts',
        x: 0.2169,
        y: 0.3981,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getActionbarDockState.ts',
        x: 0.319,
        y: 0.3984,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getExecutionContext.ts',
        x: 0.5111,
        y: 0.5046,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/groupMissingNodesByPack.ts',
        x: 0.4687,
        y: 0.5543,
        states: [
          [0, 0],
          [13, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/paymentIntentSource.ts',
        x: 0.2288,
        y: 0.4288,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/workflowExecutionContext.ts',
        x: 0.4629,
        y: 0.4843,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowActionsService.ts',
        x: 0.4912,
        y: 0.5947,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowService.ts',
        x: 0.5274,
        y: 0.5203,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/modelRequirements.ts',
        x: 0.5056,
        y: 0.3679,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/pendingWarnings.ts',
        x: 0.5411,
        y: 0.5751,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
        x: 0.6838,
        y: 0.5063,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowId.ts',
        x: 0.5294,
        y: 0.4679,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowToClipboardItems.ts',
        x: 0.6331,
        y: 0.3764,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useAppsSidebarTab.ts',
        x: 0.3634,
        y: 0.6271,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useWorkflowsSidebarTab.ts',
        x: 0.4439,
        y: 0.5055,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/stores/comfyWorkflow.ts',
        x: 0.4998,
        y: 0.578,
        states: [[0, 0]]
      },
      {
        path: 'platform/workflow/management/stores/workflowStore.ts',
        x: 0.5494,
        y: 0.5367,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/management/stores/workflowStoreTypes.ts',
        x: 0.3939,
        y: 0.6697,
        states: [
          [0, -2],
          [93, 0],
          [97, -2]
        ]
      },
      {
        path: 'platform/workflow/persistence/stores/workflowDraftStoreV2.ts',
        x: 0.5219,
        y: 0.542,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue',
        x: 0.4266,
        y: 0.3876,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue',
        x: 0.3233,
        y: 0.3783,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
        x: 0.2805,
        y: 0.2942,
        states: [
          [0, 0],
          [89, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubExamplesStep.vue',
        x: 0.2252,
        y: 0.2572,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubFinishStep.vue',
        x: 0.3781,
        y: 0.342,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue',
        x: 0.4152,
        y: 0.4372,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue',
        x: 0.3639,
        y: 0.293,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue',
        x: 0.3183,
        y: 0.3666,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubThumbnailStep.vue',
        x: 0.2357,
        y: 0.2501,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubProfileGate.ts',
        x: 0.3489,
        y: 0.4006,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishSubmission.ts',
        x: 0.428,
        y: 0.4283,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishWizard.ts',
        x: 0.4226,
        y: 0.3794,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useSharedWorkflowUrlLoader.ts',
        x: 0.4423,
        y: 0.4827,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/comfyHubService.ts',
        x: 0.373,
        y: 0.4312,
        states: [
          [0, 0],
          [89, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/workflowShareService.ts',
        x: 0.4761,
        y: 0.4973,
        states: [
          [0, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/types/shareTypes.ts',
        x: 0.4826,
        y: 0.4374,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/utils/validateFileSize.ts',
        x: 0.2893,
        y: 0.3407,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
        x: 0.4628,
        y: 0.4635,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
        x: 0.3593,
        y: 0.2483,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateWorkflows.ts',
        x: 0.4879,
        y: 0.5391,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
        x: 0.4384,
        y: 0.4891,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/services/templateInputService.ts',
        x: 0.6278,
        y: 0.5872,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
        x: 0.4322,
        y: 0.5541,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/types/templateDetail.ts',
        x: 0.3156,
        y: 0.1293,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelAvailability.ts',
        x: 0.4912,
        y: 0.4163,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelDownloadState.ts',
        x: 0.3786,
        y: 0.1469,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelMetadata.ts',
        x: 0.4767,
        y: 0.4086,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelRequirements.ts',
        x: 0.5007,
        y: 0.4023,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelSetup.ts',
        x: 0.4841,
        y: 0.3993,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/utils/workflowExtractionUtil.ts',
        x: 0.5575,
        y: 0.731,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/validation/composables/useWorkflowValidation.ts',
        x: 0.6088,
        y: 0.469,
        states: [
          [0, 0],
          [4, -1],
          [71, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workflow/validation/schemas/workflowSchema.ts',
        x: 0.5872,
        y: 0.564,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/api/partnerNodePolicyApi.ts',
        x: 0.3368,
        y: 0.6951,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApi.ts',
        x: 0.2021,
        y: 0.5108,
        states: [
          [0, 0],
          [90, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApiUrl.ts',
        x: 0.2973,
        y: 0.5662,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/customerAttention.ts',
        x: 0.1669,
        y: 0.5273,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/hostedBillingRoutes.ts',
        x: 0.1692,
        y: 0.3895,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/openHostedBillingTab.ts',
        x: 0.264,
        y: 0.4795,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingCapabilitiesView.ts',
        x: 0.0762,
        y: 0.518,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingPlansView.ts',
        x: 0.0773,
        y: 0.5296,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingSdkStore.ts',
        x: 0.221,
        y: 0.533,
        states: [
          [0, 0],
          [92, 17],
          [96, 19],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingStatusView.ts',
        x: 0.0793,
        y: 0.541,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/operationRecordView.ts',
        x: 0.0958,
        y: 0.5296,
        states: [
          [0, 0],
          [90, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/subscriptionOperationView.ts',
        x: 0.1674,
        y: 0.5079,
        states: [
          [0, 0],
          [90, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/topupOperationView.ts',
        x: 0.1443,
        y: 0.5325,
        states: [
          [0, 0],
          [90, -1],
          [91, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/webSessionBillingSession.ts',
        x: 0.2045,
        y: 0.5836,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/stripePublishableKey.ts',
        x: 0.1734,
        y: 0.4506,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/subscribeInput.ts',
        x: 0.112,
        y: 0.4637,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/InviteMembersForm.vue',
        x: 0.2719,
        y: 0.48,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/PricingTableWorkspace.vue',
        x: 0.23,
        y: 0.5363,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue',
        x: 0.1391,
        y: 0.4471,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
        x: 0.1828,
        y: 0.4894,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue',
        x: 0.1864,
        y: 0.4605,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue',
        x: 0.1901,
        y: 0.4717,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionSuccessWorkspace.vue',
        x: 0.1464,
        y: 0.4527,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionTransitionPreviewWorkspace.vue',
        x: 0.1202,
        y: 0.4556,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue',
        x: 0.2998,
        y: 0.5235,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/UnifiedPricingTable.vue',
        x: 0.1516,
        y: 0.4888,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/WorkspaceProfilePic.vue',
        x: 0.0888,
        y: 0.5765,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/ChangeMemberRoleDialogContent.vue',
        x: 0.2694,
        y: 0.5477,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/CreateWorkspaceDialogContent.vue',
        x: 0.284,
        y: 0.5761,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue',
        x: 0.2897,
        y: 0.5504,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
        x: 0.2994,
        y: 0.5847,
        states: [
          [0, -1],
          [71, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue',
        x: 0.2838,
        y: 0.5645,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteLinkList.vue',
        x: 0.1122,
        y: 0.3651,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberDialogContent.vue',
        x: 0.2065,
        y: 0.4632,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberUpsellDialogContent.vue',
        x: 0.198,
        y: 0.564,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteWrongAccountDialogContent.vue',
        x: 0.2569,
        y: 0.4807,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue',
        x: 0.2772,
        y: 0.5692,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RemoveMemberDialogContent.vue',
        x: 0.2756,
        y: 0.5573,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RevokeInviteDialogContent.vue',
        x: 0.2807,
        y: 0.5464,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue',
        x: 0.2149,
        y: 0.5898,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/TeamWorkspacesDialogContent.vue',
        x: 0.2165,
        y: 0.5659,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
        x: 0.1805,
        y: 0.5256,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MemberListItem.vue',
        x: 0.0885,
        y: 0.4913,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
        x: 0.0984,
        y: 0.5007,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue',
        x: 0.3241,
        y: 0.5145,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PendingInvitesList.vue',
        x: 0.1349,
        y: 0.4318,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue',
        x: 0.136,
        y: 0.5254,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue',
        x: 0.0643,
        y: 0.4983,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue',
        x: 0.1283,
        y: 0.5537,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue',
        x: 0.1853,
        y: 0.5486,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceSettingsPanelContent.vue',
        x: 0.1833,
        y: 0.5802,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/subscriptionPanelWorkspace.logic.ts',
        x: 0.0952,
        y: 0.4746,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/readOnRail.ts',
        x: 0.2106,
        y: 0.4541,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingBanner.ts',
        x: 0.1861,
        y: 0.5374,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingCapabilities.ts',
        x: 0.2622,
        y: 0.5054,
        states: [
          [0, 0],
          [92, 17],
          [96, 19],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingReadRail.ts',
        x: 0.2381,
        y: 0.5023,
        states: [
          [0, 0],
          [92, 17],
          [96, 19],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useCheckoutCopy.ts',
        x: 0.0649,
        y: 0.4236,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useDowngradeToPersonal.ts',
        x: 0.2563,
        y: 0.5018,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useHasSavedPaymentMethod.ts',
        x: 0.2777,
        y: 0.4578,
        states: [
          [0, 0],
          [15, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useMembersPanel.ts',
        x: 0.222,
        y: 0.5254,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/usePlanEnded.ts',
        x: 0.1238,
        y: 0.5133,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useResubscribe.ts',
        x: 0.2072,
        y: 0.4939,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useScheduledPlanChange.ts',
        x: 0.1088,
        y: 0.4834,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionCheckout.ts',
        x: 0.2773,
        y: 0.4985,
        states: [
          [0, 0],
          [92, 17],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionRail.ts',
        x: 0.2159,
        y: 0.5258,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useTeamPlan.ts',
        x: 0.0978,
        y: 0.5157,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useTopupOperation.ts',
        x: 0.2462,
        y: 0.5401,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceBilling.ts',
        x: 0.2684,
        y: 0.4987,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceDialogs.ts',
        x: 0.2172,
        y: 0.5484,
        states: [
          [0, -2],
          [91, 0],
          [92, 17],
          [97, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceMenuItems.ts',
        x: 0.1868,
        y: 0.5105,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspacePlanPricing.ts',
        x: 0.0967,
        y: 0.4553,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceSwitch.ts',
        x: 0.1262,
        y: 0.5778,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceTierLabel.ts',
        x: 0.098,
        y: 0.5547,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceUI.ts',
        x: 0.22,
        y: 0.5378,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/billingOperationStore.ts',
        x: 0.2785,
        y: 0.5122,
        states: [
          [0, 0],
          [92, 17],
          [96, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/legacyWorkspaceTokenRail.ts',
        x: 0.239,
        y: 0.6076,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/partnerNodeGovernanceStore.ts',
        x: 0.2706,
        y: 0.6166,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/stores/teamWorkspaceStore.ts',
        x: 0.2802,
        y: 0.5234,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/workspaceAuthStore.ts',
        x: 0.3134,
        y: 0.5346,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/utils/checkoutJourney.ts',
        x: 0.2408,
        y: 0.4889,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/checkoutJourneyTelemetry.ts',
        x: 0.2231,
        y: 0.47,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/inviteLinks.ts',
        x: 0.2339,
        y: 0.4032,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/pendingSubscriptionCheckout.ts',
        x: 0.1563,
        y: 0.4652,
        states: [
          [0, 0],
          [90, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/platformLink.ts',
        x: 0.179,
        y: 0.4334,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/workspaceCheckoutTelemetry.ts',
        x: 0.279,
        y: 0.4394,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/cameraState.ts',
        x: 0.6588,
        y: 0.3898,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/canvasStore.ts',
        x: 0.6447,
        y: 0.4886,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasInteractionMode.ts',
        x: 0.6552,
        y: 0.4422,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasPointerEvent.ts',
        x: 0.734,
        y: 0.3773,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkConnectorAdapter.ts',
        x: 0.7519,
        y: 0.4281,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkDropOrchestrator.ts',
        x: 0.7798,
        y: 0.3364,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/arrangeForLegacyRender.ts',
        x: 0.7819,
        y: 0.3632,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/litegraphLinkAdapter.ts',
        x: 0.7887,
        y: 0.3783,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/selectionAdapter.ts',
        x: 0.7783,
        y: 0.4048,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/slotCalculations.ts',
        x: 0.7876,
        y: 0.406,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useAutoPan.ts',
        x: 0.797,
        y: 0.3219,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasInteractions.ts',
        x: 0.575,
        y: 0.482,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasScheduler.ts',
        x: 0.5521,
        y: 0.4667,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/core/layout/operations/graphLayoutAttachment.ts',
        x: 0.8227,
        y: 0.3877,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/operations/layoutMutations.ts',
        x: 0.7231,
        y: 0.3846,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/slots/syncSlotOffsets.ts',
        x: 0.7557,
        y: 0.387,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/layout/store/layoutStore.ts',
        x: 0.7243,
        y: 0.4043,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/transform/graphRenderTransform.ts',
        x: 0.8533,
        y: 0.3358,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/transform/useTransformState.ts',
        x: 0.7321,
        y: 0.5454,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/utils/nodeSizeUtil.ts',
        x: 0.7597,
        y: 0.3382,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/spatial/boundsCalculator.ts',
        x: 0.6752,
        y: 0.2706,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/thumbnail/graphThumbnailRenderer.ts',
        x: 0.6149,
        y: 0.3694,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/core/thumbnail/useWorkflowThumbnail.ts',
        x: 0.5488,
        y: 0.4064,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/compositor/components/WidgetCompositor.vue',
        x: 0.7566,
        y: 0.6522,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSave.ts',
        x: 0.8625,
        y: 0.6167,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSession.ts',
        x: 0.711,
        y: 0.6182,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorWidgets.ts',
        x: 0.8166,
        y: 0.6211,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorAutoSave.ts',
        x: 0.8861,
        y: 0.611,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorEditor.ts',
        x: 0.8437,
        y: 0.6486,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorLayers.ts',
        x: 0.774,
        y: 0.6027,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorPsdDownload.ts',
        x: 0.8386,
        y: 0.6315,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/gettingStarted/firstRunEntry.ts',
        x: 0.3966,
        y: 0.5068,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/heuristicRoles.ts',
        x: 0.7337,
        y: 0.4223,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/resolveTourRoles.ts',
        x: 0.6951,
        y: 0.4085,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/tourSequence.ts',
        x: 0.6562,
        y: 0.2712,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/cameraFraming.ts',
        x: 0.6941,
        y: 0.3617,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/canvasCoachTarget.ts',
        x: 0.6605,
        y: 0.4058,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/firstRunTourDefinition.ts',
        x: 0.5868,
        y: 0.3879,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/useFirstRunTourController.ts',
        x: 0.474,
        y: 0.5027,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/components/LayerEditorContent.vue',
        x: 0.7525,
        y: 0.6061,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/layerEditorDialog.ts',
        x: 0.7597,
        y: 0.6891,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/useLayerEditor.ts',
        x: 0.7719,
        y: 0.6606,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/linearMode/AppInput.vue',
        x: 0.6064,
        y: 0.4763,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/data/MinimapDataSource.ts',
        x: 0.649,
        y: 0.4048,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/minimapCanvasRenderer.ts',
        x: 0.692,
        y: 0.3378,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/types.ts',
        x: 0.6579,
        y: 0.3333,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/InputSlot.vue',
        x: 0.7095,
        y: 0.3961,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
        x: 0.7328,
        y: 0.4747,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeBadge.vue',
        x: 0.8529,
        y: 0.2526,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeHeader.vue',
        x: 0.7535,
        y: 0.3544,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeSlots.vue',
        x: 0.693,
        y: 0.4387,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/OutputSlot.vue',
        x: 0.7127,
        y: 0.3613,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/SlotConnectionDot.vue',
        x: 0.7478,
        y: 0.3276,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/WidgetGrid.vue',
        x: 0.752,
        y: 0.4864,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeTooltips.ts',
        x: 0.6296,
        y: 0.3975,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeZIndex.ts',
        x: 0.6796,
        y: 0.3803,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkInteraction.ts',
        x: 0.7327,
        y: 0.4344,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkReveal.ts',
        x: 0.6824,
        y: 0.3915,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useVueNodeResizeTracking.ts',
        x: 0.7279,
        y: 0.3975,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts',
        x: 0.7674,
        y: 0.4355,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/types/widgetGrid.ts',
        x: 0.8348,
        y: 0.5409,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/eventUtils.ts',
        x: 0.8665,
        y: 0.4515,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/linkedCoreMediaUtils.ts',
        x: 0.6947,
        y: 0.6637,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/nodeDataUtils.ts',
        x: 0.7112,
        y: 0.411,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlButton.vue',
        x: 0.9207,
        y: 0.782,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlPopover.vue',
        x: 0.7143,
        y: 0.7096,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetButton.vue',
        x: 0.9345,
        y: 0.7262,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.types.ts',
        x: 0.9925,
        y: 0.6346,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.vue',
        x: 0.9512,
        y: 0.6947,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue',
        x: 0.9005,
        y: 0.6705,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetDynamicGroupRow.vue',
        x: 0.938,
        y: 0.7168,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
        x: 0.7385,
        y: 0.6412,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue',
        x: 0.916,
        y: 0.7102,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberGradientSlider.vue',
        x: 0.9041,
        y: 0.5993,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue',
        x: 0.9224,
        y: 0.674,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberSlider.vue',
        x: 0.9318,
        y: 0.7567,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue',
        x: 0.9064,
        y: 0.7401,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue',
        x: 0.8151,
        y: 0.5228,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.vue',
        x: 0.9216,
        y: 0.7384,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetRecordAudio.vue',
        x: 0.7531,
        y: 0.6666,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetResolutionPreview.vue',
        x: 0.8108,
        y: 0.5989,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue',
        x: 0.7293,
        y: 0.7285,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue',
        x: 0.7272,
        y: 0.6822,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue',
        x: 0.675,
        y: 0.7548,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue',
        x: 0.6721,
        y: 0.6092,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue',
        x: 0.8167,
        y: 0.6836,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue',
        x: 0.9068,
        y: 0.6654,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue',
        x: 0.8435,
        y: 0.7613,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue',
        x: 0.6128,
        y: 0.88,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.vue',
        x: 0.4698,
        y: 0.9948,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuFilter.vue',
        x: 0.3254,
        y: 0.9484,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuItem.vue',
        x: 0.4862,
        y: 0.9361,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue',
        x: 0.8536,
        y: 0.7174,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/audio/useAudioRecorder.ts',
        x: 0.7421,
        y: 0.8136,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData.ts',
        x: 0.5515,
        y: 0.7606,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBooleanWidget.ts',
        x: 0.8493,
        y: 0.5894,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget.ts',
        x: 0.8648,
        y: 0.5286,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesSources.ts',
        x: 0.717,
        y: 0.6298,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget.ts',
        x: 0.858,
        y: 0.5403,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useChartWidget.ts',
        x: 0.8542,
        y: 0.5307,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorWidget.ts',
        x: 0.8561,
        y: 0.5636,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorsWidget.ts',
        x: 0.8653,
        y: 0.5554,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts',
        x: 0.6708,
        y: 0.6214,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCompositorWidget.ts',
        x: 0.8699,
        y: 0.5381,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCurveWidget.ts',
        x: 0.8669,
        y: 0.5752,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useDismissOnCanvasGesture.ts',
        x: 0.6827,
        y: 0.6947,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useFloatWidget.ts',
        x: 0.7177,
        y: 0.582,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget.ts',
        x: 0.8597,
        y: 0.5848,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
        x: 0.7102,
        y: 0.632,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts',
        x: 0.8589,
        y: 0.5759,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget.ts',
        x: 0.7036,
        y: 0.5447,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget.ts',
        x: 0.6285,
        y: 0.5667,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useIntWidget.ts',
        x: 0.7067,
        y: 0.5849,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget.ts',
        x: 0.94,
        y: 0.6259,
        states: [
          [0, -2],
          [30, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget.ts',
        x: 0.7325,
        y: 0.5764,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts',
        x: 0.8677,
        y: 0.5471,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget.ts',
        x: 0.7153,
        y: 0.5988,
        states: [
          [0, 0],
          [88, -1],
          [89, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRangeWidget.ts',
        x: 0.8579,
        y: 0.5524,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts',
        x: 0.5626,
        y: 0.5463,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useResolutionPreviewWidget.ts',
        x: 0.8679,
        y: 0.5658,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useStringWidget.ts',
        x: 0.7444,
        y: 0.5563,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useTextareaWidget.ts',
        x: 0.8743,
        y: 0.5589,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget.ts',
        x: 0.8493,
        y: 0.574,
        states: [
          [0, 0],
          [87, -1],
          [88, 0],
          [91, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions.ts',
        x: 0.5822,
        y: 0.6541,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems.ts',
        x: 0.5997,
        y: 0.7803,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts',
        x: 0.8321,
        y: 0.6555,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/audioUtils.ts',
        x: 0.6504,
        y: 0.6975,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas.ts',
        x: 0.6843,
        y: 0.6405,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/multilineTextarea.ts',
        x: 0.682,
        y: 0.5689,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget.ts',
        x: 0.8851,
        y: 0.5112,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/savedImageUrls.ts',
        x: 0.6248,
        y: 0.6693,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/utils/nodeTypeGuards.ts',
        x: 0.8338,
        y: 0.5859,
        states: [
          [0, 0],
          [66, 14],
          [95, -2],
          [97, 14]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecTree.ts',
        x: 0.6101,
        y: 0.3938,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecUtil.ts',
        x: 0.5888,
        y: 0.2716,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/searchableSlotTypes.ts',
        x: 0.6206,
        y: 0.3044,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/api.ts',
        x: 0.4957,
        y: 0.6274,
        states: [
          [0, 0],
          [89, 15],
          [91, 0]
        ]
      },
      {
        path: 'scripts/app.ts',
        x: 0.6007,
        y: 0.5662,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'scripts/appInstance.ts',
        x: 0.6124,
        y: 0.5776,
        states: [
          [0, -2],
          [92, 0],
          [97, -2]
        ]
      },
      {
        path: 'scripts/appRegistry.ts',
        x: 0.6002,
        y: 0.7032,
        states: [
          [0, -2],
          [92, 0],
          [97, -2]
        ]
      },
      {
        path: 'scripts/changeTracker.ts',
        x: 0.6103,
        y: 0.5898,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'scripts/clipspace.ts',
        x: 0.6224,
        y: 0.645,
        states: [
          [0, -2],
          [92, 0],
          [93, 18],
          [97, -2]
        ]
      },
      {
        path: 'scripts/defaultGraph.ts',
        x: 0.5322,
        y: 0.5642,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/domWidget.ts',
        x: 0.735,
        y: 0.5966,
        states: [
          [0, 0],
          [28, 12],
          [95, -1],
          [97, 12]
        ]
      },
      {
        path: 'scripts/errorNodeWidgets.ts',
        x: 0.8084,
        y: 0.5706,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'scripts/metadata/avif.ts',
        x: 0.6478,
        y: 0.7165,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ebml.ts',
        x: 0.6105,
        y: 0.7496,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/gltf.ts',
        x: 0.6325,
        y: 0.7386,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/isobmff.ts',
        x: 0.6193,
        y: 0.7412,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/mp3.ts',
        x: 0.6141,
        y: 0.7307,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ogg.ts',
        x: 0.6022,
        y: 0.7387,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/parser.ts',
        x: 0.6385,
        y: 0.7473,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'scripts/metadata/svg.ts',
        x: 0.6685,
        y: 0.8827,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/pnginfo.ts',
        x: 0.6661,
        y: 0.6187,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'scripts/promotedWidgetControl.ts',
        x: 0.701,
        y: 0.5549,
        states: [
          [0, 0],
          [87, -2],
          [88, 0],
          [89, -1],
          [91, -2],
          [97, 0]
        ]
      },
      { path: 'scripts/ui.ts', x: 0.5083, y: 0.6431, states: [[0, 0]] },
      {
        path: 'scripts/ui/components/asyncDialog.ts',
        x: 0.4822,
        y: 0.791,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      {
        path: 'scripts/ui/components/button.ts',
        x: 0.5424,
        y: 0.699,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/buttonGroup.ts',
        x: 0.5191,
        y: 0.7677,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/popup.ts',
        x: 0.5257,
        y: 0.7622,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/splitButton.ts',
        x: 0.5331,
        y: 0.7664,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/dialog.ts',
        x: 0.4597,
        y: 0.7636,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      {
        path: 'scripts/ui/imagePreview.ts',
        x: 0.6569,
        y: 0.5938,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'scripts/ui/menu/index.ts',
        x: 0.5413,
        y: 0.7128,
        states: [[0, 0]]
      },
      { path: 'scripts/ui/settings.ts', x: 0.498, y: 0.6448, states: [[0, 0]] },
      {
        path: 'scripts/ui/toggleSwitch.ts',
        x: 0.444,
        y: 0.8087,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      { path: 'scripts/utils.ts', x: 0.5559, y: 0.6824, states: [[0, 0]] },
      {
        path: 'scripts/valueControl.ts',
        x: 0.8112,
        y: 0.5807,
        states: [
          [0, 0],
          [4, -1],
          [87, -2],
          [88, -1],
          [91, -2],
          [97, -1]
        ]
      },
      {
        path: 'scripts/widgets.ts',
        x: 0.7649,
        y: 0.564,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'services/audioService.ts',
        x: 0.6261,
        y: 0.749,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'services/colorPaletteService.ts',
        x: 0.5336,
        y: 0.5434,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'services/customerEventsService.ts',
        x: 0.3585,
        y: 0.4787,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'services/dialogService.ts',
        x: 0.364,
        y: 0.5467,
        states: [[0, 0]]
      },
      {
        path: 'services/dialogServiceTypes.ts',
        x: 0.2745,
        y: 0.5844,
        states: [
          [0, -2],
          [93, 0],
          [97, -2]
        ]
      },
      {
        path: 'services/extensionService.ts',
        x: 0.5742,
        y: 0.5651,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'services/jobOutputCache.ts',
        x: 0.5255,
        y: 0.731,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'services/litegraphService.ts',
        x: 0.6251,
        y: 0.5245,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'services/load3dService.ts',
        x: 0.7273,
        y: 0.6602,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'services/nodeHelpService.ts',
        x: 0.4937,
        y: 0.3992,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeOrganizationService.ts',
        x: 0.4434,
        y: 0.3679,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeSearchService.ts',
        x: 0.5364,
        y: 0.2378,
        states: [
          [0, 0],
          [89, 16],
          [91, 0],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'services/subgraphPseudoWidgetCache.ts',
        x: 0.6926,
        y: 0.4513,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'services/subgraphService.ts',
        x: 0.6393,
        y: 0.4487,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'services/uploadTempFile.ts',
        x: 0.4777,
        y: 0.6643,
        states: [
          [0, -2],
          [71, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'services/useNewUserService.ts',
        x: 0.422,
        y: 0.4788,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'stores/aboutPanelStore.ts',
        x: 0.4352,
        y: 0.6882,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'stores/apiKeyAuthStore.ts',
        x: 0.4188,
        y: 0.4935,
        states: [[0, 0]]
      },
      {
        path: 'stores/appModeStore.ts',
        x: 0.6131,
        y: 0.5168,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/assetDownloadStore.ts',
        x: 0.4383,
        y: 0.6745,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/assetExportStore.ts',
        x: 0.4883,
        y: 0.712,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/assetsStore.ts',
        x: 0.5094,
        y: 0.6831,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      { path: 'stores/authStore.ts', x: 0.3446, y: 0.4865, states: [[0, 0]] },
      {
        path: 'stores/clearNodeOwnedStoreState.ts',
        x: 0.8608,
        y: 0.4805,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/commandStore.ts',
        x: 0.4086,
        y: 0.6018,
        states: [[0, 0]]
      },
      {
        path: 'stores/domWidgetStore.ts',
        x: 0.6378,
        y: 0.5495,
        states: [
          [0, 0],
          [28, 12],
          [95, -1],
          [97, 12]
        ]
      },
      {
        path: 'stores/electronDownloadStore.ts',
        x: 0.3479,
        y: 0.3358,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/entityIdStore.ts',
        x: 0.8824,
        y: 0.2907,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/executionErrorStore.ts',
        x: 0.5724,
        y: 0.5586,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/executionStore.ts',
        x: 0.5323,
        y: 0.6068,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/extensionStore.ts',
        x: 0.5342,
        y: 0.6579,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/graphMetadataStore.ts',
        x: 0.8917,
        y: 0.2714,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/jobPreviewStore.ts',
        x: 0.5313,
        y: 0.6754,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/linkPresentationStore.ts',
        x: 0.742,
        y: 0.3961,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/linkStore.ts',
        x: 0.7482,
        y: 0.4023,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'stores/maskEditorDataStore.ts',
        x: 0.7875,
        y: 0.702,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/menuItemStore.ts',
        x: 0.5132,
        y: 0.5578,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/modelStore.ts',
        x: 0.4141,
        y: 0.5811,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'stores/modelToNodeStore.ts',
        x: 0.4578,
        y: 0.6222,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/nodeBookmarkStore.ts',
        x: 0.4925,
        y: 0.3774,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/nodeDataStore.ts',
        x: 0.8159,
        y: 0.312,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/nodeDefStore.ts',
        x: 0.5512,
        y: 0.4268,
        states: [
          [0, 0],
          [89, 16],
          [91, 0],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/nodeOutputStore.ts',
        x: 0.6504,
        y: 0.6192,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/previewExposureStore.ts',
        x: 0.7935,
        y: 0.4635,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/queueStore.ts',
        x: 0.5046,
        y: 0.7102,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/rekeyGraphId.ts',
        x: 0.879,
        y: 0.2648,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/rerouteStore.ts',
        x: 0.8323,
        y: 0.3098,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'stores/resultItemParsing.ts',
        x: 0.5394,
        y: 0.8,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/subgraphNavigationStore.ts',
        x: 0.6085,
        y: 0.505,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/subgraphStore.ts',
        x: 0.5325,
        y: 0.4946,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/systemStatsStore.ts',
        x: 0.379,
        y: 0.6306,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'stores/userFileStore.ts',
        x: 0.4533,
        y: 0.5206,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'stores/userStore.ts',
        x: 0.327,
        y: 0.7368,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'stores/widgetStore.ts',
        x: 0.6552,
        y: 0.4981,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/widgetValueStore.ts',
        x: 0.754,
        y: 0.5418,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/workspace/assetsSidebarBadgeStore.ts',
        x: 0.407,
        y: 0.7076,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/bottomPanelStore.ts',
        x: 0.4527,
        y: 0.6513,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/workspace/favoritedWidgetsStore.ts',
        x: 0.6756,
        y: 0.5367,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'stores/workspace/nodeHelpStore.ts',
        x: 0.4767,
        y: 0.3076,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/rightSidePanelStore.ts',
        x: 0.5599,
        y: 0.4581,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/workspace/sidebarTabStore.ts',
        x: 0.4384,
        y: 0.5619,
        states: [
          [0, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'stores/workspaceStore.ts',
        x: 0.4756,
        y: 0.55,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'systems/badgeSystem.ts',
        x: 0.6249,
        y: 0.4615,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      { path: 'types/comfy.ts', x: 0.5731, y: 0.5965, states: [[0, 0]] },
      {
        path: 'types/extensionTypes.ts',
        x: 0.4436,
        y: 0.6082,
        states: [[0, 0]]
      },
      {
        path: 'types/index.ts',
        x: 0.6003,
        y: 0.6085,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'types/linkTopology.ts',
        x: 0.8263,
        y: 0.3391,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'types/metadataTypes.ts',
        x: 0.6364,
        y: 0.7694,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'types/nodeOrganizationTypes.ts',
        x: 0.4595,
        y: 0.3435,
        states: [
          [0, 0],
          [89, 16],
          [91, 0],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'types/nodeState.ts',
        x: 0.7432,
        y: 0.437,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/simplifiedWidget.ts',
        x: 0.8134,
        y: 0.6489,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/treeExplorerTypes.ts',
        x: 0.4598,
        y: 0.4089,
        states: [
          [0, 0],
          [89, 16],
          [91, 0],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'types/widgetState.ts',
        x: 0.8339,
        y: 0.5631,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/createAnnotatedPath.ts',
        x: 0.6013,
        y: 0.6427,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/errorReportUtil.ts',
        x: 0.5872,
        y: 0.6108,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/errorSeverityClassification.ts',
        x: 0.5778,
        y: 0.6886,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/eventUtils.ts',
        x: 0.5831,
        y: 0.7609,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/executionUtil.ts',
        x: 0.6455,
        y: 0.5104,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/graphTraversalUtil.ts',
        x: 0.6582,
        y: 0.5362,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/imageUtil.ts',
        x: 0.6171,
        y: 0.6099,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/linkFixer.ts',
        x: 0.758,
        y: 0.4433,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/litegraphUtil.ts',
        x: 0.6693,
        y: 0.5341,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'utils/mathUtil.ts',
        x: 0.8308,
        y: 0.7023,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/migration/migrateReroute.ts',
        x: 0.5731,
        y: 0.4662,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/missingResourceAbsorption.ts',
        x: 0.6173,
        y: 0.6387,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeDefUtil.ts',
        x: 0.864,
        y: 0.6858,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeFilterUtil.ts',
        x: 0.6707,
        y: 0.4057,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeOutputUtil.ts',
        x: 0.6659,
        y: 0.7434,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/positionBounds.ts',
        x: 0.7222,
        y: 0.3398,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/queueDisplay.ts',
        x: 0.4648,
        y: 0.8466,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/queueUtil.ts',
        x: 0.4319,
        y: 0.8137,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/resultItem.ts',
        x: 0.5004,
        y: 0.805,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/resultItemUrl.ts',
        x: 0.482,
        y: 0.8047,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/searchAndReplace.ts',
        x: 0.6863,
        y: 0.6224,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/sessionFeatureFlagOverride.ts',
        x: 0.3451,
        y: 0.6008,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/syncUtil.ts',
        x: 0.4502,
        y: 0.584,
        states: [
          [0, 0],
          [89, -1],
          [91, 0]
        ]
      },
      {
        path: 'utils/treeUtil.ts',
        x: 0.4028,
        y: 0.4767,
        states: [
          [0, 0],
          [89, 16],
          [91, 0],
          [95, -1],
          [97, 0]
        ]
      },
      {
        path: 'utils/typeGuardUtil.ts',
        x: 0.6121,
        y: 0.5356,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/videoMetadataUtil.ts',
        x: 0.6497,
        y: 0.7816,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/vintageClipboard.ts',
        x: 0.6044,
        y: 0.4881,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/eventHelpers.ts',
        x: 0.6063,
        y: 0.3537,
        states: [
          [0, 0],
          [92, -1],
          [97, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useAgentConsent.ts',
        x: 0.3646,
        y: 0.4896,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useComposer.ts',
        x: 0.224,
        y: 0.6614,
        states: [
          [0, 0],
          [29, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentCrdtDocLifecycle.ts',
        x: 0.2488,
        y: 0.5957,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentSubgraphDefinitions.ts',
        x: 0.7796,
        y: 0.3182,
        states: [
          [0, -1],
          [3, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/devPanelLog.ts',
        x: 0.3142,
        y: 0.5639,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/docOpMinter.ts',
        x: 0.7191,
        y: 0.4681,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/restoreOpMinter.ts',
        x: 0.6504,
        y: 0.4153,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/agentEventTransport.ts',
        x: 0.1041,
        y: 0.658,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/undeliverableAskReporter.ts',
        x: 0.2028,
        y: 0.6184,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/workflowTabActivityTracker.ts',
        x: 0.4648,
        y: 0.43,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentComposerStore.ts',
        x: 0.3062,
        y: 0.6505,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConsentStore.ts',
        x: 0.3294,
        y: 0.4903,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConversationStore.ts',
        x: 0.0471,
        y: 0.6961,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentPanelStore.ts',
        x: 0.4772,
        y: 0.5157,
        states: [
          [0, 0],
          [93, 18],
          [97, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerAttachment.ts',
        x: 0.3274,
        y: 0.8042,
        states: [
          [0, -2],
          [29, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerPrompt.ts',
        x: 0.2088,
        y: 0.757,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/agentMessageText.ts',
        x: 0,
        y: 0.7659,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/composerPrompt.ts',
        x: 0.1386,
        y: 0.7308,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/starterPrompts.ts',
        x: 0.2241,
        y: 0.617,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/utils/nodeDefOrderingUtil.ts',
        x: 0.6389,
        y: 0.4086,
        states: [
          [0, 0],
          [89, -1],
          [91, 0],
          [93, -1],
          [97, 0]
        ]
      },
      {
        path: 'workbench/utils/nodeHelpUtil.ts',
        x: 0.4993,
        y: 0.2844,
        states: [
          [0, 0],
          [1, -1]
        ]
      }
    ],
    edges: [
      [
        197,
        486,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [485, 486, [[0, 3]]],
      [486, 491, [[0, 99]]],
      [486, 595, [[0, 3]]],
      [486, 599, [[0, 3]]],
      [486, 732, [[0, 99]]],
      [486, 733, [[0, 99]]],
      [
        486,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [197, 217, [[0, 3]]],
      [197, 564, [[0, 3]]],
      [197, 595, [[0, 3]]],
      [
        197,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [197, 1002, [[0, 3]]],
      [217, 564, [[0, 3]]],
      [
        564,
        565,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        565,
        601,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        515,
        601,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        524,
        601,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        515,
        564,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        515,
        524,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [595, 601, [[0, 3]]],
      [
        494,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [560, 875, [[0, 99]]],
      [561, 875, [[0, 99]]],
      [562, 875, [[0, 99]]],
      [595, 875, [[0, 3]]],
      [654, 875, [[0, 3]]],
      [
        875,
        930,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [875, 1002, [[0, 3]]],
      [
        197,
        494,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [491, 494, [[0, 99]]],
      [494, 595, [[0, 3]]],
      [494, 599, [[0, 3]]],
      [494, 601, [[0, 3]]],
      [494, 733, [[0, 99]]],
      [
        197,
        491,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [490, 491, [[0, 99]]],
      [491, 599, [[0, 3]]],
      [
        490,
        930,
        [
          [0, 85],
          [87, 99]
        ]
      ],
      [
        197,
        930,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [218, 930, [[0, 3]]],
      [485, 930, [[0, 3]]],
      [486, 930, [[0, 99]]],
      [494, 930, [[0, 99]]],
      [555, 930, [[0, 3]]],
      [
        563,
        930,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [595, 930, [[0, 3]]],
      [599, 930, [[0, 3]]],
      [732, 930, [[0, 99]]],
      [733, 930, [[0, 99]]],
      [911, 930, [[0, 99]]],
      [925, 930, [[0, 99]]],
      [218, 564, [[0, 3]]],
      [219, 485, [[0, 3]]],
      [485, 564, [[0, 3]]],
      [219, 564, [[0, 3]]],
      [555, 599, [[0, 3]]],
      [593, 599, [[0, 3]]],
      [564, 593, [[0, 3]]],
      [563, 564, [[0, 3]]],
      [
        563,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        656,
        732,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [118, 732, [[0, 99]]],
      [
        197,
        732,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [488, 732, [[0, 99]]],
      [599, 732, [[0, 3]]],
      [732, 733, [[0, 99]]],
      [
        656,
        657,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        494,
        656,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [595, 656, [[0, 3]]],
      [
        656,
        930,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [218, 657, [[0, 3]]],
      [
        657,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [118, 925, [[0, 99]]],
      [118, 930, [[0, 99]]],
      [118, 932, [[0, 99]]],
      [932, 971, [[0, 99]]],
      [358, 971, [[0, 3]]],
      [360, 971, [[0, 3]]],
      [
        560,
        971,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [654, 971, [[0, 3]]],
      [
        876,
        971,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        907,
        971,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [971, 972, [[0, 99]]],
      [311, 358, [[0, 42]]],
      [319, 358, [[0, 42]]],
      [320, 358, [[0, 42]]],
      [323, 358, [[0, 42]]],
      [358, 379, [[0, 42]]],
      [358, 380, [[0, 42]]],
      [358, 383, [[0, 42]]],
      [358, 396, [[0, 42]]],
      [355, 358, [[0, 42]]],
      [358, 391, [[0, 42]]],
      [311, 360, [[0, 99]]],
      [326, 360, [[0, 99]]],
      [343, 360, [[0, 99]]],
      [327, 360, [[0, 99]]],
      [329, 360, [[0, 99]]],
      [332, 360, [[0, 99]]],
      [333, 360, [[0, 99]]],
      [336, 360, [[0, 99]]],
      [310, 360, [[0, 99]]],
      [313, 360, [[0, 99]]],
      [355, 360, [[0, 42]]],
      [356, 360, [[0, 99]]],
      [358, 360, [[0, 42]]],
      [314, 360, [[0, 99]]],
      [315, 360, [[0, 42]]],
      [316, 360, [[0, 42]]],
      [317, 360, [[0, 99]]],
      [318, 360, [[0, 99]]],
      [319, 360, [[0, 99]]],
      [322, 360, [[0, 99]]],
      [360, 361, [[0, 99]]],
      [320, 360, [[0, 99]]],
      [360, 362, [[0, 42]]],
      [360, 363, [[0, 99]]],
      [360, 364, [[0, 99]]],
      [360, 369, [[0, 99]]],
      [323, 360, [[0, 99]]],
      [360, 376, [[0, 99]]],
      [360, 377, [[0, 99]]],
      [360, 381, [[0, 99]]],
      [360, 387, [[0, 99]]],
      [360, 391, [[0, 99]]],
      [360, 394, [[0, 99]]],
      [360, 396, [[0, 99]]],
      [360, 403, [[0, 99]]],
      [360, 404, [[0, 99]]],
      [360, 407, [[0, 99]]],
      [360, 424, [[0, 99]]],
      [360, 438, [[0, 99]]],
      [324, 326, [[0, 99]]],
      [326, 327, [[0, 99]]],
      [326, 328, [[0, 99]]],
      [326, 329, [[0, 99]]],
      [326, 330, [[0, 99]]],
      [326, 332, [[0, 99]]],
      [326, 333, [[0, 99]]],
      [326, 334, [[0, 99]]],
      [326, 335, [[0, 99]]],
      [326, 336, [[0, 99]]],
      [234, 326, [[0, 3]]],
      [326, 354, [[0, 99]]],
      [326, 358, [[0, 42]]],
      [319, 326, [[0, 99]]],
      [320, 326, [[0, 99]]],
      [326, 368, [[0, 99]]],
      [323, 326, [[0, 99]]],
      [326, 374, [[0, 99]]],
      [326, 375, [[0, 99]]],
      [326, 377, [[0, 99]]],
      [326, 379, [[0, 99]]],
      [326, 380, [[0, 99]]],
      [326, 382, [[0, 99]]],
      [326, 383, [[0, 99]]],
      [326, 391, [[0, 99]]],
      [326, 396, [[0, 99]]],
      [326, 941, [[0, 3]]],
      [324, 330, [[0, 99]]],
      [324, 354, [[0, 99]]],
      [324, 358, [[0, 42]]],
      [319, 324, [[0, 99]]],
      [320, 324, [[0, 99]]],
      [323, 324, [[0, 99]]],
      [324, 379, [[0, 99]]],
      [324, 382, [[0, 99]]],
      [330, 354, [[0, 99]]],
      [330, 358, [[0, 42]]],
      [319, 330, [[0, 99]]],
      [330, 360, [[0, 99]]],
      [330, 379, [[0, 99]]],
      [330, 378, [[0, 99]]],
      [330, 382, [[0, 99]]],
      [330, 389, [[0, 99]]],
      [327, 354, [[0, 99]]],
      [329, 354, [[0, 99]]],
      [332, 354, [[0, 99]]],
      [333, 354, [[0, 99]]],
      [319, 354, [[0, 99]]],
      [320, 354, [[0, 99]]],
      [323, 354, [[0, 99]]],
      [354, 380, [[0, 99]]],
      [354, 383, [[0, 99]]],
      [354, 391, [[0, 99]]],
      [354, 396, [[0, 99]]],
      [327, 328, [[0, 99]]],
      [234, 327, [[0, 3]]],
      [327, 358, [[0, 42]]],
      [319, 327, [[0, 99]]],
      [320, 327, [[0, 99]]],
      [323, 327, [[0, 99]]],
      [327, 382, [[0, 99]]],
      [327, 389, [[0, 99]]],
      [327, 394, [[0, 99]]],
      [328, 330, [[0, 99]]],
      [328, 354, [[0, 99]]],
      [328, 358, [[0, 42]]],
      [319, 328, [[0, 99]]],
      [320, 328, [[0, 99]]],
      [323, 328, [[0, 99]]],
      [328, 379, [[0, 99]]],
      [328, 382, [[0, 99]]],
      [328, 389, [[0, 99]]],
      [328, 941, [[0, 3]]],
      [319, 343, [[0, 99]]],
      [313, 319, [[0, 99]]],
      [319, 347, [[0, 99]]],
      [319, 348, [[0, 99]]],
      [319, 349, [[0, 99]]],
      [319, 350, [[0, 99]]],
      [319, 355, [[0, 42]]],
      [314, 319, [[0, 99]]],
      [315, 319, [[0, 42]]],
      [316, 319, [[0, 42]]],
      [317, 319, [[0, 99]]],
      [319, 359, [[0, 99]]],
      [319, 320, [[0, 99]]],
      [319, 362, [[0, 42]]],
      [319, 363, [[0, 99]]],
      [319, 364, [[0, 99]]],
      [319, 367, [[0, 99]]],
      [319, 368, [[0, 99]]],
      [319, 369, [[0, 99]]],
      [319, 370, [[0, 99]]],
      [319, 371, [[0, 99]]],
      [319, 323, [[0, 99]]],
      [319, 380, [[0, 99]]],
      [319, 383, [[0, 99]]],
      [319, 391, [[0, 99]]],
      [319, 389, [[0, 99]]],
      [319, 394, [[0, 99]]],
      [319, 396, [[0, 99]]],
      [319, 398, [[0, 99]]],
      [319, 399, [[0, 99]]],
      [319, 401, [[0, 99]]],
      [319, 402, [[0, 99]]],
      [319, 407, [[0, 99]]],
      [319, 438, [[0, 99]]],
      [222, 319, [[0, 99]]],
      [319, 403, [[0, 99]]],
      [319, 749, [[0, 99]]],
      [319, 753, [[0, 99]]],
      [319, 756, [[0, 99]]],
      [319, 962, [[0, 99]]],
      [319, 977, [[0, 99]]],
      [343, 358, [[0, 42]]],
      [343, 362, [[0, 42]]],
      [358, 362, [[0, 42]]],
      [313, 358, [[0, 42]]],
      [347, 355, [[0, 42]]],
      [347, 358, [[0, 42]]],
      [347, 361, [[0, 99]]],
      [355, 362, [[0, 42]]],
      [322, 361, [[0, 99]]],
      [322, 325, [[0, 99]]],
      [311, 322, [[0, 99]]],
      [312, 322, [[0, 99]]],
      [313, 322, [[0, 99]]],
      [322, 347, [[0, 99]]],
      [322, 355, [[0, 42]]],
      [322, 358, [[0, 42]]],
      [314, 322, [[0, 99]]],
      [317, 322, [[0, 99]]],
      [318, 322, [[0, 99]]],
      [319, 322, [[0, 99]]],
      [320, 322, [[0, 99]]],
      [322, 362, [[0, 42]]],
      [322, 323, [[0, 99]]],
      [322, 378, [[0, 99]]],
      [322, 384, [[0, 99]]],
      [317, 325, [[0, 99]]],
      [317, 337, [[0, 99]]],
      [317, 338, [[0, 99]]],
      [317, 339, [[0, 99]]],
      [317, 340, [[0, 99]]],
      [317, 326, [[0, 99]]],
      [317, 342, [[0, 99]]],
      [317, 343, [[0, 99]]],
      [317, 345, [[0, 99]]],
      [317, 331, [[0, 99]]],
      [310, 317, [[0, 99]]],
      [311, 317, [[0, 99]]],
      [313, 317, [[0, 99]]],
      [317, 347, [[0, 99]]],
      [317, 352, [[0, 99]]],
      [317, 355, [[0, 42]]],
      [317, 358, [[0, 42]]],
      [314, 317, [[0, 99]]],
      [317, 318, [[0, 99]]],
      [317, 359, [[0, 99]]],
      [317, 320, [[0, 99]]],
      [317, 362, [[0, 42]]],
      [317, 363, [[0, 99]]],
      [317, 368, [[0, 99]]],
      [317, 323, [[0, 99]]],
      [317, 377, [[0, 99]]],
      [317, 380, [[0, 99]]],
      [317, 378, [[0, 99]]],
      [317, 381, [[0, 99]]],
      [317, 383, [[0, 99]]],
      [317, 387, [[0, 99]]],
      [317, 391, [[0, 99]]],
      [317, 394, [[0, 99]]],
      [317, 396, [[0, 99]]],
      [317, 397, [[0, 99]]],
      [317, 398, [[0, 99]]],
      [317, 399, [[0, 99]]],
      [317, 400, [[0, 99]]],
      [317, 403, [[0, 99]]],
      [317, 407, [[0, 99]]],
      [317, 438, [[0, 99]]],
      [234, 317, [[0, 3]]],
      [317, 327, [[0, 99]]],
      [317, 330, [[0, 99]]],
      [317, 599, [[0, 3]]],
      [317, 746, [[0, 99]]],
      [317, 747, [[0, 99]]],
      [317, 748, [[0, 99]]],
      [317, 749, [[0, 99]]],
      [317, 750, [[0, 99]]],
      [317, 754, [[0, 99]]],
      [317, 756, [[0, 99]]],
      [317, 941, [[0, 3]]],
      [317, 942, [[0, 42]]],
      [317, 986, [[0, 99]]],
      [337, 358, [[0, 42]]],
      [318, 337, [[0, 99]]],
      [320, 337, [[0, 99]]],
      [323, 337, [[0, 99]]],
      [337, 338, [[0, 99]]],
      [337, 339, [[0, 99]]],
      [337, 342, [[0, 99]]],
      [337, 941, [[0, 3]]],
      [318, 347, [[0, 99]]],
      [318, 358, [[0, 42]]],
      [314, 318, [[0, 99]]],
      [318, 319, [[0, 99]]],
      [318, 362, [[0, 42]]],
      [318, 394, [[0, 99]]],
      [318, 753, [[0, 99]]],
      [318, 756, [[0, 99]]],
      [313, 314, [[0, 99]]],
      [314, 348, [[0, 99]]],
      [314, 349, [[0, 99]]],
      [314, 350, [[0, 99]]],
      [314, 353, [[0, 99]]],
      [314, 355, [[0, 42]]],
      [314, 356, [[0, 99]]],
      [314, 358, [[0, 42]]],
      [314, 359, [[0, 99]]],
      [314, 321, [[0, 99]]],
      [314, 320, [[0, 99]]],
      [314, 362, [[0, 42]]],
      [314, 368, [[0, 99]]],
      [314, 370, [[0, 99]]],
      [314, 372, [[0, 99]]],
      [314, 323, [[0, 99]]],
      [314, 386, [[0, 99]]],
      [314, 379, [[0, 99]]],
      [314, 380, [[0, 99]]],
      [314, 382, [[0, 99]]],
      [314, 383, [[0, 99]]],
      [314, 387, [[0, 99]]],
      [314, 388, [[0, 99]]],
      [314, 394, [[0, 99]]],
      [314, 398, [[0, 99]]],
      [314, 399, [[0, 99]]],
      [314, 402, [[0, 99]]],
      [221, 314, [[0, 99]]],
      [223, 314, [[0, 99]]],
      [234, 314, [[0, 3]]],
      [314, 599, [[0, 3]]],
      [314, 746, [[0, 99]]],
      [314, 753, [[0, 99]]],
      [314, 756, [[0, 99]]],
      [314, 931, [[0, 99]]],
      [314, 935, [[0, 99]]],
      [314, 939, [[0, 99]]],
      [314, 941, [[0, 3]]],
      [314, 942, [[0, 42]]],
      [314, 948, [[0, 99]]],
      [314, 951, [[0, 99]]],
      [314, 953, [[0, 99]]],
      [314, 954, [[0, 42]]],
      [314, 962, [[0, 99]]],
      [314, 974, [[0, 42]]],
      [314, 986, [[0, 99]]],
      [348, 394, [[0, 99]]],
      [358, 394, [[0, 42]]],
      [320, 394, [[0, 99]]],
      [323, 394, [[0, 99]]],
      [394, 396, [[0, 99]]],
      [394, 977, [[0, 99]]],
      [320, 323, [[0, 99]]],
      [320, 379, [[0, 99]]],
      [320, 382, [[0, 99]]],
      [320, 756, [[0, 99]]],
      [320, 941, [[0, 3]]],
      [320, 942, [[0, 42]]],
      [320, 974, [[0, 42]]],
      [315, 323, [[0, 42]]],
      [323, 362, [[0, 42]]],
      [323, 753, [[0, 99]]],
      [323, 756, [[0, 99]]],
      [323, 954, [[0, 42]]],
      [315, 358, [[0, 42]]],
      [355, 753, [[0, 42]]],
      [358, 753, [[0, 42]]],
      [753, 756, [[0, 99]]],
      [599, 756, [[0, 3]]],
      [756, 759, [[0, 99]]],
      [360, 759, [[0, 99]]],
      [942, 954, [[0, 42]]],
      [954, 974, [[0, 42]]],
      [942, 974, [[0, 42]]],
      [358, 974, [[0, 42]]],
      [350, 379, [[0, 99]]],
      [379, 380, [[0, 99]]],
      [379, 382, [[0, 99]]],
      [379, 384, [[0, 99]]],
      [379, 387, [[0, 99]]],
      [357, 379, [[0, 99]]],
      [319, 379, [[0, 99]]],
      [360, 379, [[0, 99]]],
      [368, 379, [[0, 99]]],
      [323, 379, [[0, 99]]],
      [379, 396, [[0, 99]]],
      [350, 394, [[0, 99]]],
      [350, 380, [[0, 99]]],
      [374, 380, [[0, 99]]],
      [378, 380, [[0, 99]]],
      [380, 382, [[0, 99]]],
      [310, 380, [[0, 99]]],
      [320, 380, [[0, 99]]],
      [323, 380, [[0, 99]]],
      [373, 380, [[0, 99]]],
      [380, 391, [[0, 99]]],
      [380, 389, [[0, 99]]],
      [380, 398, [[0, 99]]],
      [374, 379, [[0, 99]]],
      [358, 374, [[0, 42]]],
      [319, 374, [[0, 99]]],
      [320, 374, [[0, 99]]],
      [323, 374, [[0, 99]]],
      [373, 374, [[0, 99]]],
      [360, 373, [[0, 99]]],
      [374, 378, [[0, 99]]],
      [375, 378, [[0, 99]]],
      [377, 378, [[0, 99]]],
      [378, 379, [[0, 99]]],
      [378, 382, [[0, 99]]],
      [326, 378, [[0, 99]]],
      [355, 378, [[0, 42]]],
      [358, 378, [[0, 42]]],
      [360, 378, [[0, 99]]],
      [362, 378, [[0, 42]]],
      [378, 394, [[0, 99]]],
      [375, 382, [[0, 99]]],
      [375, 383, [[0, 99]]],
      [358, 375, [[0, 42]]],
      [319, 375, [[0, 99]]],
      [320, 375, [[0, 99]]],
      [323, 375, [[0, 99]]],
      [373, 375, [[0, 99]]],
      [350, 382, [[0, 99]]],
      [382, 383, [[0, 99]]],
      [382, 384, [[0, 99]]],
      [382, 387, [[0, 99]]],
      [358, 382, [[0, 42]]],
      [319, 382, [[0, 99]]],
      [360, 382, [[0, 99]]],
      [323, 382, [[0, 99]]],
      [379, 383, [[0, 99]]],
      [378, 383, [[0, 99]]],
      [310, 383, [[0, 99]]],
      [320, 383, [[0, 99]]],
      [323, 383, [[0, 99]]],
      [383, 391, [[0, 99]]],
      [383, 389, [[0, 99]]],
      [383, 394, [[0, 99]]],
      [383, 398, [[0, 99]]],
      [310, 344, [[0, 42]]],
      [310, 358, [[0, 42]]],
      [310, 391, [[0, 99]]],
      [344, 362, [[0, 42]]],
      [318, 391, [[0, 99]]],
      [358, 389, [[0, 42]]],
      [389, 394, [[0, 99]]],
      [358, 398, [[0, 42]]],
      [373, 398, [[0, 99]]],
      [380, 384, [[0, 99]]],
      [383, 384, [[0, 99]]],
      [347, 384, [[0, 99]]],
      [351, 384, [[0, 42]]],
      [355, 384, [[0, 42]]],
      [358, 384, [[0, 42]]],
      [317, 384, [[0, 99]]],
      [319, 384, [[0, 99]]],
      [360, 384, [[0, 99]]],
      [320, 384, [[0, 99]]],
      [366, 384, [[0, 42]]],
      [323, 384, [[0, 99]]],
      [384, 391, [[0, 99]]],
      [384, 394, [[0, 99]]],
      [351, 358, [[0, 42]]],
      [355, 366, [[0, 42]]],
      [358, 366, [[0, 42]]],
      [377, 387, [[0, 99]]],
      [380, 387, [[0, 99]]],
      [381, 387, [[0, 99]]],
      [383, 387, [[0, 99]]],
      [358, 387, [[0, 42]]],
      [318, 387, [[0, 99]]],
      [319, 387, [[0, 99]]],
      [320, 387, [[0, 99]]],
      [368, 387, [[0, 99]]],
      [323, 387, [[0, 99]]],
      [373, 387, [[0, 99]]],
      [387, 394, [[0, 99]]],
      [314, 377, [[0, 99]]],
      [376, 381, [[0, 99]]],
      [381, 385, [[0, 99]]],
      [379, 381, [[0, 99]]],
      [230, 381, [[0, 99]]],
      [233, 381, [[0, 99]]],
      [242, 381, [[0, 99]]],
      [244, 381, [[0, 99]]],
      [358, 381, [[0, 42]]],
      [314, 381, [[0, 99]]],
      [316, 381, [[0, 42]]],
      [319, 381, [[0, 99]]],
      [320, 381, [[0, 99]]],
      [363, 381, [[0, 99]]],
      [364, 381, [[0, 99]]],
      [377, 381, [[0, 99]]],
      [381, 394, [[0, 99]]],
      [381, 396, [[0, 99]]],
      [381, 403, [[0, 99]]],
      [381, 404, [[0, 99]]],
      [381, 438, [[0, 99]]],
      [381, 951, [[0, 99]]],
      [381, 962, [[0, 99]]],
      [381, 977, [[0, 99]]],
      [376, 377, [[0, 99]]],
      [358, 376, [[0, 42]]],
      [314, 376, [[0, 99]]],
      [319, 376, [[0, 99]]],
      [320, 376, [[0, 99]]],
      [368, 376, [[0, 99]]],
      [376, 962, [[0, 99]]],
      [358, 368, [[0, 42]]],
      [320, 368, [[0, 99]]],
      [368, 942, [[0, 42]]],
      [349, 962, [[0, 99]]],
      [396, 962, [[0, 99]]],
      [962, 978, [[0, 99]]],
      [962, 980, [[0, 99]]],
      [320, 349, [[0, 99]]],
      [349, 599, [[0, 3]]],
      [391, 396, [[0, 99]]],
      [396, 978, [[0, 99]]],
      [396, 980, [[0, 99]]],
      [978, 980, [[0, 99]]],
      [360, 385, [[0, 99]]],
      [385, 396, [[0, 99]]],
      [385, 962, [[0, 99]]],
      [228, 230, [[0, 99]]],
      [230, 233, [[0, 99]]],
      [230, 360, [[0, 99]]],
      [230, 379, [[0, 99]]],
      [228, 360, [[0, 99]]],
      [228, 396, [[0, 99]]],
      [232, 233, [[0, 99]]],
      [233, 360, [[0, 99]]],
      [232, 358, [[0, 42]]],
      [232, 360, [[0, 99]]],
      [241, 242, [[0, 99]]],
      [242, 319, [[0, 99]]],
      [241, 319, [[0, 99]]],
      [241, 244, [[0, 99]]],
      [243, 244, [[0, 99]]],
      [244, 319, [[0, 99]]],
      [244, 396, [[0, 99]]],
      [241, 243, [[0, 99]]],
      [243, 319, [[0, 99]]],
      [316, 355, [[0, 42]]],
      [315, 316, [[0, 42]]],
      [347, 363, [[0, 99]]],
      [358, 363, [[0, 42]]],
      [320, 363, [[0, 99]]],
      [363, 365, [[0, 99]]],
      [363, 368, [[0, 99]]],
      [363, 379, [[0, 99]]],
      [363, 382, [[0, 99]]],
      [363, 387, [[0, 99]]],
      [363, 396, [[0, 99]]],
      [363, 399, [[0, 99]]],
      [365, 366, [[0, 42]]],
      [347, 365, [[0, 99]]],
      [358, 365, [[0, 42]]],
      [319, 365, [[0, 99]]],
      [360, 365, [[0, 99]]],
      [362, 365, [[0, 42]]],
      [365, 379, [[0, 99]]],
      [365, 382, [[0, 99]]],
      [360, 399, [[0, 99]]],
      [347, 364, [[0, 99]]],
      [358, 364, [[0, 42]]],
      [320, 364, [[0, 99]]],
      [364, 365, [[0, 99]]],
      [364, 368, [[0, 99]]],
      [364, 379, [[0, 99]]],
      [364, 382, [[0, 99]]],
      [364, 387, [[0, 99]]],
      [364, 399, [[0, 99]]],
      [358, 403, [[0, 42]]],
      [396, 403, [[0, 99]]],
      [319, 404, [[0, 99]]],
      [396, 404, [[0, 99]]],
      [404, 962, [[0, 99]]],
      [405, 438, [[0, 99]]],
      [407, 438, [[0, 99]]],
      [408, 438, [[0, 99]]],
      [410, 438, [[0, 99]]],
      [409, 438, [[0, 99]]],
      [411, 438, [[0, 99]]],
      [412, 438, [[0, 99]]],
      [414, 438, [[0, 99]]],
      [413, 438, [[0, 99]]],
      [415, 438, [[0, 99]]],
      [416, 438, [[0, 99]]],
      [417, 438, [[0, 99]]],
      [418, 438, [[0, 99]]],
      [419, 438, [[0, 99]]],
      [420, 438, [[0, 99]]],
      [421, 438, [[0, 99]]],
      [422, 438, [[0, 99]]],
      [423, 438, [[0, 99]]],
      [424, 438, [[0, 99]]],
      [426, 438, [[0, 99]]],
      [427, 438, [[0, 99]]],
      [428, 438, [[0, 99]]],
      [429, 438, [[0, 99]]],
      [430, 438, [[0, 99]]],
      [431, 438, [[0, 99]]],
      [432, 438, [[0, 99]]],
      [434, 438, [[0, 99]]],
      [433, 438, [[0, 99]]],
      [435, 438, [[0, 99]]],
      [436, 438, [[0, 99]]],
      [396, 438, [[0, 99]]],
      [403, 438, [[0, 99]]],
      [405, 407, [[0, 99]]],
      [319, 405, [[0, 99]]],
      [396, 405, [[0, 99]]],
      [347, 407, [[0, 99]]],
      [355, 407, [[0, 42]]],
      [358, 407, [[0, 42]]],
      [361, 407, [[0, 99]]],
      [391, 407, [[0, 99]]],
      [396, 407, [[0, 99]]],
      [404, 407, [[0, 99]]],
      [407, 962, [[0, 99]]],
      [407, 980, [[0, 99]]],
      [407, 408, [[0, 99]]],
      [396, 408, [[0, 99]]],
      [396, 410, [[0, 99]]],
      [407, 410, [[0, 99]]],
      [396, 409, [[0, 99]]],
      [407, 409, [[0, 99]]],
      [407, 411, [[0, 99]]],
      [319, 411, [[0, 99]]],
      [396, 411, [[0, 99]]],
      [396, 412, [[0, 99]]],
      [412, 437, [[0, 99]]],
      [396, 437, [[0, 99]]],
      [407, 437, [[0, 99]]],
      [396, 414, [[0, 99]]],
      [407, 414, [[0, 99]]],
      [396, 413, [[0, 99]]],
      [407, 413, [[0, 99]]],
      [406, 415, [[0, 99]]],
      [407, 415, [[0, 99]]],
      [358, 415, [[0, 42]]],
      [319, 415, [[0, 99]]],
      [360, 415, [[0, 99]]],
      [396, 415, [[0, 99]]],
      [399, 415, [[0, 99]]],
      [404, 415, [[0, 99]]],
      [406, 407, [[0, 99]]],
      [396, 406, [[0, 99]]],
      [396, 416, [[0, 99]]],
      [416, 437, [[0, 99]]],
      [396, 417, [[0, 99]]],
      [407, 417, [[0, 99]]],
      [396, 418, [[0, 99]]],
      [418, 437, [[0, 99]]],
      [396, 419, [[0, 99]]],
      [419, 437, [[0, 99]]],
      [407, 420, [[0, 99]]],
      [396, 420, [[0, 99]]],
      [404, 420, [[0, 99]]],
      [396, 421, [[0, 99]]],
      [421, 437, [[0, 99]]],
      [396, 422, [[0, 99]]],
      [407, 422, [[0, 99]]],
      [407, 423, [[0, 99]]],
      [396, 423, [[0, 99]]],
      [404, 423, [[0, 99]]],
      [407, 424, [[0, 99]]],
      [319, 424, [[0, 99]]],
      [396, 424, [[0, 99]]],
      [396, 426, [[0, 99]]],
      [426, 437, [[0, 99]]],
      [396, 427, [[0, 99]]],
      [427, 437, [[0, 99]]],
      [406, 428, [[0, 99]]],
      [407, 428, [[0, 99]]],
      [396, 428, [[0, 99]]],
      [404, 428, [[0, 99]]],
      [396, 429, [[0, 99]]],
      [407, 429, [[0, 99]]],
      [396, 430, [[0, 99]]],
      [407, 430, [[0, 99]]],
      [396, 431, [[0, 99]]],
      [431, 437, [[0, 99]]],
      [407, 432, [[0, 99]]],
      [396, 432, [[0, 99]]],
      [404, 432, [[0, 99]]],
      [396, 434, [[0, 99]]],
      [407, 434, [[0, 99]]],
      [407, 433, [[0, 99]]],
      [319, 433, [[0, 99]]],
      [396, 433, [[0, 99]]],
      [396, 435, [[0, 99]]],
      [407, 435, [[0, 99]]],
      [396, 436, [[0, 99]]],
      [407, 436, [[0, 99]]],
      [225, 951, [[0, 99]]],
      [228, 951, [[0, 99]]],
      [242, 951, [[0, 99]]],
      [360, 951, [[0, 99]]],
      [373, 951, [[0, 99]]],
      [225, 242, [[0, 99]]],
      [358, 977, [[0, 42]]],
      [353, 357, [[0, 99]]],
      [319, 357, [[0, 99]]],
      [357, 360, [[0, 99]]],
      [357, 396, [[0, 99]]],
      [353, 358, [[0, 42]]],
      [319, 353, [[0, 99]]],
      [320, 353, [[0, 99]]],
      [353, 377, [[0, 99]]],
      [353, 394, [[0, 99]]],
      [599, 941, [[0, 3]]],
      [353, 356, [[0, 99]]],
      [356, 377, [[0, 99]]],
      [356, 379, [[0, 99]]],
      [356, 381, [[0, 99]]],
      [356, 382, [[0, 99]]],
      [356, 396, [[0, 99]]],
      [320, 359, [[0, 99]]],
      [359, 394, [[0, 99]]],
      [359, 595, [[0, 3]]],
      [359, 942, [[0, 42]]],
      [320, 321, [[0, 99]]],
      [358, 370, [[0, 42]]],
      [370, 403, [[0, 99]]],
      [370, 404, [[0, 99]]],
      [370, 407, [[0, 99]]],
      [370, 396, [[0, 99]]],
      [370, 438, [[0, 99]]],
      [370, 962, [[0, 99]]],
      [320, 372, [[0, 99]]],
      [372, 394, [[0, 99]]],
      [372, 942, [[0, 42]]],
      [350, 386, [[0, 99]]],
      [359, 386, [[0, 99]]],
      [386, 394, [[0, 99]]],
      [386, 977, [[0, 99]]],
      [358, 388, [[0, 42]]],
      [319, 388, [[0, 99]]],
      [360, 388, [[0, 99]]],
      [388, 394, [[0, 99]]],
      [401, 402, [[0, 99]]],
      [402, 549, [[0, 99]]],
      [402, 595, [[0, 3]]],
      [396, 401, [[0, 99]]],
      [360, 549, [[0, 99]]],
      [221, 222, [[0, 99]]],
      [221, 319, [[0, 99]]],
      [221, 370, [[0, 99]]],
      [221, 377, [[0, 99]]],
      [221, 396, [[0, 99]]],
      [221, 403, [[0, 99]]],
      [221, 404, [[0, 99]]],
      [221, 599, [[0, 3]]],
      [221, 951, [[0, 99]]],
      [221, 962, [[0, 99]]],
      [222, 358, [[0, 42]]],
      [222, 314, [[0, 99]]],
      [222, 753, [[0, 99]]],
      [222, 948, [[0, 99]]],
      [222, 977, [[0, 99]]],
      [948, 977, [[0, 99]]],
      [223, 358, [[0, 42]]],
      [223, 360, [[0, 99]]],
      [223, 396, [[0, 99]]],
      [223, 962, [[0, 99]]],
      [234, 941, [[0, 3]]],
      [360, 746, [[0, 99]]],
      [746, 756, [[0, 99]]],
      [931, 951, [[0, 99]]],
      [931, 962, [[0, 99]]],
      [319, 931, [[0, 99]]],
      [350, 935, [[0, 99]]],
      [935, 953, [[0, 99]]],
      [939, 953, [[0, 99]]],
      [986, 1005, [[0, 99]]],
      [228, 986, [[0, 99]]],
      [360, 986, [[0, 99]]],
      [977, 986, [[0, 99]]],
      [360, 1005, [[0, 99]]],
      [338, 358, [[0, 42]]],
      [314, 338, [[0, 99]]],
      [323, 338, [[0, 99]]],
      [338, 756, [[0, 99]]],
      [314, 339, [[0, 99]]],
      [320, 339, [[0, 99]]],
      [339, 403, [[0, 99]]],
      [339, 340, [[0, 99]]],
      [339, 341, [[0, 99]]],
      [339, 941, [[0, 3]]],
      [340, 358, [[0, 42]]],
      [315, 340, [[0, 42]]],
      [320, 340, [[0, 99]]],
      [340, 362, [[0, 42]]],
      [340, 403, [[0, 99]]],
      [341, 358, [[0, 42]]],
      [314, 341, [[0, 99]]],
      [341, 360, [[0, 99]]],
      [320, 341, [[0, 99]]],
      [341, 368, [[0, 99]]],
      [341, 749, [[0, 99]]],
      [358, 749, [[0, 42]]],
      [314, 749, [[0, 99]]],
      [360, 749, [[0, 99]]],
      [369, 749, [[0, 99]]],
      [746, 749, [[0, 99]]],
      [749, 756, [[0, 99]]],
      [358, 369, [[0, 42]]],
      [320, 369, [[0, 99]]],
      [368, 369, [[0, 99]]],
      [369, 394, [[0, 99]]],
      [342, 358, [[0, 42]]],
      [314, 342, [[0, 99]]],
      [320, 342, [[0, 99]]],
      [323, 342, [[0, 99]]],
      [342, 391, [[0, 99]]],
      [342, 941, [[0, 3]]],
      [345, 358, [[0, 42]]],
      [314, 345, [[0, 99]]],
      [318, 345, [[0, 99]]],
      [319, 345, [[0, 99]]],
      [320, 345, [[0, 99]]],
      [345, 362, [[0, 42]]],
      [323, 345, [[0, 99]]],
      [345, 380, [[0, 99]]],
      [345, 383, [[0, 99]]],
      [345, 391, [[0, 99]]],
      [338, 345, [[0, 99]]],
      [339, 345, [[0, 99]]],
      [331, 358, [[0, 42]]],
      [314, 331, [[0, 99]]],
      [331, 748, [[0, 99]]],
      [358, 748, [[0, 42]]],
      [314, 748, [[0, 99]]],
      [360, 748, [[0, 99]]],
      [380, 748, [[0, 99]]],
      [378, 748, [[0, 99]]],
      [383, 748, [[0, 99]]],
      [352, 358, [[0, 42]]],
      [314, 352, [[0, 99]]],
      [316, 352, [[0, 42]]],
      [318, 352, [[0, 99]]],
      [319, 352, [[0, 99]]],
      [352, 377, [[0, 99]]],
      [352, 381, [[0, 99]]],
      [352, 391, [[0, 99]]],
      [358, 397, [[0, 42]]],
      [319, 397, [[0, 99]]],
      [358, 400, [[0, 42]]],
      [360, 400, [[0, 99]]],
      [358, 747, [[0, 42]]],
      [360, 747, [[0, 99]]],
      [320, 747, [[0, 99]]],
      [323, 747, [[0, 99]]],
      [747, 756, [[0, 99]]],
      [313, 750, [[0, 99]]],
      [360, 754, [[0, 99]]],
      [754, 756, [[0, 99]]],
      [312, 358, [[0, 42]]],
      [312, 360, [[0, 99]]],
      [312, 362, [[0, 42]]],
      [358, 367, [[0, 42]]],
      [363, 367, [[0, 99]]],
      [364, 367, [[0, 99]]],
      [367, 403, [[0, 99]]],
      [315, 371, [[0, 42]]],
      [328, 329, [[0, 99]]],
      [234, 329, [[0, 3]]],
      [329, 358, [[0, 42]]],
      [319, 329, [[0, 99]]],
      [320, 329, [[0, 99]]],
      [323, 329, [[0, 99]]],
      [329, 379, [[0, 99]]],
      [329, 389, [[0, 99]]],
      [329, 394, [[0, 99]]],
      [330, 332, [[0, 99]]],
      [234, 332, [[0, 3]]],
      [332, 358, [[0, 42]]],
      [319, 332, [[0, 99]]],
      [320, 332, [[0, 99]]],
      [323, 332, [[0, 99]]],
      [332, 379, [[0, 99]]],
      [332, 380, [[0, 99]]],
      [332, 389, [[0, 99]]],
      [332, 941, [[0, 3]]],
      [330, 333, [[0, 99]]],
      [333, 358, [[0, 42]]],
      [319, 333, [[0, 99]]],
      [320, 333, [[0, 99]]],
      [323, 333, [[0, 99]]],
      [333, 382, [[0, 99]]],
      [333, 389, [[0, 99]]],
      [330, 334, [[0, 99]]],
      [234, 334, [[0, 3]]],
      [334, 354, [[0, 99]]],
      [334, 358, [[0, 42]]],
      [319, 334, [[0, 99]]],
      [320, 334, [[0, 99]]],
      [323, 334, [[0, 99]]],
      [334, 382, [[0, 99]]],
      [334, 383, [[0, 99]]],
      [334, 389, [[0, 99]]],
      [334, 394, [[0, 99]]],
      [334, 941, [[0, 3]]],
      [333, 335, [[0, 99]]],
      [335, 336, [[0, 99]]],
      [234, 335, [[0, 3]]],
      [319, 335, [[0, 99]]],
      [335, 360, [[0, 99]]],
      [323, 335, [[0, 99]]],
      [335, 941, [[0, 3]]],
      [330, 336, [[0, 99]]],
      [336, 354, [[0, 99]]],
      [336, 358, [[0, 42]]],
      [319, 336, [[0, 99]]],
      [323, 336, [[0, 99]]],
      [336, 379, [[0, 99]]],
      [336, 389, [[0, 99]]],
      [336, 394, [[0, 99]]],
      [560, 592, [[0, 99]]],
      [560, 654, [[0, 3]]],
      [592, 875, [[0, 99]]],
      [314, 654, [[0, 3]]],
      [394, 654, [[0, 3]]],
      [396, 654, [[0, 3]]],
      [654, 977, [[0, 3]]],
      [
        875,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [876, 881, [[0, 3]]],
      [
        876,
        892,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        876,
        893,
        [
          [0, 86],
          [88, 88],
          [97, 99]
        ]
      ],
      [
        876,
        894,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        902,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        905,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        907,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        128,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        139,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        202,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [226, 876, [[0, 3]]],
      [230, 876, [[0, 3]]],
      [237, 876, [[0, 3]]],
      [
        274,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [349, 876, [[0, 3]]],
      [358, 876, [[0, 3]]],
      [360, 876, [[0, 3]]],
      [362, 876, [[0, 3]]],
      [396, 876, [[0, 3]]],
      [
        470,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        505,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        508,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        533,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        537,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        539,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [540, 876, [[0, 3]]],
      [
        545,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        547,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [548, 876, [[0, 3]]],
      [549, 876, [[0, 3]]],
      [
        550,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        551,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        553,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        560,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        584,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [595, 876, [[0, 3]]],
      [
        596,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [598, 876, [[0, 3]]],
      [599, 876, [[0, 3]]],
      [601, 876, [[0, 3]]],
      [
        606,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [607, 876, [[0, 12]]],
      [609, 876, [[0, 3]]],
      [
        611,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        613,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        614,
        876,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        620,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        653,
        876,
        [
          [0, 3],
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [654, 876, [[0, 3]]],
      [
        732,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [740, 876, [[0, 3]]],
      [
        742,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        752,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [799, 876, [[0, 3]]],
      [
        876,
        879,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [876, 882, [[0, 27]]],
      [
        876,
        890,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        876,
        911,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        913,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        915,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        921,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        925,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        932,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [876, 933, [[0, 27]]],
      [
        876,
        936,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        937,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        938,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        940,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        876,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        876,
        950,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        956,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        957,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        961,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [876, 962, [[0, 3]]],
      [
        876,
        969,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        972,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        876,
        984,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        876,
        985,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [876, 986, [[0, 3]]],
      [
        876,
        989,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [876, 990, [[0, 3]]],
      [876, 991, [[0, 3]]],
      [876, 1007, [[0, 3]]],
      [654, 881, [[0, 3]]],
      [
        875,
        892,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [884, 892, [[0, 3]]],
      [349, 892, [[0, 3]]],
      [360, 892, [[0, 3]]],
      [396, 892, [[0, 3]]],
      [654, 884, [[0, 3]]],
      [884, 975, [[0, 3]]],
      [654, 975, [[0, 3]]],
      [893, 906, [[0, 3]]],
      [226, 893, [[0, 3]]],
      [230, 893, [[0, 3]]],
      [360, 893, [[0, 3]]],
      [396, 893, [[0, 3]]],
      [
        584,
        893,
        [
          [0, 86],
          [88, 88],
          [97, 99]
        ]
      ],
      [360, 906, [[0, 3]]],
      [396, 906, [[0, 3]]],
      [404, 906, [[0, 3]]],
      [906, 978, [[0, 3]]],
      [226, 233, [[0, 3]]],
      [226, 358, [[0, 3]]],
      [226, 360, [[0, 3]]],
      [226, 396, [[0, 3]]],
      [226, 962, [[0, 3]]],
      [584, 595, [[0, 3]]],
      [584, 601, [[0, 3]]],
      [
        584,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [584, 979, [[0, 23]]],
      [
        949,
        979,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        976,
        979,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [226, 949, [[0, 3]]],
      [230, 949, [[0, 3]]],
      [237, 949, [[0, 3]]],
      [360, 949, [[0, 3]]],
      [
        584,
        949,
        [
          [0, 88],
          [91, 94],
          [97, 99]
        ]
      ],
      [874, 949, [[0, 3]]],
      [
        919,
        949,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        949,
        957,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        949,
        1004,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [237, 978, [[0, 3]]],
      [872, 874, [[0, 3]]],
      [599, 872, [[0, 3]]],
      [360, 957, [[0, 3]]],
      [
        584,
        957,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [611, 957, [[0, 99]]],
      [
        619,
        957,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [620, 957, [[0, 99]]],
      [654, 957, [[0, 3]]],
      [741, 957, [[0, 99]]],
      [
        875,
        957,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        911,
        957,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [936, 957, [[0, 99]]],
      [
        957,
        959,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [189, 611, [[0, 99]]],
      [360, 611, [[0, 3]]],
      [539, 611, [[0, 99]]],
      [547, 611, [[0, 99]]],
      [
        551,
        611,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        584,
        611,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [595, 611, [[0, 3]]],
      [599, 611, [[0, 3]]],
      [
        611,
        613,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [611, 615, [[0, 3]]],
      [611, 616, [[0, 3]]],
      [611, 620, [[0, 99]]],
      [
        611,
        622,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [611, 654, [[0, 3]]],
      [611, 762, [[0, 99]]],
      [611, 881, [[0, 3]]],
      [
        611,
        911,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [611, 926, [[0, 99]]],
      [611, 933, [[0, 27]]],
      [611, 936, [[0, 99]]],
      [611, 950, [[0, 99]]],
      [611, 956, [[0, 99]]],
      [611, 969, [[0, 99]]],
      [189, 620, [[0, 99]]],
      [
        619,
        620,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [360, 620, [[0, 3]]],
      [615, 620, [[0, 3]]],
      [
        620,
        622,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [620, 654, [[0, 3]]],
      [620, 762, [[0, 99]]],
      [
        620,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 881, [[0, 3]]],
      [620, 937, [[0, 99]]],
      [
        620,
        1003,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 1005, [[0, 3]]],
      [540, 619, [[0, 3]]],
      [548, 619, [[0, 3]]],
      [
        584,
        619,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [599, 619, [[0, 3]]],
      [
        619,
        622,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [619, 654, [[0, 3]]],
      [
        619,
        879,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        619,
        911,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        619,
        959,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        619,
        971,
        [
          [0, 12],
          [93, 96]
        ]
      ],
      [228, 540, [[0, 3]]],
      [228, 548, [[0, 3]]],
      [599, 622, [[0, 3]]],
      [
        622,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        875,
        879,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [360, 879, [[0, 3]]],
      [
        560,
        879,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 879, [[0, 99]]],
      [654, 879, [[0, 3]]],
      [780, 879, [[0, 27]]],
      [879, 937, [[0, 99]]],
      [879, 950, [[0, 99]]],
      [879, 956, [[0, 99]]],
      [879, 989, [[0, 99]]],
      [779, 780, [[0, 65]]],
      [319, 779, [[0, 3]]],
      [620, 779, [[0, 65]]],
      [764, 779, [[0, 3]]],
      [765, 779, [[0, 65]]],
      [767, 779, [[0, 3]]],
      [779, 950, [[0, 65]]],
      [319, 764, [[0, 3]]],
      [764, 766, [[0, 3]]],
      [764, 769, [[0, 3]]],
      [239, 766, [[0, 3]]],
      [319, 766, [[0, 3]]],
      [239, 360, [[0, 3]]],
      [239, 962, [[0, 3]]],
      [239, 978, [[0, 3]]],
      [319, 769, [[0, 3]]],
      [769, 1005, [[0, 3]]],
      [319, 765, [[0, 3]]],
      [765, 766, [[0, 3]]],
      [765, 769, [[0, 3]]],
      [765, 875, [[0, 65]]],
      [765, 876, [[0, 65]]],
      [319, 767, [[0, 3]]],
      [764, 767, [[0, 3]]],
      [360, 950, [[0, 3]]],
      [
        560,
        950,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 950, [[0, 99]]],
      [
        875,
        950,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        905,
        950,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        950,
        981,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [950, 986, [[0, 3]]],
      [950, 989, [[0, 99]]],
      [
        950,
        995,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        875,
        905,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [894, 905, [[0, 23]]],
      [905, 1001, [[0, 3]]],
      [
        875,
        894,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [894, 900, [[0, 23]]],
      [894, 903, [[0, 99]]],
      [894, 904, [[0, 23]]],
      [
        204,
        894,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        560,
        894,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        561,
        894,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        581,
        894,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        584,
        894,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [595, 894, [[0, 3]]],
      [
        894,
        915,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [894, 932, [[0, 99]]],
      [
        894,
        950,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        894,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [900, 903, [[0, 23]]],
      [
        584,
        903,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        876,
        903,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        189,
        204,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [204, 595, [[0, 3]]],
      [204, 601, [[0, 3]]],
      [204, 605, [[0, 3]]],
      [
        204,
        606,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [601, 605, [[0, 3]]],
      [601, 606, [[0, 3]]],
      [
        606,
        620,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        606,
        643,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        606,
        949,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [606, 986, [[0, 3]]],
      [
        643,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [561, 562, [[0, 99]]],
      [560, 561, [[0, 99]]],
      [561, 654, [[0, 3]]],
      [560, 562, [[0, 99]]],
      [574, 581, [[0, 16]]],
      [
        581,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [34, 574, [[0, 16]]],
      [123, 574, [[0, 16]]],
      [571, 574, [[0, 16]]],
      [574, 577, [[0, 16]]],
      [574, 578, [[0, 16]]],
      [574, 579, [[0, 16]]],
      [574, 580, [[0, 16]]],
      [574, 584, [[0, 16]]],
      [574, 600, [[0, 3]]],
      [574, 732, [[0, 16]]],
      [574, 1004, [[0, 16]]],
      [34, 960, [[0, 16]]],
      [875, 960, [[0, 16]]],
      [
        122,
        123,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        125,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        126,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        508,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        514,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [123, 515, [[0, 3]]],
      [123, 564, [[0, 3]]],
      [
        123,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        123,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        122,
        514,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [122, 515, [[0, 3]]],
      [
        122,
        656,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        125,
        514,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        197,
        514,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [504, 514, [[0, 99]]],
      [
        514,
        517,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [514, 595, [[0, 3]]],
      [514, 601, [[0, 3]]],
      [
        514,
        663,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [514, 675, [[0, 99]]],
      [514, 676, [[0, 99]]],
      [
        514,
        718,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        514,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        514,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        514,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        514,
        737,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        514,
        911,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        514,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        120,
        125,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        122,
        125,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        125,
        197,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        125,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        120,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        110,
        504,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        504,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        500,
        504,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [502, 504, [[0, 99]]],
      [504, 595, [[0, 3]]],
      [504, 601, [[0, 3]]],
      [
        504,
        932,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        110,
        111,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        110,
        971,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        111,
        971,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        500,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        500,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [500, 515, [[0, 3]]],
      [500, 522, [[0, 3]]],
      [
        500,
        523,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [500, 524, [[0, 3]]],
      [500, 595, [[0, 3]]],
      [500, 601, [[0, 3]]],
      [
        500,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [500, 604, [[0, 3]]],
      [
        500,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        500,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        121,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        123,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        116,
        129,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [116, 595, [[0, 3]]],
      [116, 601, [[0, 3]]],
      [
        116,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        611,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        620,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        911,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        121,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        129,
        910,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [218, 910, [[0, 3]]],
      [
        494,
        910,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        910,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [910, 1005, [[0, 3]]],
      [
        602,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        602,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        25,
        911,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [26, 911, [[0, 99]]],
      [27, 911, [[0, 99]]],
      [
        28,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        46,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        29,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        30,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        123,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [497, 911, [[0, 3]]],
      [
        516,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        531,
        911,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        563,
        911,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [564, 911, [[0, 3]]],
      [595, 911, [[0, 3]]],
      [599, 911, [[0, 3]]],
      [601, 911, [[0, 3]]],
      [
        628,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        656,
        911,
        [
          [0, 89],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        682,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        683,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        684,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        686,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        688,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        689,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        690,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        691,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        692,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        693,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        694,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        695,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        679,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        709,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        712,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        732,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        875,
        911,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        25,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        26,
        581,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        26,
        584,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [27, 31, [[0, 3]]],
      [27, 526, [[0, 99]]],
      [
        27,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [27, 595, [[0, 3]]],
      [
        27,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        27,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [27, 932, [[0, 99]]],
      [
        27,
        958,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [27, 982, [[0, 3]]],
      [31, 595, [[0, 3]]],
      [
        526,
        527,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [526, 528, [[0, 99]]],
      [
        526,
        529,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        526,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        526,
        532,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        527,
        530,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        527,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        530,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [531, 540, [[0, 3]]],
      [531, 548, [[0, 3]]],
      [
        531,
        560,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [531, 971, [[0, 12]]],
      [
        528,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [528, 536, [[0, 3]]],
      [
        528,
        543,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [536, 540, [[0, 3]]],
      [
        543,
        546,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [543, 548, [[0, 3]]],
      [546, 548, [[0, 3]]],
      [226, 546, [[0, 3]]],
      [228, 546, [[0, 3]]],
      [230, 546, [[0, 3]]],
      [231, 546, [[0, 3]]],
      [235, 546, [[0, 3]]],
      [314, 546, [[0, 3]]],
      [319, 546, [[0, 3]]],
      [396, 546, [[0, 3]]],
      [546, 612, [[0, 3]]],
      [546, 654, [[0, 3]]],
      [
        546,
        929,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [546, 986, [[0, 3]]],
      [
        546,
        989,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [226, 231, [[0, 3]]],
      [230, 231, [[0, 3]]],
      [231, 358, [[0, 3]]],
      [231, 360, [[0, 3]]],
      [231, 396, [[0, 3]]],
      [231, 986, [[0, 3]]],
      [235, 396, [[0, 3]]],
      [612, 654, [[0, 3]]],
      [
        927,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        929,
        946,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [929, 952, [[0, 99]]],
      [
        197,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [454, 929, [[0, 99]]],
      [
        462,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        471,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        562,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        875,
        929,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        560,
        927,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        592,
        927,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        875,
        927,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        946,
        949,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        560,
        952,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        561,
        952,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        562,
        952,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        584,
        952,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        875,
        952,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        876,
        952,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [913, 952, [[0, 99]]],
      [914, 952, [[0, 99]]],
      [937, 952, [[0, 99]]],
      [950, 952, [[0, 99]]],
      [
        952,
        955,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        952,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [266, 913, [[0, 65]]],
      [
        118,
        913,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [346, 913, [[0, 3]]],
      [
        584,
        913,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [598, 913, [[0, 3]]],
      [599, 913, [[0, 3]]],
      [875, 913, [[0, 65]]],
      [
        913,
        932,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        913,
        938,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [913, 944, [[0, 99]]],
      [913, 961, [[0, 99]]],
      [
        913,
        964,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        913,
        971,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [245, 266, [[0, 65]]],
      [250, 266, [[0, 65]]],
      [251, 266, [[0, 65]]],
      [252, 266, [[0, 65]]],
      [253, 266, [[0, 65]]],
      [254, 266, [[0, 65]]],
      [255, 266, [[0, 65]]],
      [256, 266, [[0, 65]]],
      [257, 266, [[0, 65]]],
      [258, 266, [[0, 65]]],
      [259, 266, [[0, 65]]],
      [260, 266, [[0, 65]]],
      [261, 266, [[0, 65]]],
      [262, 266, [[0, 65]]],
      [263, 266, [[0, 65]]],
      [264, 266, [[0, 65]]],
      [265, 266, [[0, 65]]],
      [266, 267, [[0, 65]]],
      [266, 289, [[0, 65]]],
      [266, 291, [[0, 65]]],
      [266, 292, [[0, 65]]],
      [266, 293, [[0, 65]]],
      [266, 294, [[0, 65]]],
      [266, 295, [[0, 65]]],
      [266, 296, [[0, 65]]],
      [266, 297, [[0, 65]]],
      [266, 299, [[0, 65]]],
      [266, 300, [[0, 65]]],
      [266, 301, [[0, 65]]],
      [266, 303, [[0, 65]]],
      [266, 305, [[0, 65]]],
      [266, 306, [[0, 65]]],
      [266, 307, [[0, 65]]],
      [266, 308, [[0, 65]]],
      [118, 245, [[0, 65]]],
      [197, 245, [[0, 65]]],
      [245, 556, [[0, 65]]],
      [245, 564, [[0, 3]]],
      [245, 595, [[0, 3]]],
      [245, 599, [[0, 3]]],
      [245, 601, [[0, 3]]],
      [245, 620, [[0, 65]]],
      [245, 732, [[0, 65]]],
      [245, 741, [[0, 65]]],
      [245, 771, [[0, 65]]],
      [245, 913, [[0, 65]]],
      [245, 986, [[0, 3]]],
      [245, 1009, [[0, 65]]],
      [245, 1015, [[0, 65]]],
      [245, 1018, [[0, 65]]],
      [245, 1019, [[0, 65]]],
      [245, 1020, [[0, 65]]],
      [245, 1022, [[0, 65]]],
      [554, 556, [[0, 3]]],
      [556, 557, [[0, 3]]],
      [556, 558, [[0, 3]]],
      [556, 559, [[0, 65]]],
      [556, 584, [[0, 65]]],
      [556, 595, [[0, 3]]],
      [556, 601, [[0, 3]]],
      [556, 968, [[0, 65]]],
      [554, 557, [[0, 3]]],
      [557, 601, [[0, 3]]],
      [557, 558, [[0, 3]]],
      [557, 559, [[0, 3]]],
      [189, 559, [[0, 65]]],
      [559, 926, [[0, 65]]],
      [6, 926, [[0, 24]]],
      [189, 926, [[0, 99]]],
      [233, 926, [[0, 3]]],
      [360, 926, [[0, 3]]],
      [381, 926, [[0, 3]]],
      [396, 926, [[0, 3]]],
      [
        584,
        926,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        619,
        926,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [620, 926, [[0, 99]]],
      [741, 926, [[0, 99]]],
      [
        876,
        926,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [879, 926, [[0, 99]]],
      [
        926,
        968,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [926, 989, [[0, 99]]],
      [6, 211, [[0, 24]]],
      [6, 876, [[0, 24]]],
      [6, 911, [[0, 24]]],
      [24, 211, [[0, 65]]],
      [211, 595, [[0, 3]]],
      [211, 601, [[0, 3]]],
      [211, 911, [[0, 65]]],
      [211, 923, [[0, 65]]],
      [18, 24, [[0, 65]]],
      [19, 24, [[0, 3]]],
      [24, 205, [[0, 65]]],
      [24, 218, [[0, 3]]],
      [24, 541, [[0, 65]]],
      [24, 542, [[0, 65]]],
      [24, 595, [[0, 3]]],
      [24, 599, [[0, 3]]],
      [24, 612, [[0, 3]]],
      [24, 640, [[0, 65]]],
      [24, 641, [[0, 65]]],
      [24, 642, [[0, 65]]],
      [24, 643, [[0, 65]]],
      [24, 646, [[0, 3]]],
      [24, 647, [[0, 3]]],
      [24, 649, [[0, 65]]],
      [24, 650, [[0, 3]]],
      [24, 651, [[0, 65]]],
      [18, 205, [[0, 65]]],
      [205, 584, [[0, 65]]],
      [205, 595, [[0, 3]]],
      [205, 600, [[0, 3]]],
      [205, 958, [[0, 65]]],
      [595, 600, [[0, 3]]],
      [600, 601, [[0, 3]]],
      [
        875,
        958,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [19, 20, [[0, 3]]],
      [19, 646, [[0, 3]]],
      [20, 23, [[0, 3]]],
      [20, 646, [[0, 3]]],
      [22, 23, [[0, 3]]],
      [23, 646, [[0, 3]]],
      [21, 22, [[0, 3]]],
      [22, 646, [[0, 3]]],
      [22, 648, [[0, 3]]],
      [21, 648, [[0, 3]]],
      [612, 648, [[0, 3]]],
      [646, 648, [[0, 3]]],
      [541, 875, [[0, 65]]],
      [542, 599, [[0, 3]]],
      [542, 934, [[0, 3]]],
      [
        542,
        968,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [599, 934, [[0, 3]]],
      [184, 968, [[0, 0]]],
      [185, 968, [[0, 0]]],
      [186, 968, [[0, 0]]],
      [187, 968, [[0, 0]]],
      [197, 968, [[0, 52]]],
      [455, 968, [[0, 52]]],
      [584, 968, [[0, 52]]],
      [617, 968, [[0, 0]]],
      [618, 968, [[0, 0]]],
      [
        932,
        968,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [944, 968, [[0, 0]]],
      [
        968,
        972,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [88, 184, [[0, 0]]],
      [184, 584, [[0, 0]]],
      [184, 963, [[0, 0]]],
      [184, 972, [[0, 0]]],
      [55, 88, [[0, 0]]],
      [86, 88, [[0, 0]]],
      [87, 88, [[0, 0]]],
      [88, 105, [[0, 0]]],
      [88, 95, [[0, 0]]],
      [88, 454, [[0, 0]]],
      [88, 459, [[0, 0]]],
      [88, 460, [[0, 0]]],
      [88, 463, [[0, 0]]],
      [88, 467, [[0, 0]]],
      [88, 469, [[0, 0]]],
      [88, 474, [[0, 0]]],
      [88, 482, [[0, 0]]],
      [88, 652, [[0, 0]]],
      [88, 929, [[0, 0]]],
      [88, 999, [[0, 0]]],
      [55, 57, [[0, 65]]],
      [55, 200, [[0, 65]]],
      [55, 319, [[0, 3]]],
      [55, 916, [[0, 65]]],
      [57, 584, [[0, 65]]],
      [200, 283, [[0, 65]]],
      [200, 273, [[0, 65]]],
      [200, 274, [[0, 65]]],
      [200, 319, [[0, 3]]],
      [200, 473, [[0, 65]]],
      [200, 875, [[0, 65]]],
      [200, 916, [[0, 99]]],
      [270, 283, [[0, 3]]],
      [271, 283, [[0, 65]]],
      [273, 283, [[0, 65]]],
      [275, 283, [[0, 65]]],
      [277, 283, [[0, 65]]],
      [279, 283, [[0, 65]]],
      [280, 283, [[0, 65]]],
      [270, 287, [[0, 3]]],
      [287, 990, [[0, 3]]],
      [358, 990, [[0, 3]]],
      [271, 274, [[0, 65]]],
      [
        274,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [270, 273, [[0, 3]]],
      [271, 273, [[0, 65]]],
      [273, 287, [[0, 3]]],
      [273, 275, [[0, 65]]],
      [273, 277, [[0, 65]]],
      [273, 280, [[0, 65]]],
      [273, 282, [[0, 65]]],
      [275, 276, [[0, 65]]],
      [275, 277, [[0, 65]]],
      [275, 278, [[0, 65]]],
      [275, 281, [[0, 65]]],
      [276, 277, [[0, 65]]],
      [277, 875, [[0, 65]]],
      [277, 278, [[0, 65]]],
      [278, 584, [[0, 65]]],
      [277, 281, [[0, 65]]],
      [277, 280, [[0, 65]]],
      [278, 280, [[0, 65]]],
      [282, 287, [[0, 3]]],
      [279, 282, [[0, 65]]],
      [282, 990, [[0, 3]]],
      [274, 279, [[0, 65]]],
      [473, 474, [[0, 65]]],
      [197, 473, [[0, 65]]],
      [471, 473, [[0, 65]]],
      [473, 875, [[0, 65]]],
      [473, 929, [[0, 65]]],
      [469, 474, [[0, 65]]],
      [197, 474, [[0, 65]]],
      [474, 875, [[0, 65]]],
      [469, 654, [[0, 3]]],
      [
        469,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        560,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        197,
        471,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        471,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        471,
        946,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [199, 916, [[0, 99]]],
      [273, 916, [[0, 65]]],
      [360, 916, [[0, 3]]],
      [199, 283, [[0, 65]]],
      [199, 273, [[0, 65]]],
      [199, 274, [[0, 65]]],
      [199, 319, [[0, 3]]],
      [199, 360, [[0, 3]]],
      [199, 473, [[0, 65]]],
      [199, 584, [[0, 65]]],
      [199, 741, [[0, 65]]],
      [199, 875, [[0, 65]]],
      [199, 876, [[0, 65]]],
      [137, 741, [[0, 99]]],
      [189, 741, [[0, 99]]],
      [229, 741, [[0, 99]]],
      [358, 741, [[0, 3]]],
      [360, 741, [[0, 3]]],
      [741, 748, [[0, 3]]],
      [741, 754, [[0, 3]]],
      [741, 989, [[0, 99]]],
      [741, 996, [[0, 3]]],
      [137, 358, [[0, 3]]],
      [137, 360, [[0, 3]]],
      [137, 1022, [[0, 99]]],
      [595, 1022, [[0, 3]]],
      [601, 1022, [[0, 3]]],
      [
        619,
        1022,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [620, 1022, [[0, 99]]],
      [
        875,
        1022,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [163, 229, [[0, 3]]],
      [228, 229, [[0, 3]]],
      [229, 360, [[0, 3]]],
      [229, 373, [[0, 3]]],
      [229, 381, [[0, 3]]],
      [229, 387, [[0, 3]]],
      [229, 396, [[0, 3]]],
      [229, 915, [[0, 99]]],
      [229, 951, [[0, 3]]],
      [229, 956, [[0, 99]]],
      [229, 962, [[0, 3]]],
      [163, 360, [[0, 3]]],
      [913, 915, [[0, 99]]],
      [136, 915, [[0, 99]]],
      [137, 915, [[0, 99]]],
      [154, 915, [[0, 99]]],
      [159, 915, [[0, 36]]],
      [165, 915, [[0, 99]]],
      [166, 915, [[0, 99]]],
      [170, 915, [[0, 99]]],
      [238, 915, [[0, 99]]],
      [360, 915, [[0, 3]]],
      [394, 915, [[0, 3]]],
      [396, 915, [[0, 3]]],
      [438, 915, [[0, 3]]],
      [
        584,
        915,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 915, [[0, 99]]],
      [741, 915, [[0, 99]]],
      [
        868,
        915,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        911,
        915,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [915, 920, [[0, 3]]],
      [915, 937, [[0, 99]]],
      [
        915,
        949,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [915, 950, [[0, 99]]],
      [915, 951, [[0, 3]]],
      [915, 957, [[0, 99]]],
      [915, 961, [[0, 99]]],
      [915, 965, [[0, 99]]],
      [
        915,
        967,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [915, 989, [[0, 99]]],
      [
        915,
        1028,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [136, 360, [[0, 3]]],
      [136, 741, [[0, 99]]],
      [136, 986, [[0, 3]]],
      [136, 989, [[0, 99]]],
      [360, 989, [[0, 3]]],
      [394, 989, [[0, 3]]],
      [396, 989, [[0, 3]]],
      [
        560,
        989,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [795, 989, [[0, 99]]],
      [872, 989, [[0, 3]]],
      [741, 795, [[0, 99]]],
      [754, 795, [[0, 3]]],
      [136, 154, [[0, 99]]],
      [154, 360, [[0, 3]]],
      [154, 620, [[0, 99]]],
      [154, 741, [[0, 99]]],
      [154, 950, [[0, 99]]],
      [154, 957, [[0, 99]]],
      [64, 159, [[0, 65]]],
      [60, 159, [[0, 65]]],
      [159, 319, [[0, 3]]],
      [64, 161, [[0, 65]]],
      [155, 161, [[0, 3]]],
      [161, 360, [[0, 3]]],
      [161, 875, [[0, 65]]],
      [161, 876, [[0, 65]]],
      [161, 943, [[0, 3]]],
      [161, 950, [[0, 65]]],
      [161, 1005, [[0, 3]]],
      [155, 239, [[0, 3]]],
      [155, 360, [[0, 3]]],
      [360, 943, [[0, 3]]],
      [60, 61, [[0, 65]]],
      [60, 62, [[0, 65]]],
      [60, 63, [[0, 65]]],
      [60, 158, [[0, 3]]],
      [60, 160, [[0, 65]]],
      [60, 162, [[0, 65]]],
      [60, 360, [[0, 3]]],
      [60, 943, [[0, 3]]],
      [61, 162, [[0, 65]]],
      [156, 162, [[0, 65]]],
      [162, 876, [[0, 65]]],
      [156, 157, [[0, 65]]],
      [157, 905, [[0, 65]]],
      [59, 62, [[0, 65]]],
      [62, 162, [[0, 65]]],
      [59, 162, [[0, 65]]],
      [63, 162, [[0, 65]]],
      [158, 943, [[0, 3]]],
      [155, 160, [[0, 3]]],
      [160, 239, [[0, 3]]],
      [160, 360, [[0, 3]]],
      [160, 875, [[0, 65]]],
      [160, 876, [[0, 65]]],
      [160, 943, [[0, 3]]],
      [160, 950, [[0, 65]]],
      [160, 987, [[0, 65]]],
      [
        981,
        987,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        560,
        981,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [165, 360, [[0, 3]]],
      [165, 751, [[0, 99]]],
      [
        165,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [165, 882, [[0, 27]]],
      [
        584,
        751,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [741, 751, [[0, 99]]],
      [360, 882, [[0, 3]]],
      [370, 882, [[0, 3]]],
      [396, 882, [[0, 3]]],
      [424, 882, [[0, 3]]],
      [
        882,
        933,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [138, 933, [[0, 27]]],
      [138, 139, [[0, 27]]],
      [138, 360, [[0, 3]]],
      [138, 584, [[0, 27]]],
      [138, 741, [[0, 27]]],
      [139, 360, [[0, 3]]],
      [
        139,
        741,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [163, 166, [[0, 3]]],
      [166, 360, [[0, 3]]],
      [166, 850, [[0, 99]]],
      [360, 850, [[0, 3]]],
      [396, 850, [[0, 3]]],
      [407, 850, [[0, 3]]],
      [
        584,
        850,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [741, 850, [[0, 99]]],
      [
        850,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        850,
        901,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        850,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        850,
        987,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        876,
        901,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [894, 901, [[0, 23]]],
      [319, 901, [[0, 3]]],
      [882, 907, [[0, 27]]],
      [
        883,
        907,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [906, 907, [[0, 3]]],
      [238, 907, [[0, 99]]],
      [360, 907, [[0, 3]]],
      [396, 907, [[0, 3]]],
      [
        584,
        907,
        [
          [0, 86],
          [88, 88],
          [97, 99]
        ]
      ],
      [
        835,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        838,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        836,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        839,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        841,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        840,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [842, 907, [[0, 99]]],
      [
        843,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        844,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        846,
        907,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        847,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        849,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [851, 907, [[0, 99]]],
      [
        852,
        907,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        854,
        907,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        855,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        857,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        859,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        860,
        907,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        861,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        862,
        907,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [907, 978, [[0, 3]]],
      [360, 883, [[0, 3]]],
      [396, 883, [[0, 3]]],
      [
        835,
        883,
        [
          [0, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [
        846,
        883,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        860,
        883,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [360, 835, [[0, 3]]],
      [360, 846, [[0, 3]]],
      [396, 846, [[0, 3]]],
      [
        584,
        846,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [360, 860, [[0, 3]]],
      [399, 860, [[0, 3]]],
      [404, 860, [[0, 3]]],
      [
        860,
        868,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        860,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [860, 882, [[0, 27]]],
      [860, 962, [[0, 3]]],
      [360, 868, [[0, 3]]],
      [396, 868, [[0, 3]]],
      [
        584,
        868,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        867,
        868,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        868,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [868, 882, [[0, 27]]],
      [868, 933, [[0, 27]]],
      [868, 962, [[0, 3]]],
      [
        867,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [236, 238, [[0, 99]]],
      [238, 358, [[0, 3]]],
      [238, 319, [[0, 3]]],
      [238, 360, [[0, 3]]],
      [238, 320, [[0, 3]]],
      [238, 368, [[0, 3]]],
      [238, 403, [[0, 3]]],
      [238, 404, [[0, 3]]],
      [
        238,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [238, 942, [[0, 3]]],
      [238, 962, [[0, 3]]],
      [238, 978, [[0, 3]]],
      [236, 314, [[0, 3]]],
      [236, 319, [[0, 3]]],
      [236, 368, [[0, 3]]],
      [236, 381, [[0, 3]]],
      [236, 396, [[0, 3]]],
      [236, 404, [[0, 3]]],
      [236, 437, [[0, 3]]],
      [236, 915, [[0, 99]]],
      [
        236,
        949,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [236, 962, [[0, 3]]],
      [236, 986, [[0, 3]]],
      [236, 1005, [[0, 3]]],
      [360, 838, [[0, 3]]],
      [396, 838, [[0, 3]]],
      [360, 836, [[0, 3]]],
      [396, 836, [[0, 3]]],
      [360, 839, [[0, 3]]],
      [396, 839, [[0, 3]]],
      [360, 841, [[0, 3]]],
      [396, 841, [[0, 3]]],
      [360, 840, [[0, 3]]],
      [396, 840, [[0, 3]]],
      [
        842,
        858,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [49, 842, [[0, 27]]],
      [235, 842, [[0, 3]]],
      [360, 842, [[0, 3]]],
      [396, 842, [[0, 3]]],
      [
        471,
        842,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [477, 842, [[0, 99]]],
      [842, 882, [[0, 27]]],
      [842, 929, [[0, 99]]],
      [235, 858, [[0, 3]]],
      [360, 858, [[0, 3]]],
      [
        858,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        858,
        930,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [49, 882, [[0, 27]]],
      [360, 477, [[0, 3]]],
      [396, 477, [[0, 3]]],
      [
        457,
        477,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [477, 620, [[0, 99]]],
      [439, 457, [[0, 31]]],
      [
        457,
        911,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [197, 439, [[0, 31]]],
      [439, 441, [[0, 31]]],
      [439, 453, [[0, 31]]],
      [439, 456, [[0, 31]]],
      [439, 464, [[0, 31]]],
      [439, 465, [[0, 31]]],
      [439, 929, [[0, 31]]],
      [439, 946, [[0, 31]]],
      [440, 441, [[0, 31]]],
      [441, 456, [[0, 31]]],
      [440, 456, [[0, 31]]],
      [440, 471, [[0, 31]]],
      [440, 584, [[0, 31]]],
      [440, 927, [[0, 31]]],
      [197, 456, [[0, 31]]],
      [456, 471, [[0, 31]]],
      [456, 927, [[0, 31]]],
      [197, 453, [[0, 31]]],
      [453, 456, [[0, 31]]],
      [453, 464, [[0, 31]]],
      [453, 929, [[0, 31]]],
      [464, 875, [[0, 31]]],
      [197, 465, [[0, 31]]],
      [449, 465, [[0, 31]]],
      [451, 465, [[0, 31]]],
      [465, 468, [[0, 31]]],
      [448, 449, [[0, 31]]],
      [449, 450, [[0, 31]]],
      [449, 452, [[0, 31]]],
      [449, 464, [[0, 31]]],
      [449, 468, [[0, 31]]],
      [448, 464, [[0, 31]]],
      [448, 468, [[0, 31]]],
      [197, 468, [[0, 31]]],
      [468, 471, [[0, 31]]],
      [468, 927, [[0, 31]]],
      [468, 929, [[0, 31]]],
      [468, 946, [[0, 31]]],
      [450, 468, [[0, 31]]],
      [197, 452, [[0, 31]]],
      [452, 581, [[0, 31]]],
      [123, 451, [[0, 31]]],
      [360, 843, [[0, 3]]],
      [396, 843, [[0, 3]]],
      [360, 844, [[0, 3]]],
      [396, 844, [[0, 3]]],
      [360, 847, [[0, 3]]],
      [396, 847, [[0, 3]]],
      [360, 849, [[0, 3]]],
      [396, 849, [[0, 3]]],
      [170, 851, [[0, 99]]],
      [171, 851, [[0, 99]]],
      [360, 851, [[0, 3]]],
      [396, 851, [[0, 3]]],
      [
        560,
        851,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 851, [[0, 99]]],
      [851, 950, [[0, 99]]],
      [
        851,
        981,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [851, 989, [[0, 99]]],
      [170, 360, [[0, 3]]],
      [170, 595, [[0, 3]]],
      [170, 594, [[0, 3]]],
      [170, 601, [[0, 3]]],
      [170, 751, [[0, 99]]],
      [170, 950, [[0, 99]]],
      [
        170,
        987,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [594, 601, [[0, 3]]],
      [
        167,
        171,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [169, 171, [[0, 3]]],
      [171, 172, [[0, 3]]],
      [171, 197, [[0, 3]]],
      [171, 360, [[0, 3]]],
      [
        171,
        560,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        171,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [171, 929, [[0, 99]]],
      [167, 360, [[0, 3]]],
      [
        167,
        470,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        167,
        560,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        470,
        560,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [169, 360, [[0, 3]]],
      [172, 360, [[0, 3]]],
      [360, 852, [[0, 3]]],
      [396, 852, [[0, 3]]],
      [
        584,
        852,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [360, 854, [[0, 3]]],
      [404, 854, [[0, 3]]],
      [
        854,
        867,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        854,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [854, 962, [[0, 3]]],
      [360, 855, [[0, 3]]],
      [396, 855, [[0, 3]]],
      [360, 857, [[0, 3]]],
      [396, 857, [[0, 3]]],
      [360, 859, [[0, 3]]],
      [396, 859, [[0, 3]]],
      [360, 861, [[0, 3]]],
      [396, 861, [[0, 3]]],
      [360, 862, [[0, 3]]],
      [396, 862, [[0, 3]]],
      [228, 920, [[0, 3]]],
      [
        175,
        937,
        [
          [0, 87],
          [89, 99]
        ]
      ],
      [189, 937, [[0, 99]]],
      [
        560,
        937,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [595, 937, [[0, 3]]],
      [601, 937, [[0, 3]]],
      [654, 937, [[0, 3]]],
      [
        741,
        937,
        [
          [0, 87],
          [89, 99]
        ]
      ],
      [
        875,
        937,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [936, 937, [[0, 99]]],
      [
        937,
        940,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [937, 950, [[0, 99]]],
      [937, 986, [[0, 3]]],
      [175, 360, [[0, 3]]],
      [
        175,
        856,
        [
          [0, 87],
          [89, 99]
        ]
      ],
      [
        175,
        876,
        [
          [0, 87],
          [89, 91],
          [97, 99]
        ]
      ],
      [175, 962, [[0, 3]]],
      [
        50,
        856,
        [
          [0, 87],
          [89, 99]
        ]
      ],
      [360, 856, [[0, 3]]],
      [396, 856, [[0, 3]]],
      [
        856,
        876,
        [
          [0, 87],
          [89, 91],
          [97, 99]
        ]
      ],
      [856, 882, [[0, 27]]],
      [
        856,
        907,
        [
          [0, 86],
          [89, 90],
          [97, 99]
        ]
      ],
      [856, 962, [[0, 3]]],
      [
        50,
        937,
        [
          [0, 87],
          [89, 99]
        ]
      ],
      [148, 936, [[0, 99]]],
      [224, 936, [[0, 3]]],
      [360, 936, [[0, 3]]],
      [539, 936, [[0, 99]]],
      [540, 936, [[0, 3]]],
      [547, 936, [[0, 99]]],
      [548, 936, [[0, 3]]],
      [
        551,
        936,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        560,
        936,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        584,
        936,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 936, [[0, 99]]],
      [741, 936, [[0, 99]]],
      [879, 936, [[0, 99]]],
      [
        911,
        936,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        936,
        983,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [936, 986, [[0, 3]]],
      [936, 992, [[0, 3]]],
      [148, 360, [[0, 3]]],
      [148, 539, [[0, 99]]],
      [148, 547, [[0, 99]]],
      [
        148,
        551,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        148,
        584,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        148,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [148, 986, [[0, 3]]],
      [360, 539, [[0, 3]]],
      [539, 540, [[0, 3]]],
      [
        539,
        583,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [539, 620, [[0, 99]]],
      [539, 741, [[0, 99]]],
      [539, 986, [[0, 3]]],
      [
        583,
        584,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [360, 547, [[0, 3]]],
      [547, 548, [[0, 3]]],
      [
        547,
        583,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [547, 620, [[0, 99]]],
      [547, 741, [[0, 99]]],
      [547, 986, [[0, 3]]],
      [360, 551, [[0, 3]]],
      [
        551,
        583,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        551,
        584,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        551,
        613,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [551, 971, [[0, 12]]],
      [551, 986, [[0, 3]]],
      [
        613,
        619,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [613, 971, [[0, 12]]],
      [224, 360, [[0, 3]]],
      [224, 986, [[0, 3]]],
      [224, 1005, [[0, 3]]],
      [983, 992, [[0, 3]]],
      [540, 983, [[0, 3]]],
      [548, 983, [[0, 3]]],
      [
        560,
        983,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [224, 992, [[0, 3]]],
      [228, 992, [[0, 3]]],
      [540, 992, [[0, 3]]],
      [548, 992, [[0, 3]]],
      [
        560,
        940,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        584,
        940,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [907, 961, [[0, 99]]],
      [360, 965, [[0, 3]]],
      [396, 965, [[0, 3]]],
      [620, 965, [[0, 99]]],
      [741, 965, [[0, 99]]],
      [
        876,
        965,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [965, 986, [[0, 3]]],
      [
        584,
        967,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [360, 1028, [[0, 3]]],
      [
        949,
        1028,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [313, 956, [[0, 3]]],
      [360, 956, [[0, 3]]],
      [599, 956, [[0, 3]]],
      [620, 956, [[0, 99]]],
      [741, 956, [[0, 99]]],
      [752, 956, [[0, 99]]],
      [915, 956, [[0, 99]]],
      [956, 986, [[0, 3]]],
      [956, 1005, [[0, 3]]],
      [599, 752, [[0, 3]]],
      [741, 752, [[0, 99]]],
      [358, 996, [[0, 3]]],
      [86, 443, [[0, 0]]],
      [443, 454, [[0, 0]]],
      [443, 463, [[0, 0]]],
      [443, 470, [[0, 0]]],
      [443, 472, [[0, 0]]],
      [443, 474, [[0, 0]]],
      [442, 443, [[0, 0]]],
      [443, 444, [[0, 0]]],
      [443, 445, [[0, 0]]],
      [443, 446, [[0, 0]]],
      [443, 447, [[0, 0]]],
      [443, 929, [[0, 0]]],
      [
        454,
        469,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        454,
        470,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        454,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [454, 952, [[0, 99]]],
      [
        454,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        454,
        1000,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        875,
        1000,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        999,
        1000,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [463, 469, [[0, 0]]],
      [463, 470, [[0, 0]]],
      [463, 471, [[0, 0]]],
      [463, 474, [[0, 0]]],
      [463, 475, [[0, 0]]],
      [463, 476, [[0, 0]]],
      [463, 478, [[0, 0]]],
      [463, 481, [[0, 0]]],
      [463, 482, [[0, 0]]],
      [458, 463, [[0, 0]]],
      [461, 463, [[0, 0]]],
      [197, 463, [[0, 0]]],
      [463, 597, [[0, 0]]],
      [463, 599, [[0, 0]]],
      [463, 610, [[0, 0]]],
      [463, 620, [[0, 0]]],
      [463, 652, [[0, 0]]],
      [463, 875, [[0, 0]]],
      [463, 876, [[0, 0]]],
      [463, 911, [[0, 0]]],
      [463, 915, [[0, 0]]],
      [463, 929, [[0, 0]]],
      [463, 949, [[0, 0]]],
      [463, 950, [[0, 0]]],
      [463, 981, [[0, 0]]],
      [463, 1005, [[0, 0]]],
      [475, 476, [[0, 0]]],
      [360, 475, [[0, 0]]],
      [360, 476, [[0, 0]]],
      [476, 986, [[0, 0]]],
      [476, 478, [[0, 0]]],
      [360, 478, [[0, 0]]],
      [478, 538, [[0, 0]]],
      [478, 539, [[0, 0]]],
      [478, 540, [[0, 0]]],
      [478, 986, [[0, 0]]],
      [535, 538, [[0, 9]]],
      [538, 540, [[0, 3]]],
      [
        197,
        538,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [230, 538, [[0, 3]]],
      [231, 538, [[0, 3]]],
      [314, 538, [[0, 3]]],
      [319, 538, [[0, 3]]],
      [396, 538, [[0, 3]]],
      [
        538,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [538, 986, [[0, 3]]],
      [
        538,
        989,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [538, 1005, [[0, 3]]],
      [197, 535, [[0, 9]]],
      [471, 535, [[0, 9]]],
      [535, 561, [[0, 9]]],
      [535, 562, [[0, 9]]],
      [535, 875, [[0, 9]]],
      [535, 1005, [[0, 3]]],
      [469, 481, [[0, 0]]],
      [469, 482, [[0, 0]]],
      [482, 562, [[0, 0]]],
      [482, 914, [[0, 0]]],
      [482, 999, [[0, 0]]],
      [482, 1000, [[0, 0]]],
      [
        560,
        914,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        561,
        914,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        562,
        914,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [654, 914, [[0, 3]]],
      [
        875,
        914,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        914,
        955,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        914,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        914,
        1000,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        560,
        955,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        955,
        999,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [458, 599, [[0, 0]]],
      [461, 471, [[0, 0]]],
      [461, 599, [[0, 0]]],
      [461, 928, [[0, 0]]],
      [471, 928, [[0, 0]]],
      [560, 928, [[0, 0]]],
      [592, 928, [[0, 0]]],
      [875, 928, [[0, 0]]],
      [597, 601, [[0, 3]]],
      [584, 610, [[0, 0]]],
      [610, 611, [[0, 0]]],
      [610, 620, [[0, 0]]],
      [610, 654, [[0, 0]]],
      [610, 905, [[0, 0]]],
      [610, 911, [[0, 0]]],
      [469, 652, [[0, 0]]],
      [474, 652, [[0, 0]]],
      [652, 654, [[0, 0]]],
      [652, 890, [[0, 0]]],
      [652, 914, [[0, 0]]],
      [885, 890, [[0, 3]]],
      [886, 890, [[0, 3]]],
      [887, 890, [[0, 3]]],
      [888, 890, [[0, 3]]],
      [889, 890, [[0, 3]]],
      [890, 891, [[0, 3]]],
      [
        890,
        892,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [890, 975, [[0, 3]]],
      [654, 885, [[0, 3]]],
      [885, 975, [[0, 3]]],
      [654, 886, [[0, 3]]],
      [886, 975, [[0, 3]]],
      [654, 887, [[0, 3]]],
      [887, 975, [[0, 3]]],
      [654, 888, [[0, 3]]],
      [654, 889, [[0, 3]]],
      [891, 975, [[0, 3]]],
      [454, 472, [[0, 0]]],
      [469, 472, [[0, 0]]],
      [470, 472, [[0, 0]]],
      [472, 473, [[0, 0]]],
      [472, 474, [[0, 0]]],
      [442, 470, [[0, 0]]],
      [442, 473, [[0, 0]]],
      [444, 470, [[0, 0]]],
      [16, 444, [[0, 0]]],
      [16, 210, [[0, 0]]],
      [210, 875, [[0, 0]]],
      [445, 470, [[0, 0]]],
      [446, 470, [[0, 0]]],
      [447, 470, [[0, 0]]],
      [87, 467, [[0, 0]]],
      [87, 469, [[0, 0]]],
      [87, 472, [[0, 0]]],
      [87, 480, [[0, 0]]],
      [87, 929, [[0, 0]]],
      [467, 469, [[0, 0]]],
      [467, 482, [[0, 0]]],
      [470, 480, [[0, 0]]],
      [105, 106, [[0, 0]]],
      [105, 107, [[0, 0]]],
      [105, 108, [[0, 0]]],
      [105, 999, [[0, 0]]],
      [105, 1000, [[0, 0]]],
      [16, 106, [[0, 0]]],
      [106, 999, [[0, 0]]],
      [106, 1000, [[0, 0]]],
      [107, 999, [[0, 0]]],
      [107, 1000, [[0, 0]]],
      [108, 584, [[0, 0]]],
      [108, 938, [[0, 0]]],
      [108, 999, [[0, 0]]],
      [108, 1000, [[0, 0]]],
      [
        938,
        971,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [94, 95, [[0, 0]]],
      [94, 968, [[0, 0]]],
      [459, 479, [[0, 0]]],
      [459, 990, [[0, 0]]],
      [479, 990, [[0, 0]]],
      [460, 481, [[0, 0]]],
      [952, 963, [[0, 0]]],
      [963, 968, [[0, 0]]],
      [
        560,
        972,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        620,
        972,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        911,
        972,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [932, 972, [[0, 99]]],
      [90, 185, [[0, 0]]],
      [185, 952, [[0, 0]]],
      [185, 972, [[0, 0]]],
      [55, 90, [[0, 0]]],
      [74, 90, [[0, 0]]],
      [77, 90, [[0, 0]]],
      [72, 90, [[0, 0]]],
      [90, 105, [[0, 0]]],
      [90, 95, [[0, 0]]],
      [90, 178, [[0, 0]]],
      [90, 179, [[0, 0]]],
      [90, 180, [[0, 0]]],
      [90, 183, [[0, 0]]],
      [90, 932, [[0, 0]]],
      [90, 937, [[0, 0]]],
      [90, 952, [[0, 0]]],
      [90, 999, [[0, 0]]],
      [74, 78, [[0, 0]]],
      [74, 75, [[0, 0]]],
      [74, 178, [[0, 0]]],
      [74, 997, [[0, 0]]],
      [74, 998, [[0, 0]]],
      [74, 999, [[0, 0]]],
      [74, 1000, [[0, 0]]],
      [78, 178, [[0, 0]]],
      [178, 182, [[0, 0]]],
      [178, 620, [[0, 0]]],
      [178, 937, [[0, 0]]],
      [178, 940, [[0, 0]]],
      [178, 952, [[0, 0]]],
      [178, 997, [[0, 0]]],
      [178, 998, [[0, 0]]],
      [182, 937, [[0, 0]]],
      [952, 997, [[0, 0]]],
      [997, 999, [[0, 0]]],
      [997, 1000, [[0, 0]]],
      [952, 998, [[0, 0]]],
      [75, 76, [[0, 0]]],
      [76, 79, [[0, 0]]],
      [76, 80, [[0, 0]]],
      [76, 620, [[0, 0]]],
      [76, 911, [[0, 0]]],
      [76, 937, [[0, 0]]],
      [76, 952, [[0, 0]]],
      [76, 998, [[0, 0]]],
      [79, 911, [[0, 0]]],
      [79, 952, [[0, 0]]],
      [80, 937, [[0, 0]]],
      [80, 952, [[0, 0]]],
      [77, 178, [[0, 0]]],
      [72, 181, [[0, 0]]],
      [72, 584, [[0, 0]]],
      [72, 968, [[0, 0]]],
      [181, 584, [[0, 0]]],
      [178, 179, [[0, 0]]],
      [179, 560, [[0, 0]]],
      [179, 584, [[0, 0]]],
      [179, 597, [[0, 0]]],
      [179, 611, [[0, 0]]],
      [179, 620, [[0, 0]]],
      [179, 875, [[0, 0]]],
      [179, 905, [[0, 0]]],
      [179, 911, [[0, 0]]],
      [179, 914, [[0, 0]]],
      [179, 915, [[0, 0]]],
      [179, 937, [[0, 0]]],
      [179, 949, [[0, 0]]],
      [179, 952, [[0, 0]]],
      [179, 981, [[0, 0]]],
      [179, 999, [[0, 0]]],
      [179, 1000, [[0, 0]]],
      [179, 1005, [[0, 0]]],
      [73, 180, [[0, 0]]],
      [73, 952, [[0, 0]]],
      [178, 183, [[0, 0]]],
      [183, 914, [[0, 0]]],
      [183, 952, [[0, 0]]],
      [183, 999, [[0, 0]]],
      [183, 1000, [[0, 0]]],
      [91, 186, [[0, 0]]],
      [186, 934, [[0, 0]]],
      [186, 972, [[0, 0]]],
      [12, 91, [[0, 0]]],
      [91, 98, [[0, 0]]],
      [91, 99, [[0, 0]]],
      [91, 95, [[0, 0]]],
      [91, 164, [[0, 0]]],
      [91, 197, [[0, 0]]],
      [91, 206, [[0, 0]]],
      [91, 584, [[0, 0]]],
      [91, 927, [[0, 0]]],
      [91, 945, [[0, 0]]],
      [91, 946, [[0, 0]]],
      [91, 979, [[0, 0]]],
      [91, 1004, [[0, 0]]],
      [12, 13, [[0, 0]]],
      [12, 188, [[0, 0]]],
      [12, 584, [[0, 0]]],
      [12, 979, [[0, 0]]],
      [12, 1004, [[0, 0]]],
      [13, 979, [[0, 0]]],
      [188, 979, [[0, 0]]],
      [
        979,
        1004,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [97, 98, [[0, 0]]],
      [98, 934, [[0, 0]]],
      [97, 934, [[0, 0]]],
      [99, 945, [[0, 0]]],
      [197, 945, [[0, 65]]],
      [471, 945, [[0, 65]]],
      [875, 945, [[0, 65]]],
      [164, 168, [[0, 52]]],
      [164, 484, [[0, 52]]],
      [164, 601, [[0, 3]]],
      [164, 946, [[0, 52]]],
      [168, 360, [[0, 3]]],
      [168, 597, [[0, 3]]],
      [168, 601, [[0, 3]]],
      [168, 741, [[0, 52]]],
      [168, 915, [[0, 52]]],
      [168, 949, [[0, 52]]],
      [197, 484, [[0, 52]]],
      [471, 484, [[0, 52]]],
      [484, 946, [[0, 52]]],
      [206, 979, [[0, 0]]],
      [92, 187, [[0, 0]]],
      [93, 187, [[0, 0]]],
      [187, 584, [[0, 0]]],
      [187, 972, [[0, 0]]],
      [92, 103, [[0, 0]]],
      [12, 92, [[0, 0]]],
      [13, 92, [[0, 0]]],
      [66, 92, [[0, 0]]],
      [84, 92, [[0, 0]]],
      [92, 104, [[0, 0]]],
      [92, 95, [[0, 0]]],
      [92, 206, [[0, 0]]],
      [92, 595, [[0, 0]]],
      [92, 597, [[0, 0]]],
      [92, 600, [[0, 0]]],
      [92, 915, [[0, 0]]],
      [92, 918, [[0, 0]]],
      [92, 932, [[0, 0]]],
      [92, 947, [[0, 0]]],
      [92, 949, [[0, 0]]],
      [92, 957, [[0, 0]]],
      [92, 966, [[0, 0]]],
      [92, 976, [[0, 0]]],
      [92, 979, [[0, 0]]],
      [10, 103, [[0, 0]]],
      [12, 103, [[0, 0]]],
      [13, 103, [[0, 0]]],
      [66, 103, [[0, 0]]],
      [103, 206, [[0, 0]]],
      [103, 597, [[0, 0]]],
      [103, 915, [[0, 0]]],
      [103, 947, [[0, 0]]],
      [103, 949, [[0, 0]]],
      [103, 957, [[0, 0]]],
      [103, 979, [[0, 0]]],
      [10, 947, [[0, 0]]],
      [947, 949, [[0, 0]]],
      [584, 947, [[0, 0]]],
      [947, 979, [[0, 0]]],
      [66, 209, [[0, 0]]],
      [66, 787, [[0, 0]]],
      [66, 873, [[0, 0]]],
      [66, 961, [[0, 0]]],
      [209, 360, [[0, 3]]],
      [209, 584, [[0, 16]]],
      [358, 787, [[0, 0]]],
      [360, 787, [[0, 0]]],
      [787, 789, [[0, 0]]],
      [787, 790, [[0, 0]]],
      [787, 793, [[0, 0]]],
      [787, 800, [[0, 0]]],
      [787, 817, [[0, 0]]],
      [787, 865, [[0, 0]]],
      [787, 872, [[0, 0]]],
      [787, 961, [[0, 0]]],
      [787, 977, [[0, 0]]],
      [787, 978, [[0, 0]]],
      [788, 789, [[0, 0]]],
      [360, 789, [[0, 0]]],
      [789, 794, [[0, 0]]],
      [789, 977, [[0, 0]]],
      [315, 788, [[0, 0]]],
      [584, 794, [[0, 0]]],
      [794, 949, [[0, 0]]],
      [786, 790, [[0, 0]]],
      [790, 791, [[0, 0]]],
      [360, 790, [[0, 0]]],
      [741, 790, [[0, 0]]],
      [755, 790, [[0, 0]]],
      [756, 790, [[0, 0]]],
      [790, 803, [[0, 0]]],
      [790, 936, [[0, 0]]],
      [790, 942, [[0, 0]]],
      [790, 977, [[0, 0]]],
      [790, 986, [[0, 0]]],
      [786, 792, [[0, 0]]],
      [360, 786, [[0, 0]]],
      [741, 786, [[0, 0]]],
      [786, 794, [[0, 0]]],
      [786, 796, [[0, 0]]],
      [786, 797, [[0, 0]]],
      [360, 792, [[0, 0]]],
      [139, 796, [[0, 0]]],
      [330, 796, [[0, 0]]],
      [358, 796, [[0, 0]]],
      [314, 796, [[0, 0]]],
      [319, 796, [[0, 0]]],
      [320, 796, [[0, 0]]],
      [368, 796, [[0, 0]]],
      [323, 796, [[0, 0]]],
      [620, 796, [[0, 0]]],
      [741, 796, [[0, 0]]],
      [743, 796, [[0, 0]]],
      [744, 796, [[0, 0]]],
      [745, 796, [[0, 0]]],
      [749, 796, [[0, 0]]],
      [750, 796, [[0, 0]]],
      [756, 796, [[0, 0]]],
      [796, 801, [[0, 0]]],
      [796, 876, [[0, 0]]],
      [796, 941, [[0, 0]]],
      [796, 942, [[0, 0]]],
      [139, 743, [[0, 0]]],
      [391, 743, [[0, 0]]],
      [741, 743, [[0, 0]]],
      [326, 744, [[0, 0]]],
      [330, 744, [[0, 0]]],
      [358, 744, [[0, 0]]],
      [314, 744, [[0, 0]]],
      [323, 744, [[0, 0]]],
      [391, 744, [[0, 0]]],
      [741, 744, [[0, 0]]],
      [744, 1005, [[0, 0]]],
      [314, 745, [[0, 0]]],
      [744, 745, [[0, 0]]],
      [745, 749, [[0, 0]]],
      [745, 756, [[0, 0]]],
      [317, 801, [[0, 0]]],
      [319, 801, [[0, 0]]],
      [391, 801, [[0, 0]]],
      [797, 876, [[0, 0]]],
      [797, 941, [[0, 0]]],
      [797, 942, [[0, 0]]],
      [791, 792, [[0, 0]]],
      [360, 791, [[0, 0]]],
      [791, 794, [[0, 0]]],
      [791, 796, [[0, 0]]],
      [791, 797, [[0, 0]]],
      [360, 755, [[0, 0]]],
      [755, 756, [[0, 0]]],
      [358, 803, [[0, 0]]],
      [803, 942, [[0, 0]]],
      [803, 1005, [[0, 0]]],
      [786, 793, [[0, 0]]],
      [741, 793, [[0, 0]]],
      [755, 793, [[0, 0]]],
      [782, 793, [[0, 0]]],
      [793, 798, [[0, 0]]],
      [793, 800, [[0, 0]]],
      [793, 865, [[0, 0]]],
      [619, 782, [[0, 0]]],
      [782, 926, [[0, 0]]],
      [139, 798, [[0, 0]]],
      [360, 798, [[0, 0]]],
      [741, 798, [[0, 0]]],
      [755, 798, [[0, 0]]],
      [756, 798, [[0, 0]]],
      [759, 798, [[0, 0]]],
      [800, 978, [[0, 0]]],
      [806, 865, [[0, 0]]],
      [808, 865, [[0, 0]]],
      [809, 865, [[0, 0]]],
      [810, 865, [[0, 0]]],
      [811, 865, [[0, 0]]],
      [812, 865, [[0, 0]]],
      [816, 865, [[0, 0]]],
      [817, 865, [[0, 0]]],
      [818, 865, [[0, 0]]],
      [819, 865, [[0, 0]]],
      [820, 865, [[0, 0]]],
      [821, 865, [[0, 0]]],
      [825, 865, [[0, 0]]],
      [824, 865, [[0, 0]]],
      [826, 865, [[0, 0]]],
      [5, 865, [[0, 0]]],
      [7, 865, [[0, 0]]],
      [8, 865, [[0, 0]]],
      [17, 865, [[0, 0]]],
      [51, 865, [[0, 0]]],
      [52, 865, [[0, 0]]],
      [53, 865, [[0, 0]]],
      [70, 865, [[0, 0]]],
      [71, 865, [[0, 0]]],
      [82, 865, [[0, 0]]],
      [115, 865, [[0, 0]]],
      [763, 865, [[0, 0]]],
      [806, 978, [[0, 0]]],
      [807, 808, [[0, 0]]],
      [808, 978, [[0, 0]]],
      [396, 807, [[0, 0]]],
      [809, 832, [[0, 0]]],
      [396, 809, [[0, 0]]],
      [809, 978, [[0, 0]]],
      [832, 978, [[0, 0]]],
      [810, 978, [[0, 0]]],
      [811, 848, [[0, 0]]],
      [811, 876, [[0, 0]]],
      [811, 978, [[0, 0]]],
      [811, 986, [[0, 0]]],
      [360, 848, [[0, 0]]],
      [848, 870, [[0, 0]]],
      [848, 950, [[0, 0]]],
      [848, 986, [[0, 0]]],
      [560, 870, [[0, 0]]],
      [870, 875, [[0, 0]]],
      [870, 876, [[0, 0]]],
      [812, 813, [[0, 0]]],
      [812, 814, [[0, 0]]],
      [812, 815, [[0, 0]]],
      [812, 827, [[0, 0]]],
      [812, 978, [[0, 0]]],
      [813, 832, [[0, 0]]],
      [47, 813, [[0, 0]]],
      [358, 813, [[0, 0]]],
      [396, 813, [[0, 0]]],
      [813, 978, [[0, 0]]],
      [47, 48, [[0, 0]]],
      [47, 358, [[0, 0]]],
      [48, 358, [[0, 0]]],
      [814, 832, [[0, 0]]],
      [404, 814, [[0, 0]]],
      [814, 978, [[0, 0]]],
      [815, 832, [[0, 0]]],
      [815, 978, [[0, 0]]],
      [804, 827, [[0, 0]]],
      [805, 827, [[0, 0]]],
      [827, 978, [[0, 0]]],
      [804, 978, [[0, 0]]],
      [584, 805, [[0, 0]]],
      [805, 978, [[0, 0]]],
      [816, 832, [[0, 0]]],
      [816, 978, [[0, 0]]],
      [310, 817, [[0, 0]]],
      [317, 817, [[0, 0]]],
      [319, 817, [[0, 0]]],
      [396, 817, [[0, 0]]],
      [741, 817, [[0, 0]]],
      [801, 817, [[0, 0]]],
      [817, 869, [[0, 0]]],
      [817, 978, [[0, 0]]],
      [360, 869, [[0, 0]]],
      [396, 869, [[0, 0]]],
      [818, 978, [[0, 0]]],
      [819, 833, [[0, 0]]],
      [319, 819, [[0, 0]]],
      [819, 876, [[0, 0]]],
      [819, 882, [[0, 0]]],
      [833, 908, [[0, 0]]],
      [875, 908, [[0, 65]]],
      [396, 820, [[0, 0]]],
      [820, 962, [[0, 0]]],
      [820, 978, [[0, 0]]],
      [820, 989, [[0, 0]]],
      [471, 821, [[0, 0]]],
      [821, 822, [[0, 0]]],
      [821, 823, [[0, 0]]],
      [821, 827, [[0, 0]]],
      [821, 978, [[0, 0]]],
      [822, 832, [[0, 0]]],
      [620, 822, [[0, 0]]],
      [822, 978, [[0, 0]]],
      [823, 828, [[0, 0]]],
      [823, 832, [[0, 0]]],
      [823, 834, [[0, 0]]],
      [823, 863, [[0, 0]]],
      [823, 864, [[0, 0]]],
      [823, 929, [[0, 0]]],
      [823, 978, [[0, 0]]],
      [828, 829, [[0, 0]]],
      [828, 845, [[0, 0]]],
      [829, 830, [[0, 0]]],
      [829, 831, [[0, 0]]],
      [465, 830, [[0, 0]]],
      [473, 831, [[0, 0]]],
      [741, 845, [[0, 0]]],
      [758, 845, [[0, 0]]],
      [360, 758, [[0, 3]]],
      [834, 929, [[0, 0]]],
      [834, 946, [[0, 0]]],
      [197, 863, [[0, 0]]],
      [620, 863, [[0, 0]]],
      [863, 875, [[0, 0]]],
      [863, 929, [[0, 0]]],
      [863, 978, [[0, 0]]],
      [469, 864, [[0, 0]]],
      [482, 864, [[0, 0]]],
      [539, 864, [[0, 0]]],
      [834, 864, [[0, 0]]],
      [145, 825, [[0, 0]]],
      [825, 978, [[0, 0]]],
      [
        140,
        145,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        143,
        145,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        144,
        145,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        145,
        149,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        145,
        151,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [145, 153, [[0, 0]]],
      [145, 360, [[0, 0]]],
      [145, 466, [[0, 0]]],
      [145, 741, [[0, 0]]],
      [145, 802, [[0, 0]]],
      [145, 915, [[0, 0]]],
      [145, 950, [[0, 0]]],
      [145, 989, [[0, 0]]],
      [140, 358, [[0, 0]]],
      [140, 360, [[0, 0]]],
      [141, 143, [[0, 0]]],
      [143, 147, [[0, 0]]],
      [143, 360, [[0, 0]]],
      [143, 584, [[0, 0]]],
      [143, 620, [[0, 0]]],
      [143, 741, [[0, 0]]],
      [141, 620, [[0, 0]]],
      [141, 741, [[0, 0]]],
      [141, 147, [[0, 0]]],
      [147, 360, [[0, 0]]],
      [147, 741, [[0, 0]]],
      [144, 319, [[0, 0]]],
      [144, 466, [[0, 0]]],
      [144, 932, [[0, 0]]],
      [197, 466, [[0, 0]]],
      [360, 466, [[0, 0]]],
      [458, 466, [[0, 0]]],
      [461, 466, [[0, 0]]],
      [466, 483, [[0, 0]]],
      [466, 911, [[0, 0]]],
      [466, 950, [[0, 0]]],
      [466, 987, [[0, 0]]],
      [483, 560, [[0, 0]]],
      [483, 875, [[0, 0]]],
      [147, 149, [[0, 0]]],
      [149, 150, [[0, 0]]],
      [149, 153, [[0, 0]]],
      [136, 149, [[0, 0]]],
      [149, 360, [[0, 0]]],
      [136, 150, [[0, 0]]],
      [150, 360, [[0, 0]]],
      [150, 620, [[0, 0]]],
      [150, 876, [[0, 0]]],
      [150, 932, [[0, 0]]],
      [150, 994, [[0, 0]]],
      [360, 994, [[0, 3]]],
      [153, 360, [[0, 0]]],
      [153, 584, [[0, 0]]],
      [153, 741, [[0, 0]]],
      [153, 949, [[0, 0]]],
      [153, 967, [[0, 0]]],
      [153, 989, [[0, 0]]],
      [153, 994, [[0, 0]]],
      [142, 151, [[0, 0]]],
      [146, 151, [[0, 0]]],
      [151, 152, [[0, 0]]],
      [151, 154, [[0, 0]]],
      [151, 360, [[0, 0]]],
      [142, 153, [[0, 0]]],
      [142, 360, [[0, 0]]],
      [142, 584, [[0, 0]]],
      [142, 741, [[0, 0]]],
      [142, 876, [[0, 0]]],
      [141, 146, [[0, 0]]],
      [146, 358, [[0, 0]]],
      [146, 360, [[0, 0]]],
      [146, 397, [[0, 0]]],
      [146, 741, [[0, 0]]],
      [146, 989, [[0, 0]]],
      [152, 360, [[0, 0]]],
      [152, 620, [[0, 0]]],
      [152, 741, [[0, 0]]],
      [152, 876, [[0, 0]]],
      [152, 911, [[0, 0]]],
      [152, 989, [[0, 0]]],
      [360, 802, [[0, 0]]],
      [560, 802, [[0, 0]]],
      [802, 995, [[0, 0]]],
      [
        560,
        995,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [560, 824, [[0, 65]]],
      [620, 824, [[0, 65]]],
      [741, 824, [[0, 65]]],
      [824, 875, [[0, 65]]],
      [824, 950, [[0, 65]]],
      [824, 962, [[0, 3]]],
      [824, 978, [[0, 3]]],
      [824, 989, [[0, 65]]],
      [826, 832, [[0, 0]]],
      [396, 826, [[0, 0]]],
      [826, 978, [[0, 0]]],
      [5, 135, [[0, 0]]],
      [135, 741, [[0, 0]]],
      [135, 837, [[0, 0]]],
      [135, 876, [[0, 0]]],
      [360, 837, [[0, 0]]],
      [837, 870, [[0, 0]]],
      [837, 950, [[0, 0]]],
      [837, 986, [[0, 0]]],
      [7, 190, [[0, 65]]],
      [7, 319, [[0, 3]]],
      [7, 741, [[0, 65]]],
      [7, 876, [[0, 65]]],
      [7, 978, [[0, 3]]],
      [7, 986, [[0, 3]]],
      [190, 208, [[0, 65]]],
      [190, 247, [[0, 65]]],
      [190, 319, [[0, 3]]],
      [190, 950, [[0, 65]]],
      [208, 282, [[0, 65]]],
      [208, 319, [[0, 3]]],
      [247, 284, [[0, 65]]],
      [247, 282, [[0, 65]]],
      [279, 284, [[0, 65]]],
      [282, 284, [[0, 65]]],
      [8, 191, [[0, 65]]],
      [8, 249, [[0, 65]]],
      [8, 319, [[0, 3]]],
      [8, 882, [[0, 27]]],
      [8, 978, [[0, 3]]],
      [8, 989, [[0, 65]]],
      [191, 208, [[0, 65]]],
      [191, 249, [[0, 65]]],
      [191, 319, [[0, 3]]],
      [249, 284, [[0, 65]]],
      [249, 282, [[0, 65]]],
      [17, 207, [[0, 0]]],
      [17, 950, [[0, 0]]],
      [17, 978, [[0, 0]]],
      [207, 741, [[0, 0]]],
      [207, 962, [[0, 0]]],
      [207, 978, [[0, 0]]],
      [207, 980, [[0, 0]]],
      [51, 198, [[0, 0]]],
      [51, 207, [[0, 0]]],
      [51, 978, [[0, 0]]],
      [198, 319, [[0, 0]]],
      [198, 950, [[0, 0]]],
      [198, 989, [[0, 0]]],
      [52, 54, [[0, 65]]],
      [52, 199, [[0, 65]]],
      [52, 319, [[0, 3]]],
      [52, 584, [[0, 65]]],
      [52, 882, [[0, 27]]],
      [52, 978, [[0, 3]]],
      [52, 989, [[0, 65]]],
      [54, 56, [[0, 65]]],
      [54, 58, [[0, 65]]],
      [54, 319, [[0, 3]]],
      [55, 56, [[0, 65]]],
      [56, 319, [[0, 3]]],
      [56, 916, [[0, 65]]],
      [58, 584, [[0, 65]]],
      [52, 53, [[0, 65]]],
      [53, 882, [[0, 27]]],
      [53, 978, [[0, 3]]],
      [70, 177, [[0, 0]]],
      [177, 239, [[0, 0]]],
      [177, 396, [[0, 0]]],
      [177, 875, [[0, 0]]],
      [177, 876, [[0, 0]]],
      [177, 950, [[0, 0]]],
      [177, 962, [[0, 0]]],
      [71, 978, [[0, 0]]],
      [81, 82, [[0, 0]]],
      [82, 83, [[0, 0]]],
      [82, 207, [[0, 0]]],
      [82, 396, [[0, 0]]],
      [82, 950, [[0, 0]]],
      [82, 978, [[0, 0]]],
      [81, 83, [[0, 0]]],
      [81, 203, [[0, 0]]],
      [81, 358, [[0, 0]]],
      [81, 396, [[0, 0]]],
      [81, 990, [[0, 0]]],
      [83, 396, [[0, 0]]],
      [203, 396, [[0, 0]]],
      [203, 990, [[0, 0]]],
      [113, 115, [[0, 0]]],
      [115, 214, [[0, 0]]],
      [115, 215, [[0, 0]]],
      [115, 216, [[0, 0]]],
      [115, 396, [[0, 0]]],
      [115, 876, [[0, 0]]],
      [115, 978, [[0, 0]]],
      [115, 986, [[0, 0]]],
      [113, 114, [[0, 0]]],
      [113, 212, [[0, 0]]],
      [113, 215, [[0, 0]]],
      [113, 396, [[0, 0]]],
      [113, 814, [[0, 0]]],
      [113, 978, [[0, 0]]],
      [114, 203, [[0, 0]]],
      [114, 213, [[0, 0]]],
      [114, 396, [[0, 0]]],
      [213, 990, [[0, 0]]],
      [198, 212, [[0, 0]]],
      [215, 1006, [[0, 0]]],
      [875, 1006, [[0, 0]]],
      [214, 396, [[0, 0]]],
      [216, 360, [[0, 0]]],
      [216, 620, [[0, 0]]],
      [216, 875, [[0, 0]]],
      [216, 876, [[0, 0]]],
      [216, 950, [[0, 0]]],
      [216, 962, [[0, 0]]],
      [216, 987, [[0, 0]]],
      [763, 768, [[0, 0]]],
      [763, 769, [[0, 0]]],
      [763, 770, [[0, 0]]],
      [763, 876, [[0, 0]]],
      [763, 950, [[0, 0]]],
      [319, 768, [[0, 0]]],
      [768, 769, [[0, 0]]],
      [768, 780, [[0, 0]]],
      [319, 770, [[0, 0]]],
      [765, 770, [[0, 0]]],
      [872, 873, [[0, 0]]],
      [84, 949, [[0, 0]]],
      [65, 104, [[0, 0]]],
      [94, 104, [[0, 0]]],
      [104, 949, [[0, 0]]],
      [65, 201, [[0, 0]]],
      [65, 873, [[0, 0]]],
      [65, 949, [[0, 0]]],
      [201, 917, [[0, 0]]],
      [201, 949, [[0, 0]]],
      [201, 1029, [[0, 0]]],
      [875, 917, [[0, 0]]],
      [917, 949, [[0, 0]]],
      [917, 1029, [[0, 0]]],
      [949, 1029, [[0, 0]]],
      [918, 949, [[0, 0]]],
      [918, 976, [[0, 0]]],
      [918, 979, [[0, 0]]],
      [918, 1004, [[0, 0]]],
      [
        949,
        976,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [949, 966, [[0, 0]]],
      [93, 100, [[0, 0]]],
      [93, 102, [[0, 0]]],
      [93, 95, [[0, 0]]],
      [93, 168, [[0, 0]]],
      [93, 197, [[0, 0]]],
      [93, 600, [[0, 0]]],
      [93, 918, [[0, 0]]],
      [93, 949, [[0, 0]]],
      [93, 976, [[0, 0]]],
      [93, 979, [[0, 0]]],
      [93, 1004, [[0, 0]]],
      [14, 100, [[0, 0]]],
      [100, 947, [[0, 0]]],
      [100, 949, [[0, 0]]],
      [100, 976, [[0, 0]]],
      [100, 979, [[0, 0]]],
      [14, 15, [[0, 0]]],
      [14, 947, [[0, 0]]],
      [14, 949, [[0, 0]]],
      [14, 957, [[0, 0]]],
      [14, 979, [[0, 0]]],
      [15, 67, [[0, 0]]],
      [15, 173, [[0, 0]]],
      [15, 947, [[0, 0]]],
      [15, 949, [[0, 0]]],
      [15, 957, [[0, 0]]],
      [15, 979, [[0, 0]]],
      [67, 68, [[0, 0]]],
      [67, 69, [[0, 0]]],
      [67, 787, [[0, 0]]],
      [67, 873, [[0, 0]]],
      [67, 949, [[0, 0]]],
      [68, 949, [[0, 0]]],
      [69, 949, [[0, 0]]],
      [168, 173, [[0, 0]]],
      [173, 584, [[0, 0]]],
      [173, 949, [[0, 0]]],
      [101, 102, [[0, 0]]],
      [102, 196, [[0, 0]]],
      [102, 949, [[0, 0]]],
      [67, 101, [[0, 0]]],
      [101, 168, [[0, 0]]],
      [101, 173, [[0, 0]]],
      [101, 196, [[0, 0]]],
      [196, 949, [[0, 0]]],
      [164, 455, [[0, 52]]],
      [197, 455, [[0, 52]]],
      [455, 457, [[0, 52]]],
      [455, 599, [[0, 3]]],
      [85, 617, [[0, 0]]],
      [617, 972, [[0, 0]]],
      [85, 89, [[0, 0]]],
      [85, 620, [[0, 0]]],
      [85, 932, [[0, 0]]],
      [12, 89, [[0, 0]]],
      [13, 89, [[0, 0]]],
      [89, 95, [[0, 0]]],
      [89, 109, [[0, 0]]],
      [89, 189, [[0, 0]]],
      [89, 206, [[0, 0]]],
      [89, 584, [[0, 0]]],
      [89, 600, [[0, 0]]],
      [89, 611, [[0, 0]]],
      [89, 620, [[0, 0]]],
      [89, 969, [[0, 0]]],
      [89, 979, [[0, 0]]],
      [89, 1004, [[0, 0]]],
      [13, 109, [[0, 0]]],
      [109, 620, [[0, 0]]],
      [109, 979, [[0, 0]]],
      [
        925,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        930,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        932,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [936, 969, [[0, 99]]],
      [
        964,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        968,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        584,
        969,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [620, 969, [[0, 99]]],
      [
        909,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        911,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        969,
        972,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [133, 964, [[0, 32]]],
      [134, 964, [[0, 32]]],
      [
        932,
        964,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        964,
        971,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        964,
        972,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [1, 133, [[0, 32]]],
      [3, 133, [[0, 32]]],
      [133, 972, [[0, 32]]],
      [1, 2, [[0, 32]]],
      [1, 131, [[0, 32]]],
      [1, 932, [[0, 32]]],
      [2, 932, [[0, 32]]],
      [131, 932, [[0, 32]]],
      [2, 3, [[0, 32]]],
      [3, 131, [[0, 32]]],
      [3, 932, [[0, 32]]],
      [4, 134, [[0, 32]]],
      [134, 972, [[0, 32]]],
      [4, 132, [[0, 32]]],
      [132, 560, [[0, 32]]],
      [132, 875, [[0, 32]]],
      [132, 937, [[0, 32]]],
      [360, 909, [[0, 3]]],
      [
        584,
        909,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        876,
        909,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        905,
        909,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        909,
        949,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [96, 618, [[0, 0]]],
      [584, 618, [[0, 0]]],
      [618, 620, [[0, 0]]],
      [618, 972, [[0, 0]]],
      [89, 96, [[0, 0]]],
      [
        932,
        944,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [741, 944, [[0, 99]]],
      [
        944,
        971,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [599, 640, [[0, 3]]],
      [640, 647, [[0, 3]]],
      [640, 654, [[0, 3]]],
      [640, 945, [[0, 65]]],
      [612, 647, [[0, 3]]],
      [647, 654, [[0, 3]]],
      [542, 641, [[0, 65]]],
      [641, 648, [[0, 3]]],
      [641, 934, [[0, 3]]],
      [642, 644, [[0, 65]]],
      [584, 642, [[0, 65]]],
      [595, 642, [[0, 3]]],
      [599, 642, [[0, 3]]],
      [642, 643, [[0, 65]]],
      [642, 645, [[0, 65]]],
      [642, 654, [[0, 3]]],
      [642, 875, [[0, 65]]],
      [642, 876, [[0, 65]]],
      [642, 929, [[0, 65]]],
      [396, 644, [[0, 3]]],
      [644, 654, [[0, 3]]],
      [644, 875, [[0, 65]]],
      [584, 645, [[0, 65]]],
      [599, 645, [[0, 3]]],
      [542, 649, [[0, 65]]],
      [649, 654, [[0, 3]]],
      [612, 650, [[0, 3]]],
      [650, 654, [[0, 3]]],
      [542, 651, [[0, 65]]],
      [612, 651, [[0, 3]]],
      [647, 651, [[0, 3]]],
      [649, 651, [[0, 65]]],
      [650, 651, [[0, 3]]],
      [651, 654, [[0, 3]]],
      [584, 923, [[0, 65]]],
      [599, 923, [[0, 3]]],
      [771, 778, [[0, 65]]],
      [197, 771, [[0, 65]]],
      [510, 771, [[0, 65]]],
      [555, 771, [[0, 3]]],
      [556, 771, [[0, 65]]],
      [584, 771, [[0, 65]]],
      [599, 771, [[0, 3]]],
      [635, 771, [[0, 65]]],
      [771, 923, [[0, 65]]],
      [771, 930, [[0, 65]]],
      [771, 932, [[0, 65]]],
      [777, 778, [[0, 65]]],
      [123, 778, [[0, 65]]],
      [557, 778, [[0, 3]]],
      [556, 778, [[0, 65]]],
      [584, 778, [[0, 65]]],
      [620, 778, [[0, 65]]],
      [741, 778, [[0, 65]]],
      [778, 875, [[0, 65]]],
      [778, 936, [[0, 65]]],
      [778, 937, [[0, 65]]],
      [773, 777, [[0, 65]]],
      [774, 777, [[0, 65]]],
      [775, 777, [[0, 65]]],
      [776, 777, [[0, 65]]],
      [554, 777, [[0, 3]]],
      [557, 777, [[0, 3]]],
      [777, 876, [[0, 65]]],
      [772, 773, [[0, 3]]],
      [314, 773, [[0, 3]]],
      [319, 773, [[0, 3]]],
      [773, 986, [[0, 3]]],
      [773, 989, [[0, 65]]],
      [233, 772, [[0, 3]]],
      [314, 772, [[0, 3]]],
      [319, 772, [[0, 3]]],
      [772, 986, [[0, 3]]],
      [772, 994, [[0, 3]]],
      [773, 774, [[0, 65]]],
      [358, 775, [[0, 3]]],
      [741, 775, [[0, 65]]],
      [360, 776, [[0, 3]]],
      [554, 776, [[0, 3]]],
      [741, 776, [[0, 65]]],
      [756, 776, [[0, 3]]],
      [758, 776, [[0, 3]]],
      [
        510,
        512,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        116,
        510,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        118,
        510,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [218, 510, [[0, 3]]],
      [
        510,
        514,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [510, 515, [[0, 3]]],
      [510, 522, [[0, 3]]],
      [
        510,
        523,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [510, 524, [[0, 3]]],
      [510, 595, [[0, 3]]],
      [510, 599, [[0, 3]]],
      [510, 601, [[0, 3]]],
      [
        510,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        510,
        603,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [510, 604, [[0, 3]]],
      [
        510,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        510,
        707,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        510,
        710,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        510,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        510,
        738,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        510,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        510,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [512, 601, [[0, 3]]],
      [
        512,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [515, 522, [[0, 3]]],
      [522, 524, [[0, 3]]],
      [522, 601, [[0, 3]]],
      [518, 523, [[0, 3]]],
      [523, 524, [[0, 3]]],
      [218, 523, [[0, 3]]],
      [515, 523, [[0, 3]]],
      [522, 523, [[0, 3]]],
      [523, 595, [[0, 3]]],
      [523, 599, [[0, 3]]],
      [523, 601, [[0, 3]]],
      [
        523,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        523,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        523,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [518, 604, [[0, 3]]],
      [601, 604, [[0, 3]]],
      [601, 603, [[0, 3]]],
      [
        602,
        603,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        707,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        197,
        710,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        656,
        710,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [663, 710, [[0, 99]]],
      [
        661,
        663,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        662,
        663,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        664,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        665,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        666,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        667,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        668,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        663,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        197,
        663,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        581,
        663,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [595, 663, [[0, 3]]],
      [
        656,
        663,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        657,
        663,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        658,
        663,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [663, 669, [[0, 3]]],
      [663, 709, [[0, 99]]],
      [
        663,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        663,
        733,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [663, 734, [[0, 3]]],
      [
        656,
        661,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        656,
        662,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        656,
        664,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        665,
        667,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        656,
        665,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        656,
        667,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        665,
        666,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        666,
        667,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        656,
        666,
        [
          [0, 89],
          [91, 99]
        ]
      ],
      [
        486,
        668,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        668,
        733,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        197,
        733,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [485, 733, [[0, 3]]],
      [488, 733, [[0, 99]]],
      [491, 733, [[0, 99]]],
      [595, 733, [[0, 3]]],
      [599, 733, [[0, 3]]],
      [601, 733, [[0, 3]]],
      [
        657,
        733,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [730, 733, [[0, 99]]],
      [118, 488, [[0, 99]]],
      [
        197,
        488,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [486, 488, [[0, 99]]],
      [488, 599, [[0, 3]]],
      [
        488,
        875,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [488, 930, [[0, 99]]],
      [488, 730, [[0, 99]]],
      [
        657,
        730,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        656,
        658,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [564, 669, [[0, 3]]],
      [595, 709, [[0, 3]]],
      [599, 709, [[0, 3]]],
      [
        656,
        709,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        707,
        709,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [709, 710, [[0, 99]]],
      [
        709,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        709,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [197, 734, [[0, 3]]],
      [601, 734, [[0, 3]]],
      [608, 734, [[0, 3]]],
      [601, 608, [[0, 3]]],
      [218, 738, [[0, 3]]],
      [
        732,
        738,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [118, 635, [[0, 65]]],
      [189, 635, [[0, 65]]],
      [211, 635, [[0, 65]]],
      [595, 635, [[0, 3]]],
      [623, 635, [[0, 65]]],
      [635, 637, [[0, 65]]],
      [635, 638, [[0, 3]]],
      [635, 876, [[0, 65]]],
      [635, 911, [[0, 65]]],
      [623, 637, [[0, 65]]],
      [623, 638, [[0, 3]]],
      [637, 638, [[0, 3]]],
      [637, 654, [[0, 3]]],
      [
        637,
        875,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        637,
        876,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        637,
        929,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [638, 654, [[0, 3]]],
      [118, 1009, [[0, 65]]],
      [595, 1009, [[0, 3]]],
      [599, 1009, [[0, 3]]],
      [601, 1009, [[0, 3]]],
      [911, 1009, [[0, 65]]],
      [1009, 1020, [[0, 65]]],
      [118, 1020, [[0, 65]]],
      [582, 1020, [[0, 65]]],
      [732, 1020, [[0, 65]]],
      [930, 1020, [[0, 65]]],
      [218, 582, [[0, 3]]],
      [494, 582, [[0, 65]]],
      [582, 875, [[0, 65]]],
      [1014, 1015, [[0, 65]]],
      [314, 1015, [[0, 3]]],
      [320, 1015, [[0, 3]]],
      [238, 1014, [[0, 65]]],
      [349, 1014, [[0, 3]]],
      [358, 1014, [[0, 3]]],
      [314, 1014, [[0, 3]]],
      [319, 1014, [[0, 3]]],
      [320, 1014, [[0, 3]]],
      [377, 1014, [[0, 3]]],
      [394, 1014, [[0, 3]]],
      [396, 1014, [[0, 3]]],
      [599, 1014, [[0, 3]]],
      [962, 1014, [[0, 3]]],
      [980, 1014, [[0, 3]]],
      [986, 1014, [[0, 3]]],
      [620, 1018, [[0, 65]]],
      [1010, 1019, [[0, 28]]],
      [1019, 1024, [[0, 65]]],
      [1019, 1026, [[0, 65]]],
      [1019, 1027, [[0, 3]]],
      [601, 1019, [[0, 3]]],
      [619, 1019, [[0, 65]]],
      [1010, 1026, [[0, 28]]],
      [1010, 1027, [[0, 3]]],
      [595, 1010, [[0, 3]]],
      [1024, 1026, [[0, 65]]],
      [1025, 1026, [[0, 3]]],
      [1010, 1024, [[0, 28]]],
      [1021, 1025, [[0, 3]]],
      [1016, 1021, [[0, 3]]],
      [1017, 1021, [[0, 3]]],
      [1011, 1016, [[0, 3]]],
      [1016, 1017, [[0, 3]]],
      [1011, 1013, [[0, 3]]],
      [599, 1011, [[0, 3]]],
      [599, 1013, [[0, 3]]],
      [599, 1017, [[0, 3]]],
      [601, 1027, [[0, 3]]],
      [250, 876, [[0, 65]]],
      [250, 894, [[0, 65]]],
      [251, 564, [[0, 3]]],
      [251, 741, [[0, 65]]],
      [251, 913, [[0, 65]]],
      [251, 971, [[0, 65]]],
      [252, 584, [[0, 65]]],
      [252, 591, [[0, 65]]],
      [252, 913, [[0, 65]]],
      [252, 971, [[0, 65]]],
      [118, 591, [[0, 65]]],
      [591, 595, [[0, 3]]],
      [118, 253, [[0, 65]]],
      [123, 253, [[0, 65]]],
      [253, 563, [[0, 65]]],
      [253, 913, [[0, 65]]],
      [254, 488, [[0, 65]]],
      [254, 913, [[0, 65]]],
      [255, 876, [[0, 65]]],
      [255, 358, [[0, 3]]],
      [255, 360, [[0, 3]]],
      [256, 913, [[0, 65]]],
      [257, 309, [[0, 65]]],
      [257, 319, [[0, 3]]],
      [257, 360, [[0, 3]]],
      [257, 396, [[0, 3]]],
      [257, 407, [[0, 3]]],
      [257, 876, [[0, 65]]],
      [257, 915, [[0, 65]]],
      [257, 962, [[0, 3]]],
      [257, 978, [[0, 3]]],
      [309, 358, [[0, 3]]],
      [309, 319, [[0, 3]]],
      [309, 360, [[0, 3]]],
      [309, 391, [[0, 3]]],
      [309, 876, [[0, 65]]],
      [309, 942, [[0, 3]]],
      [309, 978, [[0, 3]]],
      [258, 319, [[0, 3]]],
      [258, 913, [[0, 65]]],
      [259, 876, [[0, 65]]],
      [260, 620, [[0, 65]]],
      [260, 876, [[0, 65]]],
      [260, 911, [[0, 65]]],
      [261, 876, [[0, 65]]],
      [261, 308, [[0, 65]]],
      [261, 358, [[0, 3]]],
      [261, 360, [[0, 3]]],
      [261, 368, [[0, 3]]],
      [261, 394, [[0, 3]]],
      [261, 403, [[0, 3]]],
      [261, 654, [[0, 3]]],
      [261, 949, [[0, 65]]],
      [261, 961, [[0, 65]]],
      [261, 971, [[0, 65]]],
      [261, 1007, [[0, 3]]],
      [308, 309, [[0, 65]]],
      [308, 358, [[0, 3]]],
      [308, 319, [[0, 3]]],
      [308, 360, [[0, 3]]],
      [308, 365, [[0, 3]]],
      [308, 368, [[0, 3]]],
      [308, 396, [[0, 3]]],
      [308, 471, [[0, 65]]],
      [308, 477, [[0, 65]]],
      [
        308,
        871,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [308, 876, [[0, 65]]],
      [308, 907, [[0, 65]]],
      [308, 915, [[0, 65]]],
      [308, 962, [[0, 3]]],
      [308, 978, [[0, 3]]],
      [308, 993, [[0, 3]]],
      [308, 1001, [[0, 3]]],
      [360, 871, [[0, 3]]],
      [990, 993, [[0, 3]]],
      [360, 1001, [[0, 3]]],
      [986, 1001, [[0, 3]]],
      [360, 1007, [[0, 3]]],
      [597, 1007, [[0, 3]]],
      [262, 876, [[0, 65]]],
      [262, 358, [[0, 3]]],
      [262, 360, [[0, 3]]],
      [262, 584, [[0, 65]]],
      [262, 971, [[0, 65]]],
      [263, 319, [[0, 3]]],
      [263, 913, [[0, 65]]],
      [264, 319, [[0, 3]]],
      [264, 560, [[0, 65]]],
      [264, 766, [[0, 3]]],
      [264, 769, [[0, 3]]],
      [264, 913, [[0, 65]]],
      [265, 319, [[0, 3]]],
      [265, 913, [[0, 65]]],
      [267, 781, [[0, 65]]],
      [267, 876, [[0, 65]]],
      [319, 781, [[0, 3]]],
      [780, 781, [[0, 65]]],
      [781, 950, [[0, 65]]],
      [246, 289, [[0, 65]]],
      [248, 289, [[0, 65]]],
      [269, 289, [[0, 65]]],
      [288, 289, [[0, 65]]],
      [289, 290, [[0, 65]]],
      [289, 298, [[0, 65]]],
      [289, 319, [[0, 3]]],
      [289, 876, [[0, 65]]],
      [289, 913, [[0, 65]]],
      [289, 938, [[0, 65]]],
      [289, 971, [[0, 65]]],
      [7, 246, [[0, 65]]],
      [246, 319, [[0, 3]]],
      [246, 882, [[0, 27]]],
      [246, 913, [[0, 65]]],
      [8, 248, [[0, 65]]],
      [248, 319, [[0, 3]]],
      [248, 882, [[0, 27]]],
      [248, 913, [[0, 65]]],
      [52, 269, [[0, 65]]],
      [55, 269, [[0, 65]]],
      [199, 269, [[0, 65]]],
      [269, 285, [[0, 65]]],
      [269, 273, [[0, 65]]],
      [269, 272, [[0, 65]]],
      [269, 286, [[0, 65]]],
      [269, 274, [[0, 65]]],
      [269, 358, [[0, 3]]],
      [269, 319, [[0, 3]]],
      [269, 396, [[0, 3]]],
      [269, 560, [[0, 65]]],
      [269, 599, [[0, 3]]],
      [269, 875, [[0, 65]]],
      [269, 876, [[0, 65]]],
      [269, 882, [[0, 27]]],
      [269, 913, [[0, 65]]],
      [269, 916, [[0, 65]]],
      [269, 971, [[0, 65]]],
      [269, 986, [[0, 3]]],
      [269, 989, [[0, 65]]],
      [273, 285, [[0, 65]]],
      [285, 358, [[0, 3]]],
      [285, 360, [[0, 3]]],
      [272, 273, [[0, 65]]],
      [272, 274, [[0, 65]]],
      [272, 358, [[0, 3]]],
      [272, 319, [[0, 3]]],
      [272, 396, [[0, 3]]],
      [272, 584, [[0, 65]]],
      [272, 875, [[0, 65]]],
      [272, 981, [[0, 65]]],
      [273, 286, [[0, 65]]],
      [286, 319, [[0, 3]]],
      [53, 288, [[0, 65]]],
      [199, 288, [[0, 65]]],
      [285, 288, [[0, 65]]],
      [272, 288, [[0, 65]]],
      [286, 288, [[0, 65]]],
      [288, 358, [[0, 3]]],
      [288, 319, [[0, 3]]],
      [288, 396, [[0, 3]]],
      [288, 882, [[0, 27]]],
      [288, 913, [[0, 65]]],
      [288, 916, [[0, 65]]],
      [199, 290, [[0, 65]]],
      [285, 290, [[0, 65]]],
      [273, 290, [[0, 65]]],
      [272, 290, [[0, 65]]],
      [290, 358, [[0, 3]]],
      [290, 319, [[0, 3]]],
      [290, 560, [[0, 65]]],
      [290, 876, [[0, 65]]],
      [290, 913, [[0, 65]]],
      [290, 916, [[0, 65]]],
      [290, 971, [[0, 65]]],
      [290, 986, [[0, 3]]],
      [52, 298, [[0, 65]]],
      [199, 298, [[0, 65]]],
      [285, 298, [[0, 65]]],
      [272, 298, [[0, 65]]],
      [298, 358, [[0, 3]]],
      [298, 319, [[0, 3]]],
      [298, 560, [[0, 65]]],
      [298, 876, [[0, 65]]],
      [298, 882, [[0, 27]]],
      [298, 913, [[0, 65]]],
      [298, 916, [[0, 65]]],
      [298, 986, [[0, 3]]],
      [159, 291, [[0, 65]]],
      [291, 360, [[0, 3]]],
      [291, 876, [[0, 65]]],
      [292, 875, [[0, 65]]],
      [292, 876, [[0, 65]]],
      [292, 894, [[0, 65]]],
      [292, 358, [[0, 3]]],
      [292, 360, [[0, 3]]],
      [292, 599, [[0, 3]]],
      [292, 911, [[0, 65]]],
      [292, 971, [[0, 65]]],
      [292, 1007, [[0, 3]]],
      [293, 876, [[0, 65]]],
      [293, 907, [[0, 65]]],
      [293, 360, [[0, 3]]],
      [294, 913, [[0, 65]]],
      [295, 304, [[0, 65]]],
      [295, 319, [[0, 3]]],
      [295, 876, [[0, 65]]],
      [295, 913, [[0, 65]]],
      [295, 986, [[0, 3]]],
      [304, 319, [[0, 3]]],
      [304, 360, [[0, 3]]],
      [304, 560, [[0, 65]]],
      [304, 824, [[0, 65]]],
      [304, 876, [[0, 65]]],
      [304, 882, [[0, 27]]],
      [304, 907, [[0, 65]]],
      [304, 962, [[0, 3]]],
      [296, 876, [[0, 65]]],
      [296, 308, [[0, 65]]],
      [296, 358, [[0, 3]]],
      [296, 360, [[0, 3]]],
      [296, 368, [[0, 3]]],
      [296, 403, [[0, 3]]],
      [297, 876, [[0, 65]]],
      [297, 319, [[0, 3]]],
      [297, 1001, [[0, 3]]],
      [299, 304, [[0, 65]]],
      [299, 913, [[0, 65]]],
      [300, 360, [[0, 3]]],
      [300, 876, [[0, 65]]],
      [301, 360, [[0, 3]]],
      [301, 876, [[0, 65]]],
      [303, 876, [[0, 65]]],
      [302, 303, [[0, 65]]],
      [303, 360, [[0, 3]]],
      [303, 322, [[0, 3]]],
      [303, 971, [[0, 65]]],
      [302, 907, [[0, 65]]],
      [302, 872, [[0, 3]]],
      [302, 874, [[0, 3]]],
      [305, 875, [[0, 65]]],
      [305, 876, [[0, 65]]],
      [167, 305, [[0, 65]]],
      [169, 305, [[0, 3]]],
      [172, 305, [[0, 3]]],
      [305, 360, [[0, 3]]],
      [305, 396, [[0, 3]]],
      [305, 560, [[0, 65]]],
      [305, 599, [[0, 3]]],
      [305, 866, [[0, 65]]],
      [305, 882, [[0, 27]]],
      [305, 908, [[0, 65]]],
      [305, 962, [[0, 3]]],
      [305, 973, [[0, 65]]],
      [305, 986, [[0, 3]]],
      [866, 876, [[0, 65]]],
      [971, 973, [[0, 65]]],
      [972, 973, [[0, 65]]],
      [360, 973, [[0, 3]]],
      [560, 973, [[0, 65]]],
      [875, 973, [[0, 65]]],
      [876, 973, [[0, 65]]],
      [882, 973, [[0, 27]]],
      [306, 876, [[0, 65]]],
      [306, 319, [[0, 3]]],
      [307, 875, [[0, 65]]],
      [307, 876, [[0, 65]]],
      [307, 319, [[0, 3]]],
      [307, 950, [[0, 65]]],
      [346, 358, [[0, 3]]],
      [317, 346, [[0, 3]]],
      [595, 598, [[0, 3]]],
      [598, 601, [[0, 3]]],
      [
        462,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        529,
        530,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        529,
        531,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        531,
        532,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [360, 982, [[0, 3]]],
      [
        28,
        42,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        28,
        43,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        28,
        44,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        28,
        116,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [28, 218, [[0, 3]]],
      [
        28,
        489,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [28, 564, [[0, 3]]],
      [42, 218, [[0, 3]]],
      [42, 564, [[0, 3]]],
      [
        42,
        925,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        42,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        43,
        116,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        43,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [44, 45, [[0, 3]]],
      [
        44,
        119,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        44,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [45, 220, [[0, 3]]],
      [220, 564, [[0, 3]]],
      [
        119,
        197,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [119, 220, [[0, 3]]],
      [119, 565, [[0, 3]]],
      [
        116,
        489,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [489, 599, [[0, 3]]],
      [
        489,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        46,
        122,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        46,
        123,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        46,
        125,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        46,
        521,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [46, 595, [[0, 3]]],
      [
        46,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        46,
        709,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        46,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        517,
        521,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [521, 601, [[0, 3]]],
      [
        521,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [515, 517, [[0, 3]]],
      [
        517,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        656,
        728,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        728,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        125,
        728,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        197,
        728,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        709,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        29,
        116,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        29,
        129,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        29,
        581,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [29, 595, [[0, 3]]],
      [29, 601, [[0, 3]]],
      [
        29,
        602,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        30,
        116,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [497, 595, [[0, 3]]],
      [
        120,
        516,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        123,
        516,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [496, 516, [[0, 13]]],
      [516, 521, [[0, 13]]],
      [516, 595, [[0, 3]]],
      [516, 599, [[0, 3]]],
      [516, 722, [[0, 13]]],
      [
        516,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [197, 496, [[0, 13]]],
      [496, 599, [[0, 3]]],
      [496, 656, [[0, 13]]],
      [
        122,
        722,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        197,
        722,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        506,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        514,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [595, 722, [[0, 3]]],
      [599, 722, [[0, 3]]],
      [
        602,
        722,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        603,
        722,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        722,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        660,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        663,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        666,
        722,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        670,
        722,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        707,
        722,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        709,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        710,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        719,
        722,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        722,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        722,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        118,
        506,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [506, 599, [[0, 3]]],
      [
        506,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        506,
        707,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        506,
        710,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        506,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        660,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        197,
        660,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [595, 660, [[0, 3]]],
      [601, 660, [[0, 3]]],
      [659, 660, [[0, 3]]],
      [
        660,
        709,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        660,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [660, 734, [[0, 3]]],
      [217, 659, [[0, 3]]],
      [218, 659, [[0, 3]]],
      [
        656,
        670,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        197,
        719,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        719,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        666,
        719,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        719,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        197,
        729,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [515, 729, [[0, 3]]],
      [524, 729, [[0, 3]]],
      [
        581,
        729,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [595, 729, [[0, 3]]],
      [599, 729, [[0, 3]]],
      [601, 729, [[0, 3]]],
      [
        656,
        729,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        658,
        729,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [669, 729, [[0, 3]]],
      [
        709,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        729,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [729, 734, [[0, 3]]],
      [
        611,
        628,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        620,
        628,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        629,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        630,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        632,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        633,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        634,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        628,
        637,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        629,
        634,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        620,
        634,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [634, 638, [[0, 3]]],
      [
        625,
        630,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        627,
        630,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        197,
        630,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        624,
        630,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        630,
        632,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        630,
        634,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        625,
        636,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        636,
        875,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        627,
        637,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        624,
        632,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        118,
        632,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        632,
        636,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        620,
        633,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        632,
        633,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        633,
        636,
        [
          [0, 88],
          [97, 99]
        ]
      ],
      [
        633,
        637,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        656,
        682,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        682,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        683,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        684,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        686,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        688,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [687, 688, [[0, 3]]],
      [
        671,
        688,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        688,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [688, 736, [[0, 3]]],
      [687, 736, [[0, 3]]],
      [599, 736, [[0, 3]]],
      [
        123,
        671,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [595, 671, [[0, 3]]],
      [601, 671, [[0, 3]]],
      [
        671,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        689,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [514, 689, [[0, 99]]],
      [
        116,
        690,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        690,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        691,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        692,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        692,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        693,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        693,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        694,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        681,
        695,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        695,
        726,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        695,
        727,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        695,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        681,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        726,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        727,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        123,
        679,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        129,
        679,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        581,
        679,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [595, 679, [[0, 3]]],
      [599, 679, [[0, 3]]],
      [601, 679, [[0, 3]]],
      [
        602,
        679,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        679,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        658,
        679,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        667,
        679,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        679,
        709,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [679, 713, [[0, 14]]],
      [
        679,
        721,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        679,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [679, 734, [[0, 3]]],
      [679, 735, [[0, 3]]],
      [
        679,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        679,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [599, 713, [[0, 3]]],
      [656, 713, [[0, 14]]],
      [707, 713, [[0, 14]]],
      [710, 713, [[0, 14]]],
      [
        123,
        721,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        197,
        721,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [601, 721, [[0, 3]]],
      [
        656,
        721,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        663,
        721,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        721,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [595, 735, [[0, 3]]],
      [734, 735, [[0, 3]]],
      [
        118,
        712,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        712,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [218, 712, [[0, 3]]],
      [515, 712, [[0, 3]]],
      [524, 712, [[0, 3]]],
      [595, 712, [[0, 3]]],
      [601, 712, [[0, 3]]],
      [
        602,
        712,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        712,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        666,
        712,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        709,
        712,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        712,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        712,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        712,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        502,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [502, 595, [[0, 3]]],
      [
        673,
        675,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        675,
        677,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        675,
        678,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        675,
        680,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [601, 675, [[0, 3]]],
      [669, 675, [[0, 3]]],
      [675, 718, [[0, 99]]],
      [515, 673, [[0, 3]]],
      [524, 673, [[0, 3]]],
      [
        656,
        673,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [669, 673, [[0, 3]]],
      [673, 711, [[0, 3]]],
      [673, 734, [[0, 3]]],
      [673, 735, [[0, 3]]],
      [515, 711, [[0, 3]]],
      [
        671,
        677,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        677,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [515, 677, [[0, 3]]],
      [524, 677, [[0, 3]]],
      [
        656,
        677,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [677, 711, [[0, 3]]],
      [
        123,
        678,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [515, 678, [[0, 3]]],
      [
        656,
        678,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [678, 711, [[0, 3]]],
      [
        123,
        680,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [515, 680, [[0, 3]]],
      [524, 680, [[0, 3]]],
      [
        656,
        680,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        680,
        709,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        680,
        717,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        680,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        123,
        717,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [515, 717, [[0, 3]]],
      [
        706,
        717,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [515, 706, [[0, 3]]],
      [
        656,
        706,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        123,
        718,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        125,
        718,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [218, 718, [[0, 3]]],
      [515, 718, [[0, 3]]],
      [519, 718, [[0, 3]]],
      [524, 718, [[0, 3]]],
      [595, 718, [[0, 3]]],
      [599, 718, [[0, 3]]],
      [601, 718, [[0, 3]]],
      [
        602,
        718,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        603,
        718,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        656,
        718,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        660,
        718,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        666,
        718,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        707,
        718,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        709,
        718,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        710,
        718,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        718,
        719,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        718,
        728,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        718,
        729,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        718,
        732,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [718, 734, [[0, 3]]],
      [718, 735, [[0, 3]]],
      [
        718,
        737,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        718,
        739,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        718,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        718,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        718,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [218, 519, [[0, 3]]],
      [515, 737, [[0, 3]]],
      [524, 737, [[0, 3]]],
      [
        656,
        737,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [524, 739, [[0, 3]]],
      [595, 739, [[0, 3]]],
      [601, 739, [[0, 3]]],
      [
        739,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        672,
        676,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        673,
        676,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        676,
        677,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        676,
        678,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [601, 676, [[0, 3]]],
      [676, 718, [[0, 99]]],
      [
        123,
        672,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [515, 672, [[0, 3]]],
      [524, 672, [[0, 3]]],
      [
        656,
        672,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        672,
        932,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        122,
        126,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        116,
        126,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        126,
        510,
        [
          [0, 95],
          [97, 99]
        ]
      ],
      [
        126,
        514,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [
        126,
        656,
        [
          [0, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        126,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        197,
        508,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [508, 564, [[0, 3]]],
      [
        508,
        970,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        174,
        970,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [360, 970, [[0, 3]]],
      [371, 970, [[0, 3]]],
      [
        584,
        970,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [942, 970, [[0, 3]]],
      [
        949,
        970,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [962, 970, [[0, 3]]],
      [970, 986, [[0, 3]]],
      [174, 358, [[0, 3]]],
      [174, 360, [[0, 3]]],
      [174, 396, [[0, 3]]],
      [
        174,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [571, 584, [[0, 16]]],
      [571, 909, [[0, 16]]],
      [575, 577, [[0, 16]]],
      [575, 576, [[0, 16]]],
      [11, 576, [[0, 16]]],
      [576, 584, [[0, 16]]],
      [9, 11, [[0, 16]]],
      [9, 875, [[0, 16]]],
      [578, 656, [[0, 16]]],
      [578, 681, [[0, 16]]],
      [209, 579, [[0, 16]]],
      [579, 584, [[0, 16]]],
      [32, 580, [[0, 16]]],
      [33, 580, [[0, 16]]],
      [35, 580, [[0, 16]]],
      [37, 580, [[0, 16]]],
      [118, 580, [[0, 16]]],
      [197, 580, [[0, 16]]],
      [209, 580, [[0, 16]]],
      [568, 580, [[0, 16]]],
      [572, 580, [[0, 16]]],
      [573, 580, [[0, 16]]],
      [580, 584, [[0, 16]]],
      [580, 587, [[0, 16]]],
      [580, 590, [[0, 16]]],
      [580, 705, [[0, 16]]],
      [580, 728, [[0, 16]]],
      [580, 731, [[0, 16]]],
      [580, 1004, [[0, 16]]],
      [32, 924, [[0, 16]]],
      [32, 958, [[0, 16]]],
      [924, 938, [[0, 16]]],
      [924, 958, [[0, 16]]],
      [924, 971, [[0, 16]]],
      [33, 36, [[0, 16]]],
      [33, 123, [[0, 16]]],
      [33, 499, [[0, 16]]],
      [33, 595, [[0, 3]]],
      [33, 932, [[0, 16]]],
      [36, 125, [[0, 16]]],
      [36, 129, [[0, 16]]],
      [36, 595, [[0, 3]]],
      [36, 656, [[0, 16]]],
      [36, 707, [[0, 16]]],
      [36, 710, [[0, 16]]],
      [36, 732, [[0, 16]]],
      [36, 910, [[0, 16]]],
      [123, 499, [[0, 16]]],
      [129, 499, [[0, 16]]],
      [499, 513, [[0, 16]]],
      [499, 514, [[0, 16]]],
      [499, 515, [[0, 3]]],
      [499, 595, [[0, 3]]],
      [499, 608, [[0, 3]]],
      [499, 709, [[0, 16]]],
      [499, 910, [[0, 16]]],
      [499, 911, [[0, 16]]],
      [123, 513, [[0, 16]]],
      [35, 40, [[0, 16]]],
      [35, 41, [[0, 16]]],
      [35, 194, [[0, 16]]],
      [35, 533, [[0, 16]]],
      [35, 534, [[0, 16]]],
      [35, 584, [[0, 16]]],
      [35, 932, [[0, 16]]],
      [40, 932, [[0, 16]]],
      [41, 534, [[0, 16]]],
      [533, 534, [[0, 16]]],
      [534, 584, [[0, 16]]],
      [534, 875, [[0, 16]]],
      [534, 905, [[0, 16]]],
      [534, 911, [[0, 16]]],
      [
        533,
        584,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        533,
        932,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        38,
        194,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [
        39,
        194,
        [
          [0, 94],
          [97, 99]
        ]
      ],
      [194, 911, [[0, 16]]],
      [39, 533, [[0, 16]]],
      [37, 118, [[0, 16]]],
      [37, 487, [[0, 16]]],
      [37, 911, [[0, 16]]],
      [116, 487, [[0, 16]]],
      [486, 487, [[0, 16]]],
      [568, 570, [[0, 16]]],
      [567, 568, [[0, 16]]],
      [566, 570, [[0, 16]]],
      [566, 875, [[0, 16]]],
      [567, 569, [[0, 16]]],
      [566, 569, [[0, 16]]],
      [572, 584, [[0, 16]]],
      [572, 938, [[0, 16]]],
      [11, 573, [[0, 16]]],
      [573, 584, [[0, 16]]],
      [587, 589, [[0, 16]]],
      [586, 587, [[0, 16]]],
      [585, 589, [[0, 16]]],
      [589, 590, [[0, 16]]],
      [589, 599, [[0, 3]]],
      [585, 875, [[0, 16]]],
      [585, 590, [[0, 16]]],
      [590, 599, [[0, 3]]],
      [586, 588, [[0, 16]]],
      [585, 588, [[0, 16]]],
      [588, 590, [[0, 16]]],
      [588, 599, [[0, 3]]],
      [696, 705, [[0, 16]]],
      [699, 705, [[0, 16]]],
      [701, 705, [[0, 16]]],
      [703, 705, [[0, 16]]],
      [123, 696, [[0, 16]]],
      [514, 696, [[0, 16]]],
      [515, 696, [[0, 3]]],
      [696, 708, [[0, 16]]],
      [696, 709, [[0, 16]]],
      [696, 715, [[0, 16]]],
      [696, 716, [[0, 16]]],
      [696, 717, [[0, 16]]],
      [696, 727, [[0, 16]]],
      [696, 728, [[0, 16]]],
      [696, 911, [[0, 16]]],
      [122, 708, [[0, 16]]],
      [123, 708, [[0, 16]]],
      [197, 708, [[0, 16]]],
      [515, 708, [[0, 3]]],
      [656, 708, [[0, 16]]],
      [708, 715, [[0, 16]]],
      [708, 728, [[0, 16]]],
      [123, 715, [[0, 16]]],
      [515, 715, [[0, 3]]],
      [715, 720, [[0, 16]]],
      [123, 720, [[0, 16]]],
      [123, 716, [[0, 16]]],
      [125, 716, [[0, 16]]],
      [595, 716, [[0, 3]]],
      [602, 716, [[0, 16]]],
      [716, 728, [[0, 16]]],
      [699, 728, [[0, 16]]],
      [699, 731, [[0, 16]]],
      [699, 949, [[0, 16]]],
      [197, 731, [[0, 16]]],
      [655, 731, [[0, 16]]],
      [731, 732, [[0, 16]]],
      [655, 875, [[0, 16]]],
      [33, 701, [[0, 16]]],
      [36, 701, [[0, 16]]],
      [503, 701, [[0, 16]]],
      [701, 702, [[0, 16]]],
      [674, 701, [[0, 16]]],
      [701, 728, [[0, 16]]],
      [123, 503, [[0, 16]]],
      [503, 511, [[0, 16]]],
      [503, 738, [[0, 16]]],
      [123, 511, [[0, 16]]],
      [511, 595, [[0, 3]]],
      [511, 599, [[0, 3]]],
      [511, 608, [[0, 3]]],
      [511, 911, [[0, 16]]],
      [511, 932, [[0, 16]]],
      [123, 702, [[0, 16]]],
      [127, 702, [[0, 16]]],
      [122, 127, [[0, 16]]],
      [123, 127, [[0, 16]]],
      [127, 656, [[0, 16]]],
      [674, 706, [[0, 16]]],
      [123, 674, [[0, 16]]],
      [499, 674, [[0, 16]]],
      [503, 674, [[0, 16]]],
      [508, 674, [[0, 16]]],
      [514, 674, [[0, 16]]],
      [515, 674, [[0, 3]]],
      [525, 674, [[0, 3]]],
      [674, 708, [[0, 16]]],
      [674, 709, [[0, 16]]],
      [674, 716, [[0, 16]]],
      [674, 717, [[0, 16]]],
      [674, 719, [[0, 16]]],
      [674, 724, [[0, 16]]],
      [674, 725, [[0, 16]]],
      [674, 728, [[0, 16]]],
      [674, 732, [[0, 16]]],
      [515, 525, [[0, 3]]],
      [123, 724, [[0, 16]]],
      [125, 724, [[0, 16]]],
      [515, 724, [[0, 3]]],
      [706, 724, [[0, 16]]],
      [709, 724, [[0, 16]]],
      [724, 728, [[0, 16]]],
      [724, 911, [[0, 16]]],
      [123, 725, [[0, 16]]],
      [515, 725, [[0, 3]]],
      [698, 703, [[0, 16]]],
      [703, 728, [[0, 16]]],
      [703, 732, [[0, 16]]],
      [515, 698, [[0, 3]]],
      [697, 698, [[0, 16]]],
      [698, 700, [[0, 16]]],
      [698, 704, [[0, 16]]],
      [698, 714, [[0, 16]]],
      [697, 732, [[0, 16]]],
      [700, 732, [[0, 16]]],
      [700, 736, [[0, 3]]],
      [704, 728, [[0, 16]]],
      [704, 732, [[0, 16]]],
      [704, 911, [[0, 16]]],
      [118, 714, [[0, 16]]],
      [123, 714, [[0, 16]]],
      [197, 714, [[0, 16]]],
      [514, 714, [[0, 16]]],
      [656, 714, [[0, 16]]],
      [709, 714, [[0, 16]]],
      [714, 715, [[0, 16]]],
      [714, 720, [[0, 16]]],
      [714, 728, [[0, 16]]],
      [714, 732, [[0, 16]]],
      [714, 911, [[0, 16]]],
      [
        875,
        959,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        959,
        979,
        [
          [0, 88],
          [91, 94],
          [97, 99]
        ]
      ],
      [
        959,
        1003,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [
        959,
        1004,
        [
          [0, 88],
          [91, 94],
          [97, 99]
        ]
      ],
      [
        875,
        1003,
        [
          [0, 88],
          [91, 99]
        ]
      ],
      [615, 654, [[0, 3]]],
      [761, 762, [[0, 20]]],
      [761, 784, [[0, 20]]],
      [620, 761, [[0, 20]]],
      [741, 761, [[0, 20]]],
      [760, 761, [[0, 3]]],
      [783, 784, [[0, 20]]],
      [784, 785, [[0, 3]]],
      [360, 784, [[0, 3]]],
      [783, 785, [[0, 3]]],
      [360, 783, [[0, 3]]],
      [760, 783, [[0, 3]]],
      [783, 937, [[0, 20]]],
      [783, 942, [[0, 3]]],
      [360, 785, [[0, 3]]],
      [495, 785, [[0, 3]]],
      [495, 599, [[0, 3]]],
      [760, 996, [[0, 3]]],
      [394, 616, [[0, 3]]],
      [894, 902, [[0, 23]]],
      [896, 902, [[0, 99]]],
      [897, 902, [[0, 99]]],
      [898, 902, [[0, 99]]],
      [899, 902, [[0, 99]]],
      [895, 902, [[0, 23]]],
      [902, 905, [[0, 99]]],
      [894, 896, [[0, 23]]],
      [896, 905, [[0, 99]]],
      [896, 898, [[0, 99]]],
      [
        876,
        896,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [894, 898, [[0, 23]]],
      [898, 905, [[0, 99]]],
      [894, 897, [[0, 23]]],
      [897, 905, [[0, 99]]],
      [896, 897, [[0, 99]]],
      [894, 899, [[0, 23]]],
      [899, 905, [[0, 99]]],
      [896, 899, [[0, 99]]],
      [898, 899, [[0, 99]]],
      [894, 895, [[0, 23]]],
      [895, 900, [[0, 23]]],
      [
        118,
        128,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        128,
        176,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        128,
        197,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [128, 485, [[0, 3]]],
      [128, 599, [[0, 3]]],
      [
        128,
        925,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        128,
        930,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        176,
        620,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        176,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        176,
        876,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        176,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [176, 986, [[0, 3]]],
      [202, 360, [[0, 3]]],
      [202, 654, [[0, 3]]],
      [
        202,
        741,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        202,
        969,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        202,
        989,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        202,
        1008,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        741,
        1008,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        123,
        505,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [505, 601, [[0, 3]]],
      [
        505,
        911,
        [
          [0, 90],
          [97, 99]
        ]
      ],
      [360, 537, [[0, 3]]],
      [
        537,
        538,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        537,
        539,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [537, 540, [[0, 3]]],
      [
        537,
        613,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        537,
        619,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        537,
        936,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        537,
        969,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [360, 545, [[0, 3]]],
      [
        471,
        545,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        544,
        545,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        545,
        546,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [545, 548, [[0, 3]]],
      [545, 599, [[0, 3]]],
      [
        545,
        613,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        545,
        619,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [545, 654, [[0, 3]]],
      [
        545,
        875,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        545,
        936,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        545,
        946,
        [
          [0, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        545,
        969,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [
        545,
        971,
        [
          [0, 12],
          [92, 92]
        ]
      ],
      [545, 986, [[0, 3]]],
      [
        542,
        544,
        [
          [0, 92],
          [97, 99]
        ]
      ],
      [360, 550, [[0, 3]]],
      [549, 550, [[0, 3]]],
      [
        550,
        551,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [
        550,
        553,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        550,
        936,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [550, 971, [[0, 12]]],
      [550, 986, [[0, 3]]],
      [
        552,
        553,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [197, 553, [[0, 3]]],
      [
        553,
        584,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        553,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        552,
        875,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [595, 596, [[0, 3]]],
      [596, 597, [[0, 3]]],
      [360, 596, [[0, 3]]],
      [
        596,
        879,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [601, 607, [[0, 3]]],
      [607, 971, [[0, 12]]],
      [601, 609, [[0, 3]]],
      [319, 614, [[0, 3]]],
      [396, 614, [[0, 3]]],
      [614, 654, [[0, 3]]],
      [
        614,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [394, 653, [[0, 3]]],
      [653, 654, [[0, 3]]],
      [653, 988, [[0, 3]]],
      [358, 988, [[0, 3]]],
      [360, 988, [[0, 3]]],
      [320, 988, [[0, 3]]],
      [363, 988, [[0, 3]]],
      [364, 988, [[0, 3]]],
      [368, 988, [[0, 3]]],
      [394, 988, [[0, 3]]],
      [313, 740, [[0, 3]]],
      [360, 742, [[0, 3]]],
      [
        741,
        742,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [358, 799, [[0, 3]]],
      [314, 799, [[0, 3]]],
      [360, 799, [[0, 3]]],
      [362, 799, [[0, 3]]],
      [380, 799, [[0, 3]]],
      [383, 799, [[0, 3]]],
      [757, 799, [[0, 3]]],
      [314, 757, [[0, 3]]],
      [362, 757, [[0, 3]]],
      [
        915,
        921,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [360, 921, [[0, 3]]],
      [386, 921, [[0, 3]]],
      [654, 921, [[0, 3]]],
      [
        921,
        949,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        470,
        984,
        [
          [0, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        985,
        989,
        [
          [0, 91],
          [97, 99]
        ]
      ],
      [360, 985, [[0, 3]]],
      [654, 985, [[0, 3]]],
      [654, 991, [[0, 3]]],
      [485, 1002, [[0, 3]]],
      [1012, 1014, [[3, 3]]],
      [394, 1012, [[3, 3]]],
      [
        538,
        875,
        [
          [10, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        538,
        929,
        [
          [10, 91],
          [97, 99]
        ]
      ],
      [
        538,
        981,
        [
          [10, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        498,
        911,
        [
          [14, 90],
          [97, 99]
        ]
      ],
      [
        46,
        507,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        123,
        507,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        507,
        520,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        507,
        727,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        520,
        656,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        46,
        498,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        123,
        498,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        498,
        501,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        498,
        516,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        498,
        521,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        501,
        507,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        501,
        509,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        123,
        509,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        509,
        516,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        509,
        656,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        509,
        729,
        [
          [14, 95],
          [97, 99]
        ]
      ],
      [
        516,
        656,
        [
          [14, 89],
          [91, 91],
          [97, 99]
        ]
      ],
      [1019, 1023, [[29, 65]]],
      [470, 1023, [[29, 65]]],
      [1023, 1024, [[29, 65]]],
      [425, 438, [[30, 99]]],
      [396, 425, [[30, 99]]],
      [407, 425, [[30, 99]]],
      [
        853,
        907,
        [
          [30, 86],
          [88, 90],
          [97, 99]
        ]
      ],
      [268, 289, [[30, 65]]],
      [268, 913, [[30, 65]]],
      [291, 989, [[37, 65]]],
      [360, 390, [[43, 99]]],
      [360, 392, [[43, 99]]],
      [360, 395, [[43, 99]]],
      [326, 392, [[43, 99]]],
      [326, 395, [[43, 99]]],
      [324, 392, [[43, 99]]],
      [324, 395, [[43, 99]]],
      [330, 392, [[43, 99]]],
      [327, 392, [[43, 99]]],
      [327, 395, [[43, 99]]],
      [328, 392, [[43, 99]]],
      [328, 395, [[43, 99]]],
      [319, 390, [[43, 99]]],
      [319, 393, [[43, 99]]],
      [319, 395, [[43, 99]]],
      [343, 395, [[43, 99]]],
      [320, 395, [[43, 99]]],
      [379, 395, [[43, 99]]],
      [395, 396, [[43, 99]]],
      [320, 392, [[43, 99]]],
      [314, 392, [[43, 99]]],
      [314, 395, [[43, 99]]],
      [394, 395, [[43, 99]]],
      [318, 390, [[43, 99]]],
      [322, 395, [[43, 99]]],
      [317, 390, [[43, 99]]],
      [317, 393, [[43, 99]]],
      [317, 395, [[43, 99]]],
      [323, 392, [[43, 99]]],
      [323, 395, [[43, 99]]],
      [319, 392, [[43, 99]]],
      [380, 392, [[43, 99]]],
      [383, 392, [[43, 99]]],
      [380, 395, [[43, 99]]],
      [374, 395, [[43, 99]]],
      [382, 395, [[43, 99]]],
      [383, 395, [[43, 99]]],
      [375, 395, [[43, 99]]],
      [378, 391, [[43, 99]]],
      [378, 395, [[43, 99]]],
      [389, 395, [[43, 99]]],
      [384, 395, [[43, 99]]],
      [387, 395, [[43, 99]]],
      [381, 395, [[43, 99]]],
      [368, 395, [[43, 99]]],
      [232, 395, [[43, 99]]],
      [363, 395, [[43, 99]]],
      [365, 395, [[43, 99]]],
      [364, 395, [[43, 99]]],
      [390, 415, [[43, 99]]],
      [311, 390, [[43, 99]]],
      [390, 395, [[43, 99]]],
      [395, 977, [[43, 99]]],
      [395, 749, [[43, 99]]],
      [369, 395, [[43, 99]]],
      [342, 390, [[43, 99]]],
      [352, 395, [[43, 99]]],
      [390, 393, [[43, 99]]],
      [393, 396, [[43, 99]]],
      [370, 395, [[43, 99]]],
      [388, 395, [[43, 99]]],
      [222, 395, [[43, 99]]],
      [223, 395, [[43, 99]]],
      [367, 395, [[43, 99]]],
      [329, 392, [[43, 99]]],
      [329, 395, [[43, 99]]],
      [332, 392, [[43, 99]]],
      [332, 395, [[43, 99]]],
      [333, 392, [[43, 99]]],
      [333, 395, [[43, 99]]],
      [334, 392, [[43, 99]]],
      [334, 395, [[43, 99]]],
      [336, 392, [[43, 99]]],
      [336, 395, [[43, 99]]],
      [
        712,
        719,
        [
          [52, 95],
          [97, 99]
        ]
      ],
      [
        192,
        202,
        [
          [54, 91],
          [97, 99]
        ]
      ],
      [
        192,
        741,
        [
          [54, 91],
          [97, 99]
        ]
      ],
      [
        192,
        1008,
        [
          [54, 91],
          [97, 99]
        ]
      ],
      [
        116,
        491,
        [
          [67, 91],
          [97, 99]
        ]
      ],
      [
        112,
        486,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        972,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        875,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        491,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        195,
        490,
        [
          [71, 85],
          [87, 88],
          [91, 99]
        ]
      ],
      [
        112,
        195,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        925,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        195,
        925,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        195,
        932,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        876,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        903,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        0,
        915,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        915,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        195,
        913,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        741,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        229,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        0,
        611,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        611,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        0,
        112,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        547,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        911,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        685,
        911,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        27,
        112,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        27,
        193,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        193,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        0,
        905,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        989,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        28,
        112,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        116,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        116,
        195,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        123,
        195,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        195,
        500,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        663,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        733,
        [
          [71, 88],
          [91, 99]
        ]
      ],
      [
        112,
        671,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        718,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        729,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        195,
        510,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        722,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        46,
        112,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        29,
        112,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        498,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        501,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        509,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        516,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        628,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        626,
        630,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        630,
        631,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        195,
        630,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        626,
        639,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        112,
        639,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        631,
        639,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        112,
        624,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        624,
        639,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        195,
        632,
        [
          [71, 88],
          [97, 99]
        ]
      ],
      [
        112,
        682,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        683,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        684,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        685,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        686,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        691,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        692,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        693,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        695,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        679,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        969,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        0,
        909,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        195,
        909,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        154,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        957,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        477,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        851,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        171,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        202,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        195,
        202,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        274,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        274,
        922,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        922,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        875,
        922,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        537,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [
        112,
        545,
        [
          [71, 88],
          [91, 92],
          [97, 99]
        ]
      ],
      [
        112,
        653,
        [
          [71, 88],
          [91, 91],
          [97, 99]
        ]
      ],
      [491, 492, [[86, 86]]],
      [490, 493, [[86, 86]]],
      [195, 493, [[86, 86]]],
      [491, 493, [[86, 86]]],
      [493, 930, [[86, 86]]],
      [
        227,
        876,
        [
          [87, 87],
          [91, 91]
        ]
      ],
      [
        240,
        907,
        [
          [87, 87],
          [91, 92]
        ]
      ],
      [
        240,
        846,
        [
          [87, 87],
          [91, 92]
        ]
      ],
      [
        240,
        584,
        [
          [87, 87],
          [91, 92]
        ]
      ],
      [
        240,
        842,
        [
          [87, 87],
          [91, 92]
        ]
      ],
      [
        240,
        852,
        [
          [87, 87],
          [91, 92]
        ]
      ],
      [
        227,
        584,
        [
          [87, 87],
          [91, 91]
        ]
      ],
      [122, 911, [[91, 92]]],
      [122, 666, [[91, 96]]],
      [117, 505, [[91, 91]]],
      [124, 505, [[91, 91]]],
      [25, 117, [[91, 91]]],
      [28, 117, [[91, 94]]],
      [30, 117, [[91, 94]]],
      [116, 117, [[91, 94]]],
      [122, 510, [[91, 91]]],
      [124, 510, [[91, 95]]],
      [26, 124, [[91, 91]]],
      [46, 124, [[91, 95]]],
      [29, 124, [[91, 95]]],
      [112, 124, [[91, 91]]],
      [122, 124, [[91, 91]]],
      [123, 124, [[91, 95]]],
      [124, 498, [[91, 95]]],
      [124, 514, [[91, 96]]],
      [124, 516, [[91, 95]]],
      [124, 563, [[91, 91]]],
      [124, 685, [[91, 91]]],
      [124, 679, [[91, 95]]],
      [124, 709, [[91, 95]]],
      [124, 712, [[91, 95]]],
      [124, 732, [[91, 91]]],
      [514, 723, [[91, 96]]],
      [122, 675, [[91, 91]]],
      [122, 718, [[91, 91]]],
      [124, 718, [[91, 96]]],
      [122, 676, [[91, 91]]],
      [656, 723, [[91, 91]]],
      [682, 723, [[91, 91]]],
      [683, 723, [[91, 91]]],
      [684, 723, [[91, 91]]],
      [686, 723, [[91, 91]]],
      [688, 723, [[91, 95]]],
      [689, 723, [[91, 96]]],
      [690, 723, [[91, 95]]],
      [691, 723, [[91, 91]]],
      [692, 723, [[91, 95]]],
      [693, 723, [[91, 95]]],
      [694, 723, [[91, 91]]],
      [695, 723, [[91, 91]]],
      [122, 712, [[91, 91]]],
      [27, 877, [[92, 96]]],
      [952, 971, [[92, 92]]],
      [877, 913, [[92, 92]]],
      [877, 878, [[92, 96]]],
      [878, 971, [[92, 96]]],
      [620, 971, [[92, 92]]],
      [875, 971, [[92, 96]]],
      [894, 971, [[92, 96]]],
      [902, 971, [[92, 96]]],
      [622, 877, [[92, 92]]],
      [877, 879, [[92, 92]]],
      [879, 880, [[92, 96]]],
      [620, 877, [[92, 92]]],
      [877, 937, [[92, 92]]],
      [175, 877, [[92, 92]]],
      [856, 877, [[92, 92]]],
      [877, 915, [[92, 92]]],
      [880, 915, [[92, 96]]],
      [877, 989, [[92, 92]]],
      [877, 950, [[92, 92]]],
      [905, 971, [[92, 94]]],
      [611, 877, [[92, 92]]],
      [539, 877, [[92, 92]]],
      [547, 877, [[92, 92]]],
      [551, 877, [[92, 92]]],
      [877, 926, [[92, 92]]],
      [926, 971, [[92, 92]]],
      [877, 936, [[92, 92]]],
      [148, 877, [[92, 92]]],
      [877, 956, [[92, 92]]],
      [956, 971, [[92, 92]]],
      [877, 909, [[92, 92]]],
      [850, 877, [[92, 92]]],
      [877, 901, [[92, 92]]],
      [238, 877, [[92, 92]]],
      [238, 971, [[92, 92]]],
      [868, 877, [[92, 92]]],
      [867, 877, [[92, 92]]],
      [560, 880, [[92, 92]]],
      [877, 880, [[92, 92]]],
      [880, 950, [[92, 96]]],
      [860, 877, [[92, 92]]],
      [854, 877, [[92, 92]]],
      [877, 965, [[92, 92]]],
      [877, 894, [[92, 92]]],
      [903, 971, [[92, 94]]],
      [606, 877, [[92, 92]]],
      [896, 971, [[92, 94]]],
      [621, 972, [[93, 96]]],
      [912, 972, [[93, 96]]],
      [911, 912, [[93, 96]]],
      [560, 619, [[93, 96]]],
      [122, 912, [[93, 96]]],
      [656, 912, [[93, 96]]],
      [619, 621, [[93, 96]]],
      [896, 903, [[95, 96]]],
      [130, 502, [[96, 96]]],
      [124, 130, [[96, 96]]],
      [130, 514, [[96, 96]]]
    ]
  }
}
