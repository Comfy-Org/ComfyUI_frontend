window.GORDIAN = {
  timeline: {
    repo: 'Comfy-Org/ComfyUI_frontend',
    issue: 'FE-3037',
    tool: 'dependency-cruiser, repo .dependency-cruiser.json, `depcruise src`',
    base: '7475c964f67419ead544bcdab2b98bc0da14e607',
    head: '9b91a0c8331da05cf9d92f408688d1e6b3d16561',
    notes: [
      'A knot is a strongly connected component of the src/ module graph with more than one module.',
      'Step 0 is the parent of the first FE-3037 commit; every later step is one commit on main.',
      'Knot ids are stable across states. When a knot splits, the largest piece keeps the id.',
      'Paths in delta lists are relative to src/.',
      'openPrs.states continue the step indexes: each is the tree at a pull request head (kind "pr") or at the main commit a stack forks from (kind "base"). Their delta is against `parent`, the state of the pull request below them in the stack.',
      'A pull request head is analysed as pushed, not merged into current main; behindMain says how stale its base is.',
      'containsParentHead false means the pull request below was rebased without this one; its delta is then its whole branch against the main commit it forks from.'
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
        bornAt: 69,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 16,
        parent: 0,
        bornAt: 69,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'types'
      },
      {
        id: 17,
        parent: 0,
        bornAt: 72,
        peak: 48,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 18,
        parent: 0,
        bornAt: 73,
        peak: 49,
        role: 'other',
        fromMain: true,
        label: 'stores'
      },
      {
        id: 19,
        parent: 17,
        bornAt: 76,
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: ['composables/useCopy.ts'], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        delta: { freed: [], entangled: [], splits: [] }
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
        }
      }
    ],
    openPrs: {
      label: 'refactor-gordian-knot',
      fetchedAt: '2026-10-09T00:21:22.729Z',
      main: '9b91a0c8331da05cf9d92f408688d1e6b3d16561',
      states: [
        {
          index: 67,
          kind: 'pr',
          parent: 66,
          sha: '9536aff6c045a579eeb6b87b083bfdb432c96dc6',
          short: '9536aff6c0',
          date: '2026-10-09T00:11:12Z',
          subject:
            'refactor: split widget constructor type and value-control helpers out of scripts/widgets',
          pr: 19093,
          stats: {
            modules: 2485,
            imports: 11623,
            modulesInKnots: 486,
            largestKnot: 271,
            mainKnot: 271,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2000,
            noCircularWarnings: 1492
          },
          knots: [
            { id: 0, size: 271 },
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
            entangled: ['core/graph/widgets/valueControlWidgets.ts'],
            splits: []
          }
        },
        {
          index: 68,
          kind: 'pr',
          parent: 53,
          sha: '36ff059f048b607994c6c11bcc2ea32983ac3475',
          short: '36ff059f04',
          date: '2026-10-08T19:37:05Z',
          subject:
            'refactor: move progress text previews out of executionStore',
          pr: 19116,
          stats: {
            modules: 2477,
            imports: 11587,
            modulesInKnots: 628,
            largestKnot: 418,
            mainKnot: 418,
            secondKnot: 154,
            knotCount: 13,
            importsInKnots: 2442,
            noCircularWarnings: 1741
          },
          knots: [
            { id: 0, size: 418 },
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
              'components/graph/widgets/TextPreviewWidget.vue',
              'composables/node/useNodeProgressText.ts',
              'renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget.ts'
            ],
            entangled: [],
            splits: []
          }
        },
        {
          index: 69,
          kind: 'pr',
          parent: 61,
          sha: '05395c323d07fd802df2646844324fae298d04f2',
          short: '05395c323d',
          date: '2026-10-08T22:03:04Z',
          subject:
            'refactor: inject the api auth provider from the composition root',
          pr: 19118,
          stats: {
            modules: 2483,
            imports: 11614,
            modulesInKnots: 567,
            largestKnot: 347,
            mainKnot: 347,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2129,
            noCircularWarnings: 1512
          },
          knots: [
            { id: 0, size: 347 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 15, size: 5 },
            { id: 16, size: 5 },
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
              'components/custom/widget/TemplateFilterControls.vue',
              'components/dialog/content/ApiNodesSignInContent.vue',
              'components/load3d/controls/viewer/ViewerLightControls.vue',
              'components/load3d/menubar/LightMenuGroup.vue',
              'composables/auth/useTurnstile.ts',
              'composables/node/useNodeDragAndDrop.ts',
              'composables/node/useNodePricing.ts',
              'composables/useFeatureFlags.ts',
              'composables/useTemplateFiltering.ts',
              'extensions/core/load3d/LoaderManager.ts',
              'extensions/core/load3d/MeshModelAdapter.ts',
              'extensions/core/load3d/ModelAdapter.ts',
              'extensions/core/load3d/PointCloudModelAdapter.ts',
              'extensions/core/load3d/SceneModelManager.ts',
              'extensions/core/load3d/SplatModelAdapter.ts',
              'platform/assets/composables/useAssetsQuery.ts',
              'platform/assets/schemas/assetMetadataSchema.ts',
              'platform/assets/schemas/mediaAssetSchema.ts',
              'platform/assets/services/assetService.ts',
              'platform/assets/utils/assetUrlUtil.ts',
              'platform/errorCatalog/executionErrorResolver.ts',
              'platform/errorCatalog/promptErrorResolver.ts',
              'platform/errorCatalog/runtimeErrorCopy.ts',
              'platform/errorCatalog/types.ts',
              'platform/errorCatalog/validationErrorResolver.ts',
              'platform/missingModel/folderPathCache.ts',
              'platform/nodeReplacement/nodeReplacementService.ts',
              'platform/nodeReplacement/nodeReplacementStore.ts',
              'platform/remoteConfig/refreshRemoteConfig.ts',
              'platform/settings/missingWarningVisibility.ts',
              'platform/settings/settingStore.ts',
              'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
              'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
              'platform/workflow/sharing/services/comfyHubService.ts',
              'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
              'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
              'platform/workflow/templates/services/templateInputService.ts',
              'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
              'platform/workspace/api/workspaceApiUrl.ts',
              'scripts/metadata/parser.ts',
              'scripts/pnginfo.ts',
              'scripts/promotedWidgetControl.ts',
              'services/audioService.ts',
              'services/useNewUserService.ts',
              'stores/assetDownloadStore.ts',
              'stores/jobPreviewStore.ts',
              'stores/modelStore.ts',
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
              'workbench/extensions/agent/types/composerAttachment.ts',
              'workbench/extensions/agent/types/composerPrompt.ts',
              'workbench/extensions/agent/utils/composerPrompt.ts',
              'workbench/utils/nodeDefOrderingUtil.ts'
            ],
            entangled: [],
            splits: [{ from: 0, into: [15, 16] }]
          }
        },
        {
          index: 70,
          kind: 'pr',
          parent: 69,
          sha: '7eb8fa5d819116b8437e930002d5bc48d2364db9',
          short: '7eb8fa5d81',
          date: '2026-10-08T22:10:39Z',
          subject:
            'refactor: install workspace api credentials from the composition root',
          pr: 19121,
          stats: {
            modules: 2484,
            imports: 11616,
            modulesInKnots: 547,
            largestKnot: 327,
            mainKnot: 327,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 2044,
            noCircularWarnings: 1466
          },
          knots: [
            { id: 0, size: 327 },
            { id: 9, size: 154 },
            { id: 1, size: 28 },
            { id: 8, size: 6 },
            { id: 10, size: 5 },
            { id: 15, size: 5 },
            { id: 16, size: 5 },
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
          }
        },
        {
          index: 71,
          kind: 'pr',
          parent: 53,
          sha: '994757a3922dd2b9134aff926a1a1535e53a297f',
          short: '994757a392',
          date: '2026-09-27T23:13:02Z',
          subject: 'refactor: split feature dialogs out of dialogService',
          pr: 19131,
          stats: {
            modules: 2489,
            imports: 11636,
            modulesInKnots: 476,
            largestKnot: 261,
            mainKnot: 261,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 1968,
            noCircularWarnings: 1449
          },
          knots: [
            { id: 0, size: 261 },
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
              'platform/settings/composables/useSettingsDialog.ts',
              'platform/settings/globalSettingsApi.ts',
              'platform/support/feedbackDialog.ts',
              'platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue',
              'platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue',
              'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubFinishStep.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue',
              'platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue',
              'platform/workflow/sharing/composables/useComfyHubProfileGate.ts',
              'platform/workflow/sharing/composables/useComfyHubPublishSubmission.ts',
              'platform/workflow/sharing/composables/useComfyHubPublishWizard.ts',
              'platform/workflow/sharing/composables/useSharedWorkflowUrlLoader.ts',
              'platform/workflow/sharing/services/comfyHubService.ts',
              'platform/workflow/sharing/services/workflowShareService.ts',
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
              'renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget.ts',
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
            entangled: [
              'composables/auth/useAuthDialogs.ts',
              'composables/billing/useBillingDialogs.ts',
              'platform/workspace/composables/useWorkspaceDialogs.ts',
              'scripts/valueControlWidgets.ts'
            ],
            splits: []
          }
        },
        {
          index: 72,
          kind: 'pr',
          parent: 71,
          sha: '15a7e94be18c41731d6e58ee8d96cad7feaad3d1',
          short: '15a7e94be1',
          date: '2026-09-28T00:31:49Z',
          subject:
            'refactor: read the app singleton through useApp() below scripts/app',
          pr: 19143,
          stats: {
            modules: 2492,
            imports: 11658,
            modulesInKnots: 412,
            largestKnot: 154,
            mainKnot: 149,
            secondKnot: 154,
            knotCount: 16,
            importsInKnots: 1641,
            noCircularWarnings: 1180
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 149 },
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
              'composables/usePaste.ts',
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
              'scripts/promotedWidgetControl.ts',
              'services/customerEventsService.ts',
              'services/subgraphService.ts',
              'stores/commandStore.ts',
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
          }
        },
        {
          index: 73,
          kind: 'pr',
          parent: 72,
          sha: '701c1d8b385f1fd79c55bd3fbcc985b496040bc8',
          short: '701c1d8b38',
          date: '2026-09-28T02:09:00Z',
          subject: 'refactor: make types/comfy a leaf of the app runtime',
          pr: 19153,
          stats: {
            modules: 2494,
            imports: 11660,
            modulesInKnots: 370,
            largestKnot: 154,
            mainKnot: 58,
            secondKnot: 154,
            knotCount: 17,
            importsInKnots: 1420,
            noCircularWarnings: 1027
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 58 },
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
              'scripts/valueControlWidgets.ts',
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
          }
        },
        {
          index: 74,
          kind: 'pr',
          parent: 73,
          sha: '1958fcdf59ae5a841baee170842186b9ddc51fda',
          short: '1958fcdf59',
          date: '2026-09-28T04:10:08Z',
          subject: 'refactor: break the workbench import cycles',
          pr: 19186,
          stats: {
            modules: 2496,
            imports: 11667,
            modulesInKnots: 340,
            largestKnot: 154,
            mainKnot: 58,
            secondKnot: 154,
            knotCount: 15,
            importsInKnots: 1347,
            noCircularWarnings: 981
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 58 },
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
          }
        },
        {
          index: 75,
          kind: 'pr',
          parent: 74,
          sha: '55e2c0696f6c67dada79e1bbb43dbeaaf40dddba',
          short: '55e2c0696f',
          date: '2026-09-28T04:56:04Z',
          subject: 'refactor: break the small app import cycles',
          pr: 19189,
          stats: {
            modules: 2502,
            imports: 11705,
            modulesInKnots: 302,
            largestKnot: 154,
            mainKnot: 53,
            secondKnot: 154,
            knotCount: 5,
            importsInKnots: 1288,
            noCircularWarnings: 951
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 53 },
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
          }
        },
        {
          index: 76,
          kind: 'pr',
          parent: 75,
          sha: 'b3e92b8080b1639e9f841e2a1e6570b3ed2dfbbf',
          short: 'b3e92b8080',
          date: '2026-10-08T22:20:05Z',
          subject:
            'refactor: let billing rails announce refreshes instead of reading the context',
          pr: 19148,
          stats: {
            modules: 2505,
            imports: 11712,
            modulesInKnots: 272,
            largestKnot: 154,
            mainKnot: 53,
            secondKnot: 154,
            knotCount: 6,
            importsInKnots: 1188,
            noCircularWarnings: 886
          },
          knots: [
            { id: 9, size: 154 },
            { id: 0, size: 53 },
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
          }
        },
        {
          index: 77,
          kind: 'pr',
          parent: 62,
          sha: 'f9a2b7446ee5190996e50796d8ec6bf87bd23401',
          short: 'f9a2b7446e',
          date: '2026-10-08T22:48:22Z',
          subject: 'tool: add domain architecture census and ratchet',
          pr: 19768,
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
          delta: { freed: [], entangled: [], splits: [] }
        },
        {
          index: 78,
          kind: 'pr',
          parent: 15,
          sha: 'a44a01294d2765111fcd794c71aa04d1b46fb18c',
          short: 'a44a01294d',
          date: '2026-10-08T00:37:32Z',
          subject: 'feat: classify image crop, compare, and painter domains',
          pr: 19855,
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
          delta: { freed: [], entangled: [], splits: [] }
        },
        {
          index: 79,
          kind: 'pr',
          parent: 78,
          sha: '4b0a0304ef3e954ac22b5b8775302ca881e3fee7',
          short: '4b0a0304ef',
          date: '2026-10-08T00:34:58Z',
          subject: 'feat: classify image compositor domain',
          pr: 19856,
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
          delta: { freed: [], entangled: [], splits: [] }
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
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 240,
          deletions: 233,
          changedFiles: 32,
          baseRefName: 'main',
          headRefName: 'drjkl/widgets-registry-split',
          head: '9536aff6c045a579eeb6b87b083bfdb432c96dc6',
          mergeBase: '9b91a0c8331da05cf9d92f408688d1e6b3d16561',
          behindMain: 0,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 67,
          baseState: 66
        },
        {
          number: 19116,
          title: 'refactor: move progress text previews out of executionStore',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19116',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: null,
          additions: 355,
          deletions: 352,
          changedFiles: 8,
          baseRefName: 'main',
          headRefName: 'drjkl/progress-text-previews-view',
          head: '36ff059f048b607994c6c11bcc2ea32983ac3475',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 68,
          baseState: 53
        },
        {
          number: 19118,
          title:
            'refactor: inject the api auth provider from the composition root',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19118',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: null,
          additions: 178,
          deletions: 99,
          changedFiles: 10,
          baseRefName: 'main',
          headRefName: 'drjkl/api-auth-provider',
          head: '05395c323d07fd802df2646844324fae298d04f2',
          mergeBase: '559647b5da239413188f226434ff96c96d7fd0fe',
          behindMain: 5,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 69,
          baseState: 61
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
          head: '7eb8fa5d819116b8437e930002d5bc48d2364db9',
          mergeBase: '559647b5da239413188f226434ff96c96d7fd0fe',
          behindMain: 5,
          parentPr: 19118,
          containsParentHead: true,
          depth: 1,
          state: 70,
          baseState: 61
        },
        {
          number: 19131,
          title: 'refactor: split feature dialogs out of dialogService',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19131',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'UNKNOWN',
          reviewDecision: null,
          additions: 1380,
          deletions: 1054,
          changedFiles: 81,
          baseRefName: 'drjkl/widgets-registry-split',
          headRefName: 'drjkl/dialog-service-split',
          head: '994757a3922dd2b9134aff926a1a1535e53a297f',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19093,
          containsParentHead: false,
          depth: 1,
          state: 71,
          baseState: 53
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
          head: '15a7e94be18c41731d6e58ee8d96cad7feaad3d1',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19131,
          containsParentHead: true,
          depth: 2,
          state: 72,
          baseState: 53
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
          head: 'b3e92b8080b1639e9f841e2a1e6570b3ed2dfbbf',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19189,
          containsParentHead: true,
          depth: 6,
          state: 76,
          baseState: 53
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
          head: '701c1d8b385f1fd79c55bd3fbcc985b496040bc8',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19143,
          containsParentHead: true,
          depth: 3,
          state: 73,
          baseState: 53
        },
        {
          number: 19186,
          title: 'refactor: break the workbench import cycles',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19186',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 327,
          deletions: 220,
          changedFiles: 24,
          baseRefName: 'drjkl/comfy-types-leaf',
          headRefName: 'drjkl/workbench-cycles',
          head: '1958fcdf59ae5a841baee170842186b9ddc51fda',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19153,
          containsParentHead: true,
          depth: 4,
          state: 74,
          baseState: 53
        },
        {
          number: 19189,
          title: 'refactor: break the small app import cycles',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19189',
          author: 'DrJKL',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 890,
          deletions: 836,
          changedFiles: 153,
          baseRefName: 'drjkl/workbench-cycles',
          headRefName: 'drjkl/app-small-cycles',
          head: '55e2c0696f6c67dada79e1bbb43dbeaaf40dddba',
          mergeBase: '0ef0276323b5819258571bbffe24af14af47dc2e',
          behindMain: 13,
          parentPr: 19186,
          containsParentHead: true,
          depth: 5,
          state: 75,
          baseState: 53
        },
        {
          number: 19768,
          title: 'tool: add domain architecture census and ratchet',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19768',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: 'CHANGES_REQUESTED',
          additions: 2691,
          deletions: 5,
          changedFiles: 18,
          baseRefName: 'main',
          headRefName: 'feat/ddd-architecture-ratchet',
          head: 'f9a2b7446ee5190996e50796d8ec6bf87bd23401',
          mergeBase: 'ef9481abcec3f45b73396568818fc0ba976657a4',
          behindMain: 4,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 77,
          baseState: 62
        },
        {
          number: 19855,
          title: 'feat: classify image crop, compare, and painter domains',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19855',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: 'CHANGES_REQUESTED',
          additions: 490,
          deletions: 19,
          changedFiles: 12,
          baseRefName: 'feat/ddd-architecture-ratchet',
          headRefName: 'feat/ddd-classify-media-tools',
          head: 'a44a01294d2765111fcd794c71aa04d1b46fb18c',
          mergeBase: 'dc556123bd1b548b726ce838b2f2b396779d28ff',
          behindMain: 51,
          parentPr: 19768,
          containsParentHead: false,
          depth: 1,
          state: 78,
          baseState: 15
        },
        {
          number: 19856,
          title: 'feat: classify image compositor domain',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19856',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: null,
          additions: 223,
          deletions: 6,
          changedFiles: 6,
          baseRefName: 'feat/ddd-classify-media-tools',
          headRefName: 'feat/ddd-classify-compositor',
          head: '4b0a0304ef3e954ac22b5b8775302ca881e3fee7',
          mergeBase: 'dc556123bd1b548b726ce838b2f2b396779d28ff',
          behindMain: 51,
          parentPr: 19855,
          containsParentHead: true,
          depth: 2,
          state: 79,
          baseState: 15
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
    aspect: 0.7589,
    nodes: [
      {
        path: 'components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue',
        x: 0.2816,
        y: 0.5487,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ShortcutsList.vue',
        x: 0.2678,
        y: 0.535,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue',
        x: 0.2801,
        y: 0.564,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/terminal/LogsTerminal.vue',
        x: 0.3596,
        y: 0.7674,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/boundingBoxes/WidgetBoundingBoxes.vue',
        x: 0.8631,
        y: 0.6984,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/builder/useEmptyWorkflowDialog.ts',
        x: 0.4902,
        y: 0.4068,
        states: [
          [0, 0],
          [25, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/cameraAngle/CameraAngle.vue',
        x: 0.757,
        y: 0.4893,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/cameraInfo/CameraInfo.vue',
        x: 0.8438,
        y: 0.5283,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/common/BackgroundImageUpload.vue',
        x: 0.382,
        y: 0.7307,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/common/CustomizationDialog.vue',
        x: 0.5304,
        y: 0.8264,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/FormItem.vue',
        x: 0.3037,
        y: 0.8016,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/common/TreeExplorer.vue',
        x: 0.4648,
        y: 0.6794,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerTreeNode.vue',
        x: 0.4722,
        y: 0.6998,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2.vue',
        x: 0.555,
        y: 0.6832,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2Node.vue',
        x: 0.5789,
        y: 0.687,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/WaveAudioPlayer.vue',
        x: 0.4168,
        y: 1,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/curve/WidgetCurve.vue',
        x: 0.7969,
        y: 0.6345,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/custom/widget/TemplateFilterControls.vue',
        x: 0.2522,
        y: 0.6431,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetail.vue',
        x: 0.181,
        y: 0.7516,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetailGroup.vue',
        x: 0.0851,
        y: 0.8602,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadFailure.vue',
        x: 0.1245,
        y: 0.9507,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadStatus.vue',
        x: 0.1178,
        y: 0.905,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateModelStatus.vue',
        x: 0.0661,
        y: 0.9097,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateSelectorDialog.vue',
        x: 0.3471,
        y: 0.5813,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/ApiNodesSignInContent.vue',
        x: 0.4487,
        y: 0.4249,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/ConfirmationDialogContent.vue',
        x: 0.3865,
        y: 0.4203,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/ErrorDialogContent.vue',
        x: 0.4689,
        y: 0.5146,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/SignInContent.vue',
        x: 0.3252,
        y: 0.2267,
        states: [
          [0, 0],
          [72, 17],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/TopUpCreditsDialogContentLegacy.vue',
        x: 0.3308,
        y: 0.319,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/UpdatePasswordContent.vue',
        x: 0.3421,
        y: 0.2032,
        states: [
          [0, 0],
          [72, 17],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/error/FindIssueButton.vue',
        x: 0.3504,
        y: 0.4806,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/AboutPanel.vue',
        x: 0.316,
        y: 0.6292,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/CreditsPanel.vue',
        x: 0.2869,
        y: 0.414,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/CurrentUserMessage.vue',
        x: 0.2243,
        y: 0.6444,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/KeybindingPanel.vue',
        x: 0.3596,
        y: 0.5374,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/UsageLogsTable.vue',
        x: 0.2729,
        y: 0.3415,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/UserPanel.vue',
        x: 0.2955,
        y: 0.4294,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingContent.vue',
        x: 0.0686,
        y: 0.5702,
        states: [
          [0, 0],
          [17, 11],
          [75, -1],
          [77, 11],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingFooter.vue',
        x: 0.2629,
        y: 0.5924,
        states: [
          [0, 0],
          [17, 11],
          [75, -1],
          [77, 11],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingCommandRows.vue',
        x: 0.2957,
        y: 0.5537,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingPresetToolbar.vue',
        x: 0.29,
        y: 0.5895,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/ApiKeyForm.vue',
        x: 0.3482,
        y: 0.2443,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignInForm.vue',
        x: 0.3311,
        y: 0.1719,
        states: [
          [0, 0],
          [72, 17],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignUpForm.vue',
        x: 0.2738,
        y: 0.1292,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/TurnstileWidget.vue',
        x: 0.1903,
        y: 0,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
        x: 0.2583,
        y: 0.3092,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/gradientslider/GradientSlider.vue',
        x: 0.9602,
        y: 0.3523,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/gradientslider/gradients.ts',
        x: 0.9701,
        y: 0.256,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/graph/widgets/MultiSelectWidget.vue',
        x: 0.7755,
        y: 0.6392,
        states: [
          [0, 0],
          [28, -1],
          [78, 0]
        ]
      },
      {
        path: 'components/graph/widgets/TextPreviewWidget.vue',
        x: 0.6438,
        y: 0.608,
        states: [
          [0, 0],
          [68, -1],
          [69, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'components/imagecrop/WidgetImageCrop.vue',
        x: 0.8935,
        y: 0.6399,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/load3d/Load3D.vue',
        x: 0.7395,
        y: 0.5358,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/Load3DAdvanced.vue',
        x: 0.8167,
        y: 0.5752,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/Load3DMenuBar.vue',
        x: 0.7998,
        y: 0.5866,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/Load3dViewerContent.vue',
        x: 0.6724,
        y: 0.6252,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/controls/ViewerControls.vue',
        x: 0.7909,
        y: 0.5871,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/controls/viewer/ViewerLightControls.vue',
        x: 0.6097,
        y: 0.6955,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/load3d/menubar/LightMenuGroup.vue',
        x: 0.6866,
        y: 0.658,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/ImageLayerSettingsPanel.vue',
        x: 0.9657,
        y: 0.8602,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/MaskEditorContent.vue',
        x: 0.854,
        y: 0.6601,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/PointerZone.vue',
        x: 0.934,
        y: 0.7993,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/SidePanel.vue',
        x: 0.9438,
        y: 0.8059,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/ToolPanel.vue',
        x: 0.9281,
        y: 0.8118,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/maskeditor/dialog/TopBarHeader.vue',
        x: 0.8018,
        y: 0.6736,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/node/NodeHelpContent.vue',
        x: 0.6058,
        y: 0.803,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreview.vue',
        x: 0.6247,
        y: 0.622,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreviewCard.vue',
        x: 0.6698,
        y: 0.7144,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePricingBadge.vue',
        x: 0.6531,
        y: 0.8087,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodeProviderBadge.vue',
        x: 0.6421,
        y: 0.8088,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/painter/WidgetPainter.vue',
        x: 0.8343,
        y: 0.7022,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/palette/WidgetColors.vue',
        x: 0.9262,
        y: 0.698,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/JobHistoryActionsMenu.vue',
        x: 0.4491,
        y: 0.6685,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/dialogs/QueueClearHistoryDialog.vue',
        x: 0.4511,
        y: 0.847,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobAssetsList.vue',
        x: 0.4358,
        y: 0.8106,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsHoverPopover.vue',
        x: 0.3711,
        y: 0.7839,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsPopover.vue',
        x: 0.4428,
        y: 0.5836,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobFilterActions.vue',
        x: 0.4364,
        y: 0.844,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/buildVirtualJobRows.ts',
        x: 0.4151,
        y: 0.8822,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useJobErrorReporting.ts',
        x: 0.3897,
        y: 0.5447,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useQueueEstimates.ts',
        x: 0.4662,
        y: 0.6211,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/RangeEditor.vue',
        x: 0.9062,
        y: 0.5132,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/WidgetRange.vue',
        x: 0.8514,
        y: 0.5624,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/rangeUtils.ts',
        x: 0.9566,
        y: 0.5473,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/searchbox/NodeSearchFilter.vue',
        x: 0.5413,
        y: 0.7458,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AppsSidebarTab.vue',
        x: 0.4417,
        y: 0.5191,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarGridView.vue',
        x: 0.5314,
        y: 0.965,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarListView.vue',
        x: 0.5222,
        y: 0.8569,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarTab.vue',
        x: 0.5599,
        y: 0.7852,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/BaseWorkflowsSidebarTab.vue',
        x: 0.4789,
        y: 0.5735,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/JobHistorySidebarTab.vue',
        x: 0.4899,
        y: 0.7009,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/ModelLibrarySidebarTab.vue',
        x: 0.4012,
        y: 0.6515,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTab.vue',
        x: 0.507,
        y: 0.6092,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTabV2.vue',
        x: 0.4833,
        y: 0.6367,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabCloseButton.vue',
        x: 0.427,
        y: 0.7575,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabTemplate.vue',
        x: 0.4613,
        y: 0.7245,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/WorkflowsSidebarTab.vue',
        x: 0.3984,
        y: 0.6997,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/DownloadItem.vue',
        x: 0.1768,
        y: 0.7301,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue',
        x: 0.2496,
        y: 0.7247,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ModelPreview.vue',
        x: 0.3177,
        y: 0.7512,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/AllNodesPanel.vue',
        x: 0.5264,
        y: 0.736,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodeCard.vue',
        x: 0.5925,
        y: 0.73,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodesPanel.vue',
        x: 0.5559,
        y: 0.7675,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeBookmarkTreeExplorer.vue',
        x: 0.5408,
        y: 0.6414,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue',
        x: 0.5269,
        y: 0.7618,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/MediaLightbox.vue',
        x: 0.4849,
        y: 0.8443,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultAudio.vue',
        x: 0.453,
        y: 0.9142,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultText.vue',
        x: 0.463,
        y: 0.9008,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultVideo.vue',
        x: 0.5098,
        y: 0.7025,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue',
        x: 0.4941,
        y: 0.6114,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/topbar/CloudBadge.vue',
        x: 0.4661,
        y: 0.2859,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/topbar/TopbarBadge.vue',
        x: 0.5258,
        y: 0.2379,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'components/videoEdit/VideoEditPanel.vue',
        x: 0.8931,
        y: 0.6202,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/VideoFilmstripTrim.vue',
        x: 0.9744,
        y: 0.6025,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/WidgetVideoEdit.vue',
        x: 0.7815,
        y: 0.5587,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/auth/useAuthActions.ts',
        x: 0.3717,
        y: 0.2993,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/auth/useAuthDialogs.ts',
        x: 0.3744,
        y: 0.2554,
        states: [
          [0, -2],
          [71, 0],
          [72, 17],
          [75, -1],
          [77, -2]
        ]
      },
      {
        path: 'composables/auth/useCurrentUser.ts',
        x: 0.3875,
        y: 0.351,
        states: [[0, 0]]
      },
      {
        path: 'composables/auth/useTurnstile.ts',
        x: 0.2951,
        y: 0.2235,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/billingRail.ts',
        x: 0.1643,
        y: 0.294,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/topupBalanceRefresh.ts',
        x: 0.3375,
        y: 0.1601,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/types.ts',
        x: 0.2478,
        y: 0.3251,
        states: [[0, 0]]
      },
      {
        path: 'composables/billing/useBillingContext.ts',
        x: 0.2626,
        y: 0.3208,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/useBillingDialogs.ts',
        x: 0.2984,
        y: 0.3031,
        states: [
          [0, -2],
          [71, 0],
          [72, 17],
          [77, -2]
        ]
      },
      {
        path: 'composables/billing/useBillingRouting.ts',
        x: 0.2451,
        y: 0.3628,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/useLegacyBilling.ts',
        x: 0.279,
        y: 0.2663,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/useNextInvoice.ts',
        x: 0.1479,
        y: 0.2882,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/billing/usePartnerNodesRunGate.ts',
        x: 0.4504,
        y: 0.3858,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/usePendingTopup.ts',
        x: 0.3016,
        y: 0.2659,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/billing/useSubscriptionPaywall.ts',
        x: 0.2171,
        y: 0.1946,
        states: [
          [0, -2],
          [76, 17],
          [77, -2]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useCommandSubcategories.ts',
        x: 0.264,
        y: 0.5492,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useLogsTerminal.ts',
        x: 0.4763,
        y: 0.6498,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useShortcutsTab.ts',
        x: 0.3383,
        y: 0.5608,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useTerminalTabs.ts',
        x: 0.3673,
        y: 0.6358,
        states: [
          [0, 0],
          [33, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/boundingBoxes/useBoundingBoxes.ts',
        x: 0.7442,
        y: 0.558,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/canvas/useSelectedLiteGraphItems.ts',
        x: 0.6738,
        y: 0.3679,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/canvas/visibleCanvasViewport.ts',
        x: 0.651,
        y: 0.3388,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/element/useAbsolutePosition.ts',
        x: 0.6335,
        y: 0.3637,
        states: [
          [0, 0],
          [28, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/element/useCanvasPositionConversion.ts',
        x: 0.6918,
        y: 0.2999,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/graph/contextMenuConverter.ts',
        x: 0.8042,
        y: 0.4029,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useCanvasRefresh.ts',
        x: 0.625,
        y: 0.2854,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useFrameNodes.ts',
        x: 0.628,
        y: 0.3971,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useGroupMenuOptions.ts',
        x: 0.6245,
        y: 0.3719,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useImageMenuOptions.ts',
        x: 0.6038,
        y: 0.4098,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useMoreOptionsMenu.ts',
        x: 0.6909,
        y: 0.4465,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useNodeArrangement.ts',
        x: 0.7247,
        y: 0.2903,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeCustomization.ts',
        x: 0.6693,
        y: 0.2683,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeErrorFlagSync.ts',
        x: 0.6323,
        y: 0.4627,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/graph/useNodeMenuOptions.ts',
        x: 0.6692,
        y: 0.3346,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectedNodeActions.ts',
        x: 0.5979,
        y: 0.3687,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionMenuOptions.ts',
        x: 0.6672,
        y: 0.3297,
        states: [
          [0, 0],
          [1, 8],
          [75, -1],
          [77, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectionOperations.ts',
        x: 0.5902,
        y: 0.3618,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionState.ts',
        x: 0.6433,
        y: 0.4434,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSubgraphOperations.ts',
        x: 0.6416,
        y: 0.4175,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/imageWidgetAdapter.ts',
        x: 0.7819,
        y: 0.5659,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushDrawing.ts',
        x: 0.8062,
        y: 0.8417,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushPersistence.ts',
        x: 0.6967,
        y: 0.6869,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/useImageLoader.ts',
        x: 0.9235,
        y: 0.7439,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditor.ts',
        x: 0.7916,
        y: 0.5422,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorLoader.ts',
        x: 0.7103,
        y: 0.5602,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorSaver.ts',
        x: 0.6955,
        y: 0.5542,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/maskeditor/useToolManager.ts',
        x: 0.8397,
        y: 0.7243,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/canvasImagePreviewTypes.ts',
        x: 0.8537,
        y: 0.3922,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/startModelNodeDragFromAsset.ts',
        x: 0.4126,
        y: 0.5343,
        states: [
          [0, 0],
          [53, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/node/useNodeAnimatedImage.ts',
        x: 0.675,
        y: 0.3906,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodeCanvasImagePreview.ts',
        x: 0.7904,
        y: 0.4409,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragAndDrop.ts',
        x: 0.6214,
        y: 0.588,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragToCanvas.ts',
        x: 0.5542,
        y: 0.5149,
        states: [
          [0, 0],
          [53, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/node/useNodeFileInput.ts',
        x: 0.6441,
        y: 0.3729,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodeImage.ts',
        x: 0.5573,
        y: 0.3929,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodeImageUpload.ts',
        x: 0.5798,
        y: 0.4885,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodePaste.ts',
        x: 0.6484,
        y: 0.3847,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodePreviewAndDrag.ts',
        x: 0.565,
        y: 0.6546,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/node/useNodePricing.ts',
        x: 0.7323,
        y: 0.4715,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/useNodeProgressText.ts',
        x: 0.67,
        y: 0.4562,
        states: [
          [0, 0],
          [68, -1],
          [69, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/node/usePartnerNodesInGraph.ts',
        x: 0.5521,
        y: 0.4748,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/painter/usePainter.ts',
        x: 0.7171,
        y: 0.5594,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobList.ts',
        x: 0.4854,
        y: 0.6912,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobMenu.ts',
        x: 0.5289,
        y: 0.5629,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueClearHistoryDialog.ts',
        x: 0.4279,
        y: 0.9037,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueFeatureFlags.ts',
        x: 0.453,
        y: 0.7115,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueProgress.ts',
        x: 0.5075,
        y: 0.6808,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useResultGallery.ts',
        x: 0.479,
        y: 0.7732,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useAssetsSidebarTab.ts',
        x: 0.481,
        y: 0.6627,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useJobHistorySidebarTab.ts',
        x: 0.4277,
        y: 0.6603,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useModelLibrarySidebarTab.ts',
        x: 0.3533,
        y: 0.6227,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useNodeLibrarySidebarTab.ts',
        x: 0.4617,
        y: 0.6035,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/tree/useTreeFolderOperations.ts',
        x: 0.4192,
        y: 0.8176,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useAppMode.ts',
        x: 0.5291,
        y: 0.3977,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'composables/useCameraAngle.ts',
        x: 0.8445,
        y: 0.5735,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useCameraInfo.ts',
        x: 0.9336,
        y: 0.5329,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useCopy.ts',
        x: 0.6421,
        y: 0.1952,
        states: [
          [0, -1],
          [54, 0],
          [68, -1],
          [69, 0],
          [71, -1],
          [77, 0],
          [78, -1]
        ]
      },
      {
        path: 'composables/useEditKeybindingDialog.ts',
        x: 0.2224,
        y: 0.5192,
        states: [
          [0, 0],
          [17, 11],
          [75, -1],
          [77, 11],
          [78, 0]
        ]
      },
      {
        path: 'composables/useEssentialTileNodeDef.ts',
        x: 0.5905,
        y: 0.8094,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useFeatureFlags.ts',
        x: 0.3893,
        y: 0.469,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'composables/useImageCrop.ts',
        x: 0.8291,
        y: 0.5493,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useLoad3d.ts',
        x: 0.6751,
        y: 0.5537,
        states: [
          [0, 0],
          [66, 13],
          [68, 0],
          [71, 13],
          [77, 0]
        ]
      },
      {
        path: 'composables/useLoad3dViewer.ts',
        x: 0.6803,
        y: 0.6163,
        states: [
          [0, 0],
          [66, 13],
          [68, 0],
          [71, 13],
          [77, 0]
        ]
      },
      {
        path: 'composables/useNodeHelpContent.ts',
        x: 0.5966,
        y: 0.8214,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/usePaste.ts',
        x: 0.6216,
        y: 0.3486,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useRangeEditor.ts',
        x: 0.945,
        y: 0.5815,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useRunButtonTelemetry.ts',
        x: 0.44,
        y: 0.3205,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useTemplateFiltering.ts',
        x: 0.3696,
        y: 0.5484,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useTreeExpansion.ts',
        x: 0.4544,
        y: 0.6996,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useUpstreamValue.ts',
        x: 0.8116,
        y: 0.5321,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useViewportNodeWiring.ts',
        x: 0.9181,
        y: 0.5656,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/useVueFeatureFlags.ts',
        x: 0.5282,
        y: 0.5148,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'composables/useWaveAudioPlayer.ts',
        x: 0.4445,
        y: 0.8177,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useWorkflowTemplateSelectorDialog.ts',
        x: 0.3877,
        y: 0.4327,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'composables/video/useCropRatioLock.ts',
        x: 0.9709,
        y: 0.6469,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useTimelineScrub.ts',
        x: 0.9945,
        y: 0.6997,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoEditModel.ts',
        x: 0.9126,
        y: 0.5836,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoFilmstrip.ts',
        x: 0.8069,
        y: 0.7225,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoSourceUrl.ts',
        x: 0.6612,
        y: 0.4977,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'config/billingWeb.ts',
        x: 0.2512,
        y: 0.4103,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/comfyApi.ts',
        x: 0.2935,
        y: 0.3606,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/firebase.ts',
        x: 0.275,
        y: 0.1558,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/turnstile.ts',
        x: 0.2412,
        y: 0.1062,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellLifecycle.ts',
        x: 0.7384,
        y: 0.3626,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellState.ts',
        x: 0.8071,
        y: 0.2542,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/adoptPromotedWidgetValue.ts',
        x: 0.8373,
        y: 0.3671,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/liftNodeErrorsToBoundary.ts',
        x: 0.6582,
        y: 0.483,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/preview/previewExposureChain.ts',
        x: 0.9884,
        y: 0.2895,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedInputWidget.ts',
        x: 0.7239,
        y: 0.4616,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedWidgetTypes.ts',
        x: 0.7189,
        y: 0.5029,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotionUtils.ts',
        x: 0.7663,
        y: 0.3883,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveConcretePromotedWidget.ts',
        x: 0.7167,
        y: 0.4434,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolvePromotedWidgetSource.ts',
        x: 0.7434,
        y: 0.4369,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputLink.ts',
        x: 0.7955,
        y: 0.2465,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputTarget.ts',
        x: 0.7455,
        y: 0.3481,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/transferLinkPresentation.ts',
        x: 0.8382,
        y: 0.1987,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/comboWidgetInventory.ts',
        x: 0.7261,
        y: 0.512,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicGroupWidget.ts',
        x: 0.7628,
        y: 0.447,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicInputSpec.ts',
        x: 0.7054,
        y: 0.6135,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicWidgets.ts',
        x: 0.743,
        y: 0.4087,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'core/graph/widgets/nodeWidgetValues.ts',
        x: 0.7938,
        y: 0.5294,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/valueControlWidgets.ts',
        x: 0.6593,
        y: 0.6282,
        states: [
          [0, -2],
          [67, 0],
          [68, -2]
        ]
      },
      {
        path: 'core/schemas/parseNodePropertyArray.ts',
        x: 0.9637,
        y: 0.31,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/previewExposureSchema.ts',
        x: 0.923,
        y: 0.3196,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/promotionSchema.ts',
        x: 0.9656,
        y: 0.2949,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/proxyWidgetQuarantineSchema.ts',
        x: 0.9227,
        y: 0.3518,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'extensions/core/agentPanel.ts',
        x: 0.4773,
        y: 0.3573,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cameraAngle.ts',
        x: 0.7215,
        y: 0.398,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cameraAngle/CameraAngleViewport.ts',
        x: 0.9709,
        y: 0.7293,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cameraInfo.ts',
        x: 0.7437,
        y: 0.4251,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cameraInfo/CameraInfoViewport.ts',
        x: 0.9694,
        y: 0.667,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/clipspace.ts',
        x: 0.5707,
        y: 0.2891,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cloudBadges.ts',
        x: 0.5245,
        y: 0.3178,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cloudFeedbackTopbarButton.ts',
        x: 0.5277,
        y: 0.353,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cloudRemoteConfig.ts',
        x: 0.4483,
        y: 0.3128,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/cloudSessionCookie.ts',
        x: 0.5035,
        y: 0.3041,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/contextMenuFilter.ts',
        x: 0.703,
        y: 0.3153,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/createBoundingBoxes.ts',
        x: 0.5824,
        y: 0.2075,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/customWidgets.ts',
        x: 0.7585,
        y: 0.4321,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/dynamicPrompts.ts',
        x: 0.6882,
        y: 0.2659,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/editAttention.ts',
        x: 0.5948,
        y: 0.2502,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/electronAdapter.ts',
        x: 0.5177,
        y: 0.3542,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/groupNode.ts',
        x: 0.6917,
        y: 0.4178,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/groupOptions.ts',
        x: 0.6576,
        y: 0.3956,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/imageCompare.ts',
        x: 0.6867,
        y: 0.2734,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/imageCompositor.ts',
        x: 0.6982,
        y: 0.4462,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/imageCrop.ts',
        x: 0.6805,
        y: 0.2611,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/index.ts',
        x: 0.6271,
        y: 0.3376,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/layerEditor.ts',
        x: 0.7099,
        y: 0.3757,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/lightInfo.ts',
        x: 0.6097,
        y: 0.2479,
        states: [
          [0, -2],
          [30, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0],
          [78, -2]
        ]
      },
      {
        path: 'extensions/core/load3d.ts',
        x: 0.6802,
        y: 0.4921,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/GizmoManager.ts',
        x: 0.8341,
        y: 0.8445,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/HDRIManager.ts',
        x: 0.7776,
        y: 0.7985,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3DConfiguration.ts',
        x: 0.6991,
        y: 0.515,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3d.ts',
        x: 0.7607,
        y: 0.6813,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3dUtils.ts',
        x: 0.6946,
        y: 0.6358,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/LoaderManager.ts',
        x: 0.7479,
        y: 0.8781,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/MeshModelAdapter.ts',
        x: 0.7422,
        y: 0.9902,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/ModelAdapter.ts',
        x: 0.6877,
        y: 0.8146,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/PointCloudModelAdapter.ts',
        x: 0.6656,
        y: 0.7848,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneManager.ts',
        x: 0.8478,
        y: 0.7847,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneModelManager.ts',
        x: 0.7506,
        y: 0.8513,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/SplatModelAdapter.ts',
        x: 0.7528,
        y: 0.9837,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/Viewport3d.ts',
        x: 0.9088,
        y: 0.7262,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/createLoad3d.ts',
        x: 0.7543,
        y: 0.7645,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/createViewport3d.ts',
        x: 0.9763,
        y: 0.7969,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/exportMenuHelper.ts',
        x: 0.7693,
        y: 0.506,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dSerialize.ts',
        x: 0.7951,
        y: 0.5519,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dViewport.ts',
        x: 0.8705,
        y: 0.7799,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3dAdvanced.ts',
        x: 0.7477,
        y: 0.4713,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3dLazy.ts',
        x: 0.6638,
        y: 0.4085,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/load3dPreviewExtensions.ts',
        x: 0.6968,
        y: 0.4848,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/maskeditor.ts',
        x: 0.7181,
        y: 0.4206,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/nodeTemplates.ts',
        x: 0.5818,
        y: 0.3809,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/noteNode.ts',
        x: 0.7027,
        y: 0.3685,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/painter.ts',
        x: 0.5915,
        y: 0.2013,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/previewAny.ts',
        x: 0.6794,
        y: 0.3533,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/rerouteNode.ts',
        x: 0.7294,
        y: 0.3528,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/saveImageExtraOutput.ts',
        x: 0.6916,
        y: 0.3171,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/saveMesh.ts',
        x: 0.7016,
        y: 0.4665,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/saveText.ts',
        x: 0.6242,
        y: 0.2742,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/selectionBorder.ts',
        x: 0.6496,
        y: 0.2882,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/simpleTouchSupport.ts',
        x: 0.6588,
        y: 0.2856,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/slotDefaultTypes.ts',
        x: 0.7397,
        y: 0.594,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/slotDefaults.ts',
        x: 0.7056,
        y: 0.4068,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/textPreviewWidgets.ts',
        x: 0.6952,
        y: 0.4249,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/uploadAudio.ts',
        x: 0.6449,
        y: 0.4761,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/uploadImage.ts',
        x: 0.6981,
        y: 0.3025,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/webcamCapture.ts',
        x: 0.647,
        y: 0.4368,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/widgetInputs.ts',
        x: 0.7367,
        y: 0.4478,
        states: [
          [0, 0],
          [66, 14],
          [68, 0],
          [71, 14],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'extensions/core/widgetValuePropagation.ts',
        x: 0.774,
        y: 0.4093,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'lib/litegraph/src/CanvasPointer.ts',
        x: 0.8746,
        y: 0.2914,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/ContextMenu.ts',
        x: 0.8632,
        y: 0.2667,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/CurveEditor.ts',
        x: 0.8486,
        y: 0.2353,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/DragAndScale.ts',
        x: 0.7553,
        y: 0.263,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraph.ts',
        x: 0.7708,
        y: 0.2895,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphBadge.ts',
        x: 0.8631,
        y: 0.2812,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphButton.ts',
        x: 0.8788,
        y: 0.3339,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphCanvas.ts',
        x: 0.7945,
        y: 0.2921,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphGroup.ts',
        x: 0.8145,
        y: 0.2741,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphNode.ts',
        x: 0.7953,
        y: 0.3805,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LLink.ts',
        x: 0.7993,
        y: 0.2729,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LinkMap.ts',
        x: 0.8543,
        y: 0.1335,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LiteGraphGlobal.ts',
        x: 0.8222,
        y: 0.2888,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/Reroute.ts',
        x: 0.8161,
        y: 0.2605,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/FloatingRenderLink.ts',
        x: 0.8658,
        y: 0.2541,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/InputIndicators.ts',
        x: 0.9009,
        y: 0.1633,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/LinkConnector.ts',
        x: 0.8271,
        y: 0.2906,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingInputLink.ts',
        x: 0.8314,
        y: 0.2781,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingLinkBase.ts',
        x: 0.8456,
        y: 0.2486,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingOutputLink.ts',
        x: 0.8303,
        y: 0.2699,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/RenderLink.ts',
        x: 0.8227,
        y: 0.2789,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/SelectedItemsView.ts',
        x: 0.8491,
        y: 0.1918,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputFromIoNodeLink.ts',
        x: 0.8218,
        y: 0.2601,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputRenderLink.ts',
        x: 0.8448,
        y: 0.277,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromIoNodeLink.ts',
        x: 0.8335,
        y: 0.2406,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromRerouteLink.ts',
        x: 0.8154,
        y: 0.2437,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputRenderLink.ts',
        x: 0.8397,
        y: 0.2957,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/getCanvasContextMenuTarget.ts',
        x: 0.8262,
        y: 0.1894,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/hitTesting.ts',
        x: 0.8116,
        y: 0.1939,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadgeRenderer.ts',
        x: 0.8293,
        y: 0.1999,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadges.ts',
        x: 0.8669,
        y: 0.2265,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkGeometry.ts',
        x: 0.801,
        y: 0.2342,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkVisibility.ts',
        x: 0.8398,
        y: 0.2189,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/measureSlots.ts',
        x: 0.8551,
        y: 0.3228,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/reduceGesture.ts',
        x: 0.9358,
        y: 0.1706,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/resolvePointerTarget.ts',
        x: 0.838,
        y: 0.2378,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/contextMenuCompat.ts',
        x: 0.7127,
        y: 0.2351,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/draw.ts',
        x: 0.8815,
        y: 0.3039,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/extensionPersistence.ts',
        x: 0.8589,
        y: 0.2179,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/graphIntents.ts',
        x: 0.6815,
        y: 0.3674,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/idAllocation.ts',
        x: 0.8317,
        y: 0.2228,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/ConstrainedSize.ts',
        x: 0.9262,
        y: 0.2058,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphCanvasEventMap.ts',
        x: 0.8613,
        y: 0.2966,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphEventMap.ts',
        x: 0.857,
        y: 0.2897,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LinkConnectorEventMap.ts',
        x: 0.8665,
        y: 0.2842,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/Rectangle.ts',
        x: 0.8521,
        y: 0.3065,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphEventMap.ts',
        x: 0.8554,
        y: 0.3435,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphInputEventMap.ts',
        x: 0.8756,
        y: 0.3674,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/interfaces.ts',
        x: 0.7928,
        y: 0.3362,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/linkDeduplication.ts',
        x: 0.6729,
        y: 0.2917,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraph.ts',
        x: 0.7365,
        y: 0.3967,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraphInstance.ts',
        x: 0.9001,
        y: 0.3192,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/measure.ts',
        x: 0.8035,
        y: 0.2823,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeInputSlot.ts',
        x: 0.8388,
        y: 0.3387,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeOutputSlot.ts',
        x: 0.8448,
        y: 0.3242,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeSlot.ts',
        x: 0.8447,
        y: 0.3406,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/SlotBase.ts',
        x: 0.9144,
        y: 0.2489,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotDescriptorView.ts',
        x: 0.8935,
        y: 0.2968,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotLinks.ts',
        x: 0.7881,
        y: 0.3347,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotUtils.ts',
        x: 0.8084,
        y: 0.2912,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/widgetsView.ts',
        x: 0.8309,
        y: 0.3904,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/nodeBadgeDraw.ts',
        x: 0.769,
        y: 0.2572,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/remintLinkRemap.ts',
        x: 0.8078,
        y: 0.1735,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/strings.ts',
        x: 0.8623,
        y: 0.3143,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphInput.ts',
        x: 0.8752,
        y: 0.2663,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphOutput.ts',
        x: 0.8726,
        y: 0.2558,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/ExecutableNodeDTO.ts',
        x: 0.8138,
        y: 0.3394,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/Subgraph.ts',
        x: 0.8108,
        y: 0.3104,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphIONodeBase.ts',
        x: 0.8347,
        y: 0.2765,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInput.ts',
        x: 0.8236,
        y: 0.3208,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInputNode.ts',
        x: 0.843,
        y: 0.263,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphNode.ts',
        x: 0.8094,
        y: 0.366,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutput.ts',
        x: 0.8386,
        y: 0.2896,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutputNode.ts',
        x: 0.8368,
        y: 0.2621,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphSlotBase.ts',
        x: 0.8522,
        y: 0.2824,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/promotedWidgetStoreProjection.ts',
        x: 0.8558,
        y: 0.4064,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphDeduplication.ts',
        x: 0.7459,
        y: 0.2595,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphUtils.ts',
        x: 0.8172,
        y: 0.3113,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/unpackSubgraph.ts',
        x: 0.832,
        y: 0.326,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/NodeLike.ts',
        x: 0.8583,
        y: 0.2529,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/contextMenu.ts',
        x: 0.8661,
        y: 0.3054,
        states: [
          [0, -2],
          [43, 9],
          [78, -2]
        ]
      },
      {
        path: 'lib/litegraph/src/types/events.ts',
        x: 0.8312,
        y: 0.3138,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/linkNetwork.ts',
        x: 0.8311,
        y: 0.2547,
        states: [
          [0, -2],
          [43, 9],
          [78, -2]
        ]
      },
      {
        path: 'lib/litegraph/src/types/panel.ts',
        x: 0.9045,
        y: 0.3405,
        states: [
          [0, -2],
          [43, 9],
          [78, -2]
        ]
      },
      {
        path: 'lib/litegraph/src/types/serialisation.ts',
        x: 0.7684,
        y: 0.3188,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/slots.ts',
        x: 0.83,
        y: 0.306,
        states: [
          [0, -2],
          [43, 9],
          [78, -2]
        ]
      },
      {
        path: 'lib/litegraph/src/types/widgets.ts',
        x: 0.8346,
        y: 0.4568,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/arrange.ts',
        x: 0.8133,
        y: 0.2193,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/collections.ts',
        x: 0.8647,
        y: 0.2461,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/feedback.ts',
        x: 0.8314,
        y: 0.3566,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/linkColors.ts',
        x: 0.8031,
        y: 0.2144,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiff.ts',
        x: 0.7759,
        y: 0.326,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiffTelemetry.ts',
        x: 0.6367,
        y: 0.3071,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/type.ts',
        x: 0.8137,
        y: 0.3444,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/widget.ts',
        x: 0.8465,
        y: 0.4398,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/AssetWidget.ts',
        x: 0.936,
        y: 0.395,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseSteppedWidget.ts',
        x: 0.9686,
        y: 0.3893,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseWidget.ts',
        x: 0.8948,
        y: 0.4056,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BooleanWidget.ts',
        x: 0.9797,
        y: 0.453,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxWidget.ts',
        x: 0.988,
        y: 0.4349,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxesWidget.ts',
        x: 0.9723,
        y: 0.4641,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ButtonWidget.ts',
        x: 0.9327,
        y: 0.383,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ChartWidget.ts',
        x: 0.9899,
        y: 0.4819,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorWidget.ts',
        x: 0.9768,
        y: 0.3963,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorsWidget.ts',
        x: 0.9854,
        y: 0.4434,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ComboWidget.ts',
        x: 0.8758,
        y: 0.3801,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CompositorWidget.ts',
        x: 0.9897,
        y: 0.466,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CurveWidget.ts',
        x: 0.9896,
        y: 0.4085,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/FileUploadWidget.ts',
        x: 1,
        y: 0.4685,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GalleriaWidget.ts',
        x: 0.9833,
        y: 0.4885,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GradientSliderWidget.ts',
        x: 0.9486,
        y: 0.4514,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCompareWidget.ts',
        x: 0.9956,
        y: 0.4826,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCropWidget.ts',
        x: 0.9857,
        y: 0.3978,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/KnobWidget.ts',
        x: 0.9503,
        y: 0.4376,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LegacyWidget.ts',
        x: 0.8495,
        y: 0.4241,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LightInfoWidget.ts',
        x: 0.9896,
        y: 0.4215,
        states: [
          [0, -2],
          [30, 9],
          [78, -2]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MarkdownWidget.ts',
        x: 1,
        y: 0.4561,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MultiSelectWidget.ts',
        x: 0.9907,
        y: 0.4941,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/NumberWidget.ts',
        x: 0.9507,
        y: 0.4241,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/PainterWidget.ts',
        x: 0.9735,
        y: 0.4445,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/RangeWidget.ts',
        x: 0.9837,
        y: 0.4207,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SelectButtonWidget.ts',
        x: 0.9824,
        y: 0.5005,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SliderWidget.ts',
        x: 0.9482,
        y: 0.4608,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextWidget.ts',
        x: 0.9323,
        y: 0.404,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextareaWidget.ts',
        x: 0.9764,
        y: 0.4346,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TreeSelectWidget.ts',
        x: 0.9744,
        y: 0.4263,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VideoEditWidget.ts',
        x: 0.9768,
        y: 0.4091,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VueOnlyWidget.ts',
        x: 0.945,
        y: 0.4746,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/widgetMap.ts',
        x: 0.9113,
        y: 0.4261,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/assets/components/AssetBrowserModal.vue',
        x: 0.3889,
        y: 0.6351,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/AssetCard.vue',
        x: 0.4362,
        y: 0.6811,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/AssetGrid.vue',
        x: 0.3421,
        y: 0.7589,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/Media3DTop.vue',
        x: 0.5021,
        y: 0.8786,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAssetCard.vue',
        x: 0.5023,
        y: 0.8285,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAudioTop.vue',
        x: 0.4631,
        y: 0.9515,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaImageTop.vue',
        x: 0.4799,
        y: 0.9456,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaTextTop.vue',
        x: 0.4867,
        y: 0.9503,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaVideoTop.vue',
        x: 0.4952,
        y: 0.95,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelConfirmation.vue',
        x: 0.2764,
        y: 0.7997,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelDialog.vue',
        x: 0.2642,
        y: 0.7406,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelProgress.vue',
        x: 0.2575,
        y: 0.8246,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUpgradeModal.vue',
        x: 0.1891,
        y: 0.5233,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUrlInput.vue',
        x: 0.2658,
        y: 0.5742,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/components/modelInfo/ModelInfoPanel.vue',
        x: 0.3791,
        y: 0.6418,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/composables/media/assetMappers.ts',
        x: 0.5054,
        y: 0.7401,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/composables/openModelLibraryBrowser.ts',
        x: 0.399,
        y: 0.4838,
        states: [
          [0, 0],
          [53, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowser.ts',
        x: 0.3954,
        y: 0.6569,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowserDialog.ts',
        x: 0.4683,
        y: 0.4947,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetDownload.ts',
        x: 0.4753,
        y: 0.4799,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetGridSelection.ts',
        x: 0.7564,
        y: 0.8161,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetSelection.ts',
        x: 0.5562,
        y: 0.9736,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetZipExport.ts',
        x: 0.4895,
        y: 0.5277,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetsQuery.ts',
        x: 0.4708,
        y: 0.7194,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useMediaAssetActions.ts',
        x: 0.5407,
        y: 0.587,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useModelTypes.ts',
        x: 0.3499,
        y: 0.703,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useModelUpload.ts',
        x: 0.2905,
        y: 0.6779,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useNodeOutputsExport.ts',
        x: 0.5498,
        y: 0.4556,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useOutputStacks.ts',
        x: 0.5412,
        y: 0.9002,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useUploadModelWizard.ts',
        x: 0.3729,
        y: 0.6899,
        states: [
          [0, 0],
          [32, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/assets/schemas/assetMetadataSchema.ts',
        x: 0.5442,
        y: 0.7611,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/schemas/mediaAssetSchema.ts',
        x: 0.5148,
        y: 0.761,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/services/assetService.ts',
        x: 0.5293,
        y: 0.5963,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/utils/assetDragUtil.ts',
        x: 0.5024,
        y: 0.8193,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/assetPreviewUtil.ts',
        x: 0.5282,
        y: 0.6885,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/utils/assetUrlUtil.ts',
        x: 0.4918,
        y: 0.6902,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/utils/clearDeletedAssetWidgetValues.ts',
        x: 0.6638,
        y: 0.5711,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/clearNodePreviewCacheForValues.ts',
        x: 0.6513,
        y: 0.5362,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/createAssetWidget.ts',
        x: 0.6616,
        y: 0.4701,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/assets/utils/markDeletedAssetsAsMissingMedia.ts',
        x: 0.6377,
        y: 0.523,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/marqueeSelectionUtil.ts',
        x: 0.8703,
        y: 0.8273,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/mediaIconUtil.ts',
        x: 0.5062,
        y: 0.9631,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetCountUtil.ts',
        x: 0.5433,
        y: 0.8417,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetUtil.ts',
        x: 0.5353,
        y: 0.7748,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputExportUtil.ts',
        x: 0.5137,
        y: 0.5761,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/resolveModelNodeFromAsset.ts',
        x: 0.4079,
        y: 0.6019,
        states: [
          [0, 0],
          [53, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/auth/firebaseIdentity.ts',
        x: 0.341,
        y: 0.3057,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/auth/session/cloudWebSessionStore.ts',
        x: 0.3564,
        y: 0.4042,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/session/components/SignOutEverywhereButton.vue',
        x: 0.2657,
        y: 0.3799,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/auth/session/useSessionCookie.ts',
        x: 0.3889,
        y: 0.3997,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/social/useSocialSignIn.ts',
        x: 0.3803,
        y: 0.232,
        states: [
          [0, 0],
          [72, 17],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/auth/sso/SsoRequiredDialogContent.vue',
        x: 0.3227,
        y: 0.1876,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/sso/ssoRequired.ts',
        x: 0.3545,
        y: 0.333,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/unified/remintRetry.ts',
        x: 0.3698,
        y: 0.3987,
        states: [[0, 0]]
      },
      {
        path: 'platform/canvas/minimapDecorationRegistry.ts',
        x: 0.5263,
        y: 0.1639,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/churnkey/churnkeyClient.ts',
        x: 0.3292,
        y: 0.3617,
        states: [
          [0, 0],
          [14, -2]
        ]
      },
      {
        path: 'platform/cloud/notification/components/CloudNotificationContent.vue',
        x: 0.3432,
        y: 0.256,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CancellationFlowDialogContent.vue',
        x: 0.2267,
        y: 0.26,
        states: [
          [0, -2],
          [14, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CreditsTile.vue',
        x: 0.2769,
        y: 0.3129,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/PricingTable.vue',
        x: 0.3074,
        y: 0.2806,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/RetentionOfferStep.vue',
        x: 0.1039,
        y: 0.1889,
        states: [
          [0, -2],
          [14, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscribeButton.vue',
        x: 0.2876,
        y: 0.247,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionFooterLinks.vue',
        x: 0.1797,
        y: 0.3355,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue',
        x: 0.3489,
        y: 0.3171,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useAccountPreconditionDialog.ts',
        x: 0.4062,
        y: 0.3308,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useBillingPlans.ts',
        x: 0.3167,
        y: 0.3327,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useCancellationPlan.ts',
        x: 0.1349,
        y: 0.2387,
        states: [
          [0, -2],
          [14, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useFreeTierQuota.ts',
        x: 0.4228,
        y: 0.3574,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useRetentionOffer.ts',
        x: 0.1824,
        y: 0.2682,
        states: [
          [0, -2],
          [14, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscription.ts',
        x: 0.3144,
        y: 0.3091,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionActions.ts',
        x: 0.3174,
        y: 0.3769,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts',
        x: 0.2522,
        y: 0.2318,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCredits.ts',
        x: 0.1622,
        y: 0.2207,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionDialog.ts',
        x: 0.2803,
        y: 0.3148,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/constants/tierPricing.ts',
        x: 0.2235,
        y: 0.2822,
        states: [
          [0, 0],
          [4, 10],
          [75, -1],
          [77, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/launchCancellationFlow.ts',
        x: 0.289,
        y: 0.3163,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/billingPlanTelemetry.ts',
        x: 0.1752,
        y: 0.2245,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/checkoutAttributionLoader.ts',
        x: 0.2211,
        y: 0.1135,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/paymentReturnUrl.ts',
        x: 0.1817,
        y: 0.3194,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/planCreditGrant.ts',
        x: 0.0781,
        y: 0.2424,
        states: [
          [0, -2],
          [14, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCancellationTelemetry.ts',
        x: 0.2355,
        y: 0.2509,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutTracker.ts',
        x: 0.2673,
        y: 0.2384,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutUtil.ts',
        x: 0.317,
        y: 0.2771,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionTierRank.ts',
        x: 0.2534,
        y: 0.2848,
        states: [
          [0, 0],
          [4, 10],
          [75, -1],
          [77, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/tierBenefits.ts',
        x: 0.1107,
        y: 0.2256,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/errorCatalog/errorMessageResolver.ts',
        x: 0.406,
        y: 0.7531,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/executionErrorResolver.ts',
        x: 0.3711,
        y: 0.8369,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/missingErrorResolver.ts',
        x: 0.4847,
        y: 0.8111,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/promptErrorResolver.ts',
        x: 0.3822,
        y: 0.8419,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/runtimeErrorCopy.ts',
        x: 0.3683,
        y: 0.8593,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/types.ts',
        x: 0.4569,
        y: 0.6589,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/validationErrorResolver.ts',
        x: 0.3651,
        y: 0.8259,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/keybindings/keybindingService.ts',
        x: 0.4284,
        y: 0.5198,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/keybindings/presetService.ts',
        x: 0.421,
        y: 0.5013,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaAssetResolver.ts',
        x: 0.5232,
        y: 0.5289,
        states: [
          [0, 0],
          [10, -2]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaGrouping.ts',
        x: 0.5556,
        y: 0.8082,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaPipeline.ts',
        x: 0.5967,
        y: 0.468,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaScan.ts',
        x: 0.6337,
        y: 0.4772,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaStore.ts',
        x: 0.6209,
        y: 0.5067,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingMedia/types.ts',
        x: 0.5859,
        y: 0.5801,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingModel/folderPathCache.ts',
        x: 0.3777,
        y: 0.6637,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelDownload.ts',
        x: 0.3637,
        y: 0.5786,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelGrouping.ts',
        x: 0.5916,
        y: 0.7016,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelMetadata.ts',
        x: 0.426,
        y: 0.5803,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelPipeline.ts',
        x: 0.5619,
        y: 0.4965,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelScan.ts',
        x: 0.6582,
        y: 0.5114,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelStore.ts',
        x: 0.6217,
        y: 0.4465,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/missingModel/types.ts',
        x: 0.59,
        y: 0.5582,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/nodeReplacement/cnrIdUtil.ts',
        x: 0.6454,
        y: 0.309,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodeScan.ts',
        x: 0.6076,
        y: 0.388,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodesErrorStore.ts',
        x: 0.6077,
        y: 0.4413,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementService.ts',
        x: 0.413,
        y: 0.5146,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementStore.ts',
        x: 0.4961,
        y: 0.4604,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/onboarding/coachmarkRegistry.ts',
        x: 0.5369,
        y: 0.1724,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingReplay.ts',
        x: 0.3963,
        y: 0.2634,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTourStore.ts',
        x: 0.4637,
        y: 0.3258,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTours.ts',
        x: 0.4717,
        y: 0.2222,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/tourState.ts',
        x: 0.4351,
        y: 0.1285,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/useTourTriggers.ts',
        x: 0.53,
        y: 0.2712,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/execution/types.ts',
        x: 0.5817,
        y: 0.561,
        states: [
          [0, 0],
          [69, 15],
          [71, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/fetchJobs.ts',
        x: 0.5301,
        y: 0.5714,
        states: [
          [0, 0],
          [69, 15],
          [71, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/jobTypes.ts',
        x: 0.5294,
        y: 0.6507,
        states: [
          [0, 0],
          [69, 15],
          [71, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/refreshRemoteConfig.ts',
        x: 0.39,
        y: 0.3681,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/remoteConfig.ts',
        x: 0.3361,
        y: 0.2842,
        states: [
          [0, 0],
          [4, 10],
          [75, -1],
          [77, 10]
        ]
      },
      {
        path: 'platform/remoteConfig/types.ts',
        x: 0.2992,
        y: 0.1811,
        states: [
          [0, 0],
          [4, 10],
          [75, -1],
          [77, 10]
        ]
      },
      {
        path: 'platform/secrets/api/secretsApi.ts',
        x: 0.2772,
        y: 0.7333,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/secrets/components/SecretFormDialog.vue',
        x: 0.0527,
        y: 0.8199,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/secrets/components/SecretsPanel.vue',
        x: 0.1539,
        y: 0.7066,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecretForm.ts',
        x: 0.1272,
        y: 0.837,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecrets.ts',
        x: 0.1418,
        y: 0.8069,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/ColorPaletteMessage.vue',
        x: 0.4415,
        y: 0.5001,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/ExtensionPanel.vue',
        x: 0.4283,
        y: 0.557,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/ServerConfigPanel.vue',
        x: 0.3704,
        y: 0.6623,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/SettingDialog.vue',
        x: 0.3218,
        y: 0.513,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/SettingGroup.vue',
        x: 0.2045,
        y: 0.7912,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/SettingItem.vue',
        x: 0.351,
        y: 0.7187,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/SettingsPanel.vue',
        x: 0.1894,
        y: 0.669,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/components/SettingsWorkspaceHeader.vue',
        x: 0.1627,
        y: 0.4312,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingSearch.ts',
        x: 0.4182,
        y: 0.5492,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingUI.ts',
        x: 0.3346,
        y: 0.5308,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingsDialog.ts',
        x: 0.3357,
        y: 0.4191,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/settings/globalSettingsApi.ts',
        x: 0.3679,
        y: 0.4321,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/settings/missingWarningVisibility.ts',
        x: 0.581,
        y: 0.5242,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/settings/settingStore.ts',
        x: 0.5404,
        y: 0.5269,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/skills/api/skillsApi.ts',
        x: 0.3397,
        y: 0.5406,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/skills/components/SkillPackFormDialog.vue',
        x: 0.1275,
        y: 0.548,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/skills/components/SkillPacksPanel.vue',
        x: 0.1949,
        y: 0.5571,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPackForm.ts',
        x: 0.2726,
        y: 0.4888,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPacks.ts',
        x: 0.2977,
        y: 0.4879,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/skills/stores/skillPacksStore.ts',
        x: 0.3239,
        y: 0.4709,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/support/feedbackDialog.ts',
        x: 0.4196,
        y: 0.2641,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/tasks/services/taskService.ts',
        x: 0.5087,
        y: 0.6576,
        states: [
          [0, 0],
          [69, 15],
          [71, 0]
        ]
      },
      {
        path: 'platform/telemetry/hostTelemetryEnabled.ts',
        x: 0.3836,
        y: 0.2068,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/imageFailureDiagnostics.ts',
        x: 0.4446,
        y: 0.2496,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/index.ts',
        x: 0.3967,
        y: 0.382,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/installNodeAddedTelemetry.ts',
        x: 0.5607,
        y: 0.4021,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/nodeAddSource.ts',
        x: 0.5017,
        y: 0.4933,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/perf/bootstrapTracer.ts',
        x: 0.4859,
        y: 0.3577,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/reportError.ts',
        x: 0.467,
        y: 0.3838,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/searchQuery/useSearchQueryTracking.ts',
        x: 0.4018,
        y: 0.5216,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/types.ts',
        x: 0.3787,
        y: 0.3547,
        states: [
          [0, 0],
          [4, 10],
          [75, -1],
          [77, 10]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingFailureCategory.ts',
        x: 0.2876,
        y: 0.2926,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingPortalTelemetry.ts',
        x: 0.2697,
        y: 0.2809,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/checkoutAttribution.ts',
        x: 0.2771,
        y: 0.193,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getActionbarDockState.ts',
        x: 0.368,
        y: 0.195,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getExecutionContext.ts',
        x: 0.5232,
        y: 0.4434,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/groupMissingNodesByPack.ts',
        x: 0.4989,
        y: 0.3655,
        states: [
          [0, 0],
          [13, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/paymentIntentSource.ts',
        x: 0.2378,
        y: 0.3506,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/workflowExecutionContext.ts',
        x: 0.4831,
        y: 0.32,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowActionsService.ts',
        x: 0.5016,
        y: 0.4711,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowService.ts',
        x: 0.5466,
        y: 0.4141,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/modelRequirements.ts',
        x: 0.4427,
        y: 0.6523,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/pendingWarnings.ts',
        x: 0.5487,
        y: 0.4407,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
        x: 0.7116,
        y: 0.5134,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowId.ts',
        x: 0.5249,
        y: 0.4798,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowToClipboardItems.ts',
        x: 0.639,
        y: 0.2367,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useAppsSidebarTab.ts',
        x: 0.3745,
        y: 0.5896,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useWorkflowsSidebarTab.ts',
        x: 0.4675,
        y: 0.5796,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/stores/comfyWorkflow.ts',
        x: 0.514,
        y: 0.4866,
        states: [[0, 0]]
      },
      {
        path: 'platform/workflow/management/stores/workflowStore.ts',
        x: 0.5657,
        y: 0.4423,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/management/stores/workflowStoreTypes.ts',
        x: 0.3957,
        y: 0.5592,
        states: [
          [0, -2],
          [73, 0],
          [77, -2]
        ]
      },
      {
        path: 'platform/workflow/persistence/stores/workflowDraftStoreV2.ts',
        x: 0.5364,
        y: 0.414,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue',
        x: 0.4571,
        y: 0.2561,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue',
        x: 0.3535,
        y: 0.0377,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
        x: 0.3784,
        y: 0.0861,
        states: [
          [0, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubFinishStep.vue',
        x: 0.4418,
        y: 0.1829,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue',
        x: 0.4631,
        y: 0.2712,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue',
        x: 0.4432,
        y: 0.0951,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue',
        x: 0.3952,
        y: 0.1954,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubProfileGate.ts',
        x: 0.4019,
        y: 0.1723,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishSubmission.ts',
        x: 0.4757,
        y: 0.264,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishWizard.ts',
        x: 0.4771,
        y: 0.2282,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useSharedWorkflowUrlLoader.ts',
        x: 0.4603,
        y: 0.3646,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/comfyHubService.ts',
        x: 0.4314,
        y: 0.2647,
        states: [
          [0, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/workflowShareService.ts',
        x: 0.5015,
        y: 0.391,
        states: [
          [0, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/types/shareTypes.ts',
        x: 0.5019,
        y: 0.3407,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
        x: 0.4455,
        y: 0.545,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
        x: 0.2627,
        y: 0.6914,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateWorkflows.ts',
        x: 0.4918,
        y: 0.5072,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
        x: 0.4261,
        y: 0.5337,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/services/templateInputService.ts',
        x: 0.6389,
        y: 0.5326,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
        x: 0.4455,
        y: 0.4685,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/types/templateDetail.ts',
        x: 0.168,
        y: 0.7979,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelAvailability.ts',
        x: 0.4464,
        y: 0.6074,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelDownloadState.ts',
        x: 0.2308,
        y: 0.821,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelMetadata.ts',
        x: 0.4314,
        y: 0.6021,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelRequirements.ts',
        x: 0.4487,
        y: 0.6287,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelSetup.ts',
        x: 0.4339,
        y: 0.6157,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workflow/utils/workflowExtractionUtil.ts',
        x: 0.5677,
        y: 0.7112,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/validation/composables/useWorkflowValidation.ts',
        x: 0.6985,
        y: 0.388,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/validation/schemas/workflowSchema.ts',
        x: 0.6009,
        y: 0.5418,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/api/partnerNodePolicyApi.ts',
        x: 0.349,
        y: 0.5741,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApi.ts',
        x: 0.2324,
        y: 0.3248,
        states: [
          [0, 0],
          [70, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApiUrl.ts',
        x: 0.3164,
        y: 0.436,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/customerAttention.ts',
        x: 0.1919,
        y: 0.348,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/hostedBillingRoutes.ts',
        x: 0.1802,
        y: 0.4007,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/openHostedBillingTab.ts',
        x: 0.2899,
        y: 0.3878,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingCapabilitiesView.ts',
        x: 0.1097,
        y: 0.3306,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingPlansView.ts',
        x: 0.1134,
        y: 0.3089,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingSdkStore.ts',
        x: 0.2361,
        y: 0.3636,
        states: [
          [0, 0],
          [72, 17],
          [76, 19],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingStatusView.ts',
        x: 0.1089,
        y: 0.3214,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/operationRecordView.ts',
        x: 0.1265,
        y: 0.3455,
        states: [
          [0, 0],
          [70, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/subscriptionOperationView.ts',
        x: 0.1994,
        y: 0.353,
        states: [
          [0, 0],
          [70, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/topupOperationView.ts',
        x: 0.1702,
        y: 0.3485,
        states: [
          [0, 0],
          [70, -1],
          [71, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/webSessionBillingSession.ts',
        x: 0.227,
        y: 0.4172,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/stripePublishableKey.ts',
        x: 0.2128,
        y: 0.2507,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/subscribeInput.ts',
        x: 0.1401,
        y: 0.3024,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/InviteMembersForm.vue',
        x: 0.2863,
        y: 0.2689,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/PricingTableWorkspace.vue',
        x: 0.2576,
        y: 0.3663,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue',
        x: 0.1842,
        y: 0.2552,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
        x: 0.2217,
        y: 0.3105,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue',
        x: 0.2285,
        y: 0.2721,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue',
        x: 0.2315,
        y: 0.2837,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionSuccessWorkspace.vue',
        x: 0.1913,
        y: 0.2381,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionTransitionPreviewWorkspace.vue',
        x: 0.1676,
        y: 0.2427,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue',
        x: 0.3212,
        y: 0.3669,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/UnifiedPricingTable.vue',
        x: 0.1909,
        y: 0.2976,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/WorkspaceProfilePic.vue',
        x: 0.105,
        y: 0.3416,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/ChangeMemberRoleDialogContent.vue',
        x: 0.2538,
        y: 0.266,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/CreateWorkspaceDialogContent.vue',
        x: 0.2976,
        y: 0.2113,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue',
        x: 0.2782,
        y: 0.2295,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue',
        x: 0.2865,
        y: 0.2195,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteLinkList.vue',
        x: 0.2205,
        y: 0.0583,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberDialogContent.vue',
        x: 0.2697,
        y: 0.2061,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberUpsellDialogContent.vue',
        x: 0.2522,
        y: 0.2494,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteWrongAccountDialogContent.vue',
        x: 0.3173,
        y: 0.2357,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue',
        x: 0.2883,
        y: 0.211,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RemoveMemberDialogContent.vue',
        x: 0.2647,
        y: 0.2568,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RevokeInviteDialogContent.vue',
        x: 0.2712,
        y: 0.252,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue',
        x: 0.2723,
        y: 0.2192,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/TeamWorkspacesDialogContent.vue',
        x: 0.2059,
        y: 0.2848,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
        x: 0.2155,
        y: 0.3381,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MemberListItem.vue',
        x: 0.1724,
        y: 0.1801,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
        x: 0.1598,
        y: 0.2473,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue',
        x: 0.3584,
        y: 0.5129,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PendingInvitesList.vue',
        x: 0.2108,
        y: 0.1675,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue',
        x: 0.1732,
        y: 0.3727,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue',
        x: 0.108,
        y: 0.2922,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue',
        x: 0.1709,
        y: 0.3576,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue',
        x: 0.2335,
        y: 0.3037,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceSettingsPanelContent.vue',
        x: 0.217,
        y: 0.4601,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/components/subscriptionPanelWorkspace.logic.ts',
        x: 0.1424,
        y: 0.2731,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/readOnRail.ts',
        x: 0.2447,
        y: 0.297,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingBanner.ts',
        x: 0.2236,
        y: 0.3718,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingCapabilities.ts',
        x: 0.2932,
        y: 0.3387,
        states: [
          [0, 0],
          [72, 17],
          [76, 19],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingReadRail.ts',
        x: 0.2722,
        y: 0.3726,
        states: [
          [0, 0],
          [72, 17],
          [76, 19],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useCheckoutCopy.ts',
        x: 0.1186,
        y: 0.1944,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useDowngradeToPersonal.ts',
        x: 0.2882,
        y: 0.3367,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useHasSavedPaymentMethod.ts',
        x: 0.3087,
        y: 0.3178,
        states: [
          [0, 0],
          [15, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useMembersPanel.ts',
        x: 0.2583,
        y: 0.3437,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/usePlanEnded.ts',
        x: 0.1628,
        y: 0.3156,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useResubscribe.ts',
        x: 0.243,
        y: 0.337,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useScheduledPlanChange.ts',
        x: 0.1553,
        y: 0.2717,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionCheckout.ts',
        x: 0.3041,
        y: 0.3513,
        states: [
          [0, 0],
          [72, 17],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionRail.ts',
        x: 0.248,
        y: 0.3914,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useTeamPlan.ts',
        x: 0.1372,
        y: 0.3161,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useTopupOperation.ts',
        x: 0.2788,
        y: 0.3912,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceBilling.ts',
        x: 0.2842,
        y: 0.352,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceDialogs.ts',
        x: 0.2378,
        y: 0.2132,
        states: [
          [0, -2],
          [71, 0],
          [72, 17],
          [77, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceMenuItems.ts',
        x: 0.2235,
        y: 0.3284,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspacePlanPricing.ts',
        x: 0.1448,
        y: 0.2483,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceSwitch.ts',
        x: 0.1754,
        y: 0.1989,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceTierLabel.ts',
        x: 0.1231,
        y: 0.2693,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceUI.ts',
        x: 0.2557,
        y: 0.387,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/billingOperationStore.ts',
        x: 0.2919,
        y: 0.3462,
        states: [
          [0, 0],
          [72, 17],
          [76, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/legacyWorkspaceTokenRail.ts',
        x: 0.2668,
        y: 0.4385,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/partnerNodeGovernanceStore.ts',
        x: 0.2932,
        y: 0.4842,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/teamWorkspaceStore.ts',
        x: 0.3109,
        y: 0.3233,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/workspaceAuthStore.ts',
        x: 0.3306,
        y: 0.3845,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/utils/checkoutJourney.ts',
        x: 0.2707,
        y: 0.3604,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/checkoutJourneyTelemetry.ts',
        x: 0.2619,
        y: 0.2999,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/inviteLinks.ts',
        x: 0.3101,
        y: 0.1679,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/pendingSubscriptionCheckout.ts',
        x: 0.1975,
        y: 0.2654,
        states: [
          [0, 0],
          [70, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/platformLink.ts',
        x: 0.2089,
        y: 0.2941,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/workspaceCheckoutTelemetry.ts',
        x: 0.3202,
        y: 0.2862,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/cameraState.ts',
        x: 0.6661,
        y: 0.2194,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/canvasStore.ts',
        x: 0.6648,
        y: 0.3732,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasInteractionMode.ts',
        x: 0.6632,
        y: 0.303,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasPointerEvent.ts',
        x: 0.7482,
        y: 0.219,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkConnectorAdapter.ts',
        x: 0.7569,
        y: 0.29,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkDropOrchestrator.ts',
        x: 0.7773,
        y: 0.174,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/arrangeForLegacyRender.ts',
        x: 0.7808,
        y: 0.209,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/litegraphLinkAdapter.ts',
        x: 0.7894,
        y: 0.2263,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/selectionAdapter.ts',
        x: 0.7835,
        y: 0.2633,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/slotCalculations.ts',
        x: 0.7873,
        y: 0.2545,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useAutoPan.ts',
        x: 0.7978,
        y: 0.1509,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasInteractions.ts',
        x: 0.5799,
        y: 0.3679,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasScheduler.ts',
        x: 0.5727,
        y: 0.3244,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/core/layout/operations/graphLayoutAttachment.ts',
        x: 0.8215,
        y: 0.2318,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/operations/layoutMutations.ts',
        x: 0.736,
        y: 0.234,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/slots/syncSlotOffsets.ts',
        x: 0.7744,
        y: 0.3013,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/layout/store/layoutStore.ts',
        x: 0.7285,
        y: 0.2607,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/transform/graphRenderTransform.ts',
        x: 0.8309,
        y: 0.1549,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/transform/useTransformState.ts',
        x: 0.682,
        y: 0.4038,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/utils/nodeSizeUtil.ts',
        x: 0.7665,
        y: 0.1931,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/spatial/boundsCalculator.ts',
        x: 0.668,
        y: 0.0972,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/thumbnail/graphThumbnailRenderer.ts',
        x: 0.6175,
        y: 0.2264,
        states: [
          [0, 0],
          [21, -1],
          [78, 0]
        ]
      },
      {
        path: 'renderer/core/thumbnail/useWorkflowThumbnail.ts',
        x: 0.5532,
        y: 0.2717,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/compositor/components/WidgetCompositor.vue',
        x: 0.7683,
        y: 0.543,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSave.ts',
        x: 0.8704,
        y: 0.4982,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSession.ts',
        x: 0.7131,
        y: 0.4958,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorWidgets.ts',
        x: 0.8088,
        y: 0.4828,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorAutoSave.ts',
        x: 0.9013,
        y: 0.4701,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorEditor.ts',
        x: 0.8545,
        y: 0.5353,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorLayers.ts',
        x: 0.7786,
        y: 0.4856,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorPsdDownload.ts',
        x: 0.8344,
        y: 0.5154,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/gettingStarted/firstRunEntry.ts',
        x: 0.4236,
        y: 0.3829,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/heuristicRoles.ts',
        x: 0.7323,
        y: 0.2901,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/resolveTourRoles.ts',
        x: 0.6991,
        y: 0.2614,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/tourSequence.ts',
        x: 0.6537,
        y: 0.0887,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/cameraFraming.ts',
        x: 0.7,
        y: 0.1996,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/canvasCoachTarget.ts',
        x: 0.6515,
        y: 0.2484,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/firstRunTourDefinition.ts',
        x: 0.5918,
        y: 0.2278,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/useFirstRunTourController.ts',
        x: 0.4939,
        y: 0.376,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/components/LayerEditorContent.vue',
        x: 0.7637,
        y: 0.4874,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/layerEditorDialog.ts',
        x: 0.77,
        y: 0.5684,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/useLayerEditor.ts',
        x: 0.7829,
        y: 0.4746,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/linearMode/AppInput.vue',
        x: 0.6402,
        y: 0.4886,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/data/MinimapDataSource.ts',
        x: 0.6522,
        y: 0.2596,
        states: [
          [0, 0],
          [21, -1],
          [78, 0]
        ]
      },
      {
        path: 'renderer/extensions/minimap/minimapCanvasRenderer.ts',
        x: 0.6918,
        y: 0.1812,
        states: [
          [0, 0],
          [21, -1],
          [78, 0]
        ]
      },
      {
        path: 'renderer/extensions/minimap/types.ts',
        x: 0.6548,
        y: 0.1761,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/InputSlot.vue',
        x: 0.732,
        y: 0.3063,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
        x: 0.7561,
        y: 0.5109,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeBadge.vue',
        x: 0.9598,
        y: 0.2519,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeHeader.vue',
        x: 0.8266,
        y: 0.381,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeSlots.vue',
        x: 0.7128,
        y: 0.3495,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/OutputSlot.vue',
        x: 0.7257,
        y: 0.2535,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/SlotConnectionDot.vue',
        x: 0.7551,
        y: 0.1947,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/WidgetGrid.vue',
        x: 0.7754,
        y: 0.4346,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeTooltips.ts',
        x: 0.6809,
        y: 0.4197,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeZIndex.ts',
        x: 0.7061,
        y: 0.2443,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkInteraction.ts',
        x: 0.7393,
        y: 0.2991,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkReveal.ts',
        x: 0.6897,
        y: 0.2366,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useVueNodeResizeTracking.ts',
        x: 0.7458,
        y: 0.2885,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts',
        x: 0.7642,
        y: 0.2795,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/types/widgetGrid.ts',
        x: 0.8677,
        y: 0.5582,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/eventUtils.ts',
        x: 0.869,
        y: 0.3186,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/linkedCoreMediaUtils.ts',
        x: 0.6904,
        y: 0.5708,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/nodeDataUtils.ts',
        x: 0.714,
        y: 0.2685,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlButton.vue',
        x: 0.9126,
        y: 0.7629,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlPopover.vue',
        x: 0.7241,
        y: 0.6707,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetButton.vue',
        x: 0.937,
        y: 0.6796,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.types.ts',
        x: 0.9933,
        y: 0.5664,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.vue',
        x: 0.9503,
        y: 0.6484,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue',
        x: 0.9067,
        y: 0.6082,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetDynamicGroupRow.vue',
        x: 0.9183,
        y: 0.7056,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
        x: 0.75,
        y: 0.5458,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue',
        x: 0.9147,
        y: 0.6626,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberGradientSlider.vue',
        x: 0.9011,
        y: 0.5153,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue',
        x: 0.9219,
        y: 0.6086,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberSlider.vue',
        x: 0.9352,
        y: 0.7191,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue',
        x: 0.9039,
        y: 0.702,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue',
        x: 0.8238,
        y: 0.4283,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.vue',
        x: 0.9315,
        y: 0.6879,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetRecordAudio.vue',
        x: 0.7604,
        y: 0.5643,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetResolutionPreview.vue',
        x: 0.8275,
        y: 0.5288,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue',
        x: 0.7347,
        y: 0.6829,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue',
        x: 0.7344,
        y: 0.6189,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue',
        x: 0.681,
        y: 0.7116,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue',
        x: 0.685,
        y: 0.5219,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue',
        x: 0.8182,
        y: 0.6042,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue',
        x: 0.9062,
        y: 0.6181,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue',
        x: 0.8424,
        y: 0.7358,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue',
        x: 0.5986,
        y: 0.8546,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.vue',
        x: 0.4509,
        y: 0.9826,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuFilter.vue',
        x: 0.3167,
        y: 0.9085,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuItem.vue',
        x: 0.4852,
        y: 0.9163,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue',
        x: 0.8544,
        y: 0.6707,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/audio/useAudioRecorder.ts',
        x: 0.7515,
        y: 0.738,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData.ts',
        x: 0.5681,
        y: 0.7603,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBooleanWidget.ts',
        x: 0.852,
        y: 0.4977,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget.ts',
        x: 0.8765,
        y: 0.4478,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesSources.ts',
        x: 0.7137,
        y: 0.5342,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget.ts',
        x: 0.8758,
        y: 0.436,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useChartWidget.ts',
        x: 0.8702,
        y: 0.4207,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorWidget.ts',
        x: 0.8598,
        y: 0.4478,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorsWidget.ts',
        x: 0.8658,
        y: 0.4238,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts',
        x: 0.6813,
        y: 0.548,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCompositorWidget.ts',
        x: 0.8648,
        y: 0.4824,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCurveWidget.ts',
        x: 0.8652,
        y: 0.4566,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useDismissOnCanvasGesture.ts',
        x: 0.6569,
        y: 0.6081,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useFloatWidget.ts',
        x: 0.7202,
        y: 0.5421,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget.ts',
        x: 0.8555,
        y: 0.462,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
        x: 0.7217,
        y: 0.5296,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts',
        x: 0.8755,
        y: 0.4594,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget.ts',
        x: 0.7175,
        y: 0.4531,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget.ts',
        x: 0.6697,
        y: 0.4718,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useIntWidget.ts',
        x: 0.7081,
        y: 0.5425,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget.ts',
        x: 0.9424,
        y: 0.5627,
        states: [
          [0, -2],
          [30, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0],
          [78, -2]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget.ts',
        x: 0.7341,
        y: 0.4612,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts',
        x: 0.866,
        y: 0.4361,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget.ts',
        x: 0.7213,
        y: 0.4904,
        states: [
          [0, 0],
          [68, -1],
          [69, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRangeWidget.ts',
        x: 0.8611,
        y: 0.4954,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts',
        x: 0.5839,
        y: 0.4351,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useResolutionPreviewWidget.ts',
        x: 0.8756,
        y: 0.4739,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useStringWidget.ts',
        x: 0.751,
        y: 0.444,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useTextareaWidget.ts',
        x: 0.8648,
        y: 0.4722,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget.ts',
        x: 0.8542,
        y: 0.4792,
        states: [
          [0, 0],
          [67, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions.ts',
        x: 0.5945,
        y: 0.5837,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems.ts',
        x: 0.6078,
        y: 0.7335,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts',
        x: 0.8398,
        y: 0.6036,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/audioUtils.ts',
        x: 0.6569,
        y: 0.5863,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas.ts',
        x: 0.6777,
        y: 0.5241,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/multilineTextarea.ts',
        x: 0.6956,
        y: 0.4704,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget.ts',
        x: 0.8889,
        y: 0.4033,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/savedImageUrls.ts',
        x: 0.6282,
        y: 0.5673,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/utils/nodeTypeGuards.ts',
        x: 0.8401,
        y: 0.4197,
        states: [
          [0, 0],
          [66, 14],
          [68, 0],
          [71, 14],
          [75, -2],
          [77, 0]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecTree.ts',
        x: 0.6462,
        y: 0.5702,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecUtil.ts',
        x: 0.6674,
        y: 0.7514,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/searchableSlotTypes.ts',
        x: 0.6935,
        y: 0.6997,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/api.ts',
        x: 0.5125,
        y: 0.539,
        states: [
          [0, 0],
          [69, 15],
          [71, 0]
        ]
      },
      {
        path: 'scripts/app.ts',
        x: 0.6186,
        y: 0.4446,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'scripts/appInstance.ts',
        x: 0.6247,
        y: 0.4577,
        states: [
          [0, -2],
          [72, 0],
          [77, -2]
        ]
      },
      {
        path: 'scripts/appRegistry.ts',
        x: 0.5688,
        y: 0.5388,
        states: [
          [0, -2],
          [72, 0],
          [77, -2]
        ]
      },
      {
        path: 'scripts/changeTracker.ts',
        x: 0.6223,
        y: 0.4855,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'scripts/clipspace.ts',
        x: 0.6294,
        y: 0.5522,
        states: [
          [0, -2],
          [72, 0],
          [73, 18],
          [77, -2]
        ]
      },
      {
        path: 'scripts/defaultGraph.ts',
        x: 0.5416,
        y: 0.4677,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/domWidget.ts',
        x: 0.7413,
        y: 0.4821,
        states: [
          [0, 0],
          [28, 12],
          [75, -1],
          [77, 12],
          [78, 0]
        ]
      },
      {
        path: 'scripts/errorNodeWidgets.ts',
        x: 0.8108,
        y: 0.4975,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'scripts/metadata/avif.ts',
        x: 0.6697,
        y: 0.6888,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ebml.ts',
        x: 0.6556,
        y: 0.7508,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/gltf.ts',
        x: 0.6472,
        y: 0.7536,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/isobmff.ts',
        x: 0.6244,
        y: 0.7564,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/mp3.ts',
        x: 0.6386,
        y: 0.7443,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ogg.ts',
        x: 0.6307,
        y: 0.7636,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/parser.ts',
        x: 0.6486,
        y: 0.7034,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'scripts/metadata/svg.ts',
        x: 0.6833,
        y: 0.8886,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/pnginfo.ts',
        x: 0.6785,
        y: 0.5351,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'scripts/promotedWidgetControl.ts',
        x: 0.7105,
        y: 0.4869,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      { path: 'scripts/ui.ts', x: 0.528, y: 0.3905, states: [[0, 0]] },
      {
        path: 'scripts/ui/components/asyncDialog.ts',
        x: 0.5097,
        y: 0.2031,
        states: [
          [0, 0],
          [24, -1],
          [78, 0]
        ]
      },
      {
        path: 'scripts/ui/components/button.ts',
        x: 0.547,
        y: 0.3407,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/buttonGroup.ts',
        x: 0.516,
        y: 0.2968,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/popup.ts',
        x: 0.531,
        y: 0.2871,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/splitButton.ts',
        x: 0.5203,
        y: 0.2859,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/dialog.ts',
        x: 0.5044,
        y: 0.2258,
        states: [
          [0, 0],
          [24, -1],
          [78, 0]
        ]
      },
      {
        path: 'scripts/ui/imagePreview.ts',
        x: 0.659,
        y: 0.3704,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'scripts/ui/menu/index.ts',
        x: 0.5459,
        y: 0.3232,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/settings.ts',
        x: 0.5384,
        y: 0.3644,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/toggleSwitch.ts',
        x: 0.4912,
        y: 0.1676,
        states: [
          [0, 0],
          [24, -1],
          [78, 0]
        ]
      },
      { path: 'scripts/utils.ts', x: 0.5615, y: 0.4433, states: [[0, 0]] },
      {
        path: 'scripts/valueControl.ts',
        x: 0.824,
        y: 0.4989,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/valueControlWidgets.ts',
        x: 0.6608,
        y: 0.6187,
        states: [
          [0, -2],
          [71, 0],
          [73, -1],
          [77, -2]
        ]
      },
      {
        path: 'scripts/widgets.ts',
        x: 0.7757,
        y: 0.4797,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'services/audioService.ts',
        x: 0.6393,
        y: 0.6548,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'services/colorPaletteService.ts',
        x: 0.5766,
        y: 0.4766,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'services/customerEventsService.ts',
        x: 0.3907,
        y: 0.3373,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'services/dialogService.ts',
        x: 0.3871,
        y: 0.3781,
        states: [[0, 0]]
      },
      {
        path: 'services/dialogServiceTypes.ts',
        x: 0.3067,
        y: 0.4223,
        states: [
          [0, -2],
          [73, 0],
          [77, -2]
        ]
      },
      {
        path: 'services/extensionService.ts',
        x: 0.5901,
        y: 0.3893,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'services/jobOutputCache.ts',
        x: 0.5312,
        y: 0.6709,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'services/litegraphService.ts',
        x: 0.6553,
        y: 0.466,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'services/load3dService.ts',
        x: 0.7335,
        y: 0.5621,
        states: [
          [0, 0],
          [66, 13],
          [68, 0],
          [71, 13],
          [77, 0]
        ]
      },
      {
        path: 'services/nodeHelpService.ts',
        x: 0.569,
        y: 0.7336,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeOrganizationService.ts',
        x: 0.4989,
        y: 0.7074,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeSearchService.ts',
        x: 0.6278,
        y: 0.8365,
        states: [
          [0, 0],
          [69, 16],
          [71, 0],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'services/subgraphPseudoWidgetCache.ts',
        x: 0.747,
        y: 0.6119,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'services/subgraphService.ts',
        x: 0.6654,
        y: 0.4383,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'services/useNewUserService.ts',
        x: 0.4285,
        y: 0.4445,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/aboutPanelStore.ts',
        x: 0.4388,
        y: 0.5558,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'stores/apiKeyAuthStore.ts',
        x: 0.4512,
        y: 0.3418,
        states: [[0, 0]]
      },
      {
        path: 'stores/appModeStore.ts',
        x: 0.6246,
        y: 0.422,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/assetDownloadStore.ts',
        x: 0.4606,
        y: 0.6529,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/assetExportStore.ts',
        x: 0.5071,
        y: 0.6276,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/assetsStore.ts',
        x: 0.5255,
        y: 0.6289,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      { path: 'stores/authStore.ts', x: 0.3828, y: 0.331, states: [[0, 0]] },
      {
        path: 'stores/clearNodeOwnedStoreState.ts',
        x: 0.8699,
        y: 0.3503,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/commandStore.ts',
        x: 0.425,
        y: 0.4691,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/domWidgetStore.ts',
        x: 0.6511,
        y: 0.4131,
        states: [
          [0, 0],
          [28, 12],
          [75, -1],
          [77, 12],
          [78, 0]
        ]
      },
      {
        path: 'stores/electronDownloadStore.ts',
        x: 0.2967,
        y: 0.6064,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/entityIdStore.ts',
        x: 0.8669,
        y: 0.1159,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/executionErrorStore.ts',
        x: 0.5885,
        y: 0.4602,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/executionStore.ts',
        x: 0.5453,
        y: 0.5033,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/extensionStore.ts',
        x: 0.5379,
        y: 0.5163,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/graphMetadataStore.ts',
        x: 0.872,
        y: 0.0891,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/jobPreviewStore.ts',
        x: 0.5516,
        y: 0.5906,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/linkPresentationStore.ts',
        x: 0.7462,
        y: 0.2414,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/linkStore.ts',
        x: 0.7472,
        y: 0.2643,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'stores/maskEditorDataStore.ts',
        x: 0.8106,
        y: 0.6154,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/menuItemStore.ts',
        x: 0.5232,
        y: 0.4266,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/modelStore.ts',
        x: 0.4054,
        y: 0.621,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/modelToNodeStore.ts',
        x: 0.4749,
        y: 0.6376,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/nodeBookmarkStore.ts',
        x: 0.5391,
        y: 0.6972,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/nodeDataStore.ts',
        x: 0.8359,
        y: 0.1784,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/nodeDefStore.ts',
        x: 0.5954,
        y: 0.6021,
        states: [
          [0, 0],
          [69, 16],
          [71, 0],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/nodeOutputStore.ts',
        x: 0.6619,
        y: 0.5135,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/previewExposureStore.ts',
        x: 0.8193,
        y: 0.3733,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/queueStore.ts',
        x: 0.5128,
        y: 0.6246,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/rekeyGraphId.ts',
        x: 0.8596,
        y: 0.0827,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/rerouteStore.ts',
        x: 0.8177,
        y: 0.1414,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'stores/resultItemParsing.ts',
        x: 0.5378,
        y: 0.7257,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/subgraphNavigationStore.ts',
        x: 0.6301,
        y: 0.3819,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/subgraphStore.ts',
        x: 0.5682,
        y: 0.5099,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/systemStatsStore.ts',
        x: 0.3906,
        y: 0.5892,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'stores/userFileStore.ts',
        x: 0.4892,
        y: 0.5919,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'stores/userStore.ts',
        x: 0.3362,
        y: 0.6505,
        states: [
          [0, 0],
          [17, -1],
          [78, 0]
        ]
      },
      {
        path: 'stores/widgetStore.ts',
        x: 0.6792,
        y: 0.5046,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/widgetValueStore.ts',
        x: 0.7658,
        y: 0.4382,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/workspace/assetsSidebarBadgeStore.ts',
        x: 0.4259,
        y: 0.7033,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/bottomPanelStore.ts',
        x: 0.4538,
        y: 0.4944,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/workspace/favoritedWidgetsStore.ts',
        x: 0.6897,
        y: 0.4338,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'stores/workspace/nodeHelpStore.ts',
        x: 0.5558,
        y: 0.7479,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/rightSidePanelStore.ts',
        x: 0.6057,
        y: 0.5367,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/workspace/sidebarTabStore.ts',
        x: 0.4527,
        y: 0.5509,
        states: [
          [0, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'stores/workspaceStore.ts',
        x: 0.5021,
        y: 0.4403,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'systems/badgeSystem.ts',
        x: 0.6407,
        y: 0.3975,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      { path: 'types/comfy.ts', x: 0.5825, y: 0.4413, states: [[0, 0]] },
      {
        path: 'types/extensionTypes.ts',
        x: 0.459,
        y: 0.5237,
        states: [[0, 0]]
      },
      {
        path: 'types/index.ts',
        x: 0.6047,
        y: 0.4934,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'types/linkTopology.ts',
        x: 0.8166,
        y: 0.1804,
        states: [
          [0, 0],
          [4, 9],
          [43, -1],
          [78, 9]
        ]
      },
      {
        path: 'types/metadataTypes.ts',
        x: 0.66,
        y: 0.7667,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'types/nodeOrganizationTypes.ts',
        x: 0.5155,
        y: 0.7211,
        states: [
          [0, 0],
          [69, 16],
          [71, 0],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'types/nodeState.ts',
        x: 0.7599,
        y: 0.358,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/simplifiedWidget.ts',
        x: 0.8185,
        y: 0.5889,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/treeExplorerTypes.ts',
        x: 0.4939,
        y: 0.6736,
        states: [
          [0, 0],
          [69, 16],
          [71, 0],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'types/widgetState.ts',
        x: 0.8376,
        y: 0.4662,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/createAnnotatedPath.ts',
        x: 0.6161,
        y: 0.56,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/errorReportUtil.ts',
        x: 0.5822,
        y: 0.4095,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/errorSeverityClassification.ts',
        x: 0.592,
        y: 0.6169,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/eventUtils.ts',
        x: 0.5872,
        y: 0.6642,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/executionUtil.ts',
        x: 0.6797,
        y: 0.4836,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/graphTraversalUtil.ts',
        x: 0.6691,
        y: 0.4285,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/imageUtil.ts',
        x: 0.6284,
        y: 0.4987,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/linkFixer.ts',
        x: 0.7945,
        y: 0.3158,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/litegraphUtil.ts',
        x: 0.7022,
        y: 0.4386,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'utils/mathUtil.ts',
        x: 0.8385,
        y: 0.6256,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/migration/migrateReroute.ts',
        x: 0.6161,
        y: 0.6208,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/missingResourceAbsorption.ts',
        x: 0.6361,
        y: 0.5771,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeDefUtil.ts',
        x: 0.878,
        y: 0.5833,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeFilterUtil.ts',
        x: 0.6722,
        y: 0.303,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeOutputUtil.ts',
        x: 0.6631,
        y: 0.656,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/positionBounds.ts',
        x: 0.7253,
        y: 0.1766,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/queueDisplay.ts',
        x: 0.4622,
        y: 0.7956,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/queueUtil.ts',
        x: 0.4323,
        y: 0.74,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/resultItem.ts',
        x: 0.5019,
        y: 0.7581,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/resultItemUrl.ts',
        x: 0.4853,
        y: 0.7597,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/searchAndReplace.ts',
        x: 0.6672,
        y: 0.3575,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/sessionFeatureFlagOverride.ts',
        x: 0.3777,
        y: 0.4483,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/syncUtil.ts',
        x: 0.4843,
        y: 0.5424,
        states: [
          [0, 0],
          [69, -1],
          [71, 0]
        ]
      },
      {
        path: 'utils/treeUtil.ts',
        x: 0.4343,
        y: 0.6256,
        states: [
          [0, 0],
          [69, 16],
          [71, 0],
          [75, -1],
          [77, 0]
        ]
      },
      {
        path: 'utils/typeGuardUtil.ts',
        x: 0.6266,
        y: 0.4319,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/videoMetadataUtil.ts',
        x: 0.6605,
        y: 0.7165,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/vintageClipboard.ts',
        x: 0.6124,
        y: 0.3969,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/eventHelpers.ts',
        x: 0.6331,
        y: 0.1923,
        states: [
          [0, 0],
          [72, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useAgentConsent.ts',
        x: 0.398,
        y: 0.3076,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useComposer.ts',
        x: 0.2312,
        y: 0.5008,
        states: [
          [0, 0],
          [29, -1],
          [78, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentCrdtDocLifecycle.ts',
        x: 0.2578,
        y: 0.4358,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentSubgraphDefinitions.ts',
        x: 0.7824,
        y: 0.1597,
        states: [
          [0, -1],
          [3, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/devPanelLog.ts',
        x: 0.3212,
        y: 0.4053,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/docOpMinter.ts',
        x: 0.7277,
        y: 0.3389,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/restoreOpMinter.ts',
        x: 0.6599,
        y: 0.2418,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/agentEventTransport.ts',
        x: 0.1098,
        y: 0.4685,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/undeliverableAskReporter.ts',
        x: 0.2118,
        y: 0.448,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/workflowTabActivityTracker.ts',
        x: 0.5012,
        y: 0.2653,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentComposerStore.ts',
        x: 0.3134,
        y: 0.5049,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConsentStore.ts',
        x: 0.3697,
        y: 0.3113,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [71, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConversationStore.ts',
        x: 0.0519,
        y: 0.4928,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentPanelStore.ts',
        x: 0.4922,
        y: 0.3947,
        states: [
          [0, 0],
          [73, 18],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerAttachment.ts',
        x: 0.3212,
        y: 0.6914,
        states: [
          [0, -2],
          [29, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0],
          [78, -2]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerPrompt.ts',
        x: 0.2056,
        y: 0.6058,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/agentMessageText.ts',
        x: 0,
        y: 0.5582,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/composerPrompt.ts',
        x: 0.1388,
        y: 0.5563,
        states: [
          [0, 0],
          [66, -1],
          [68, 0],
          [69, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/starterPrompts.ts',
        x: 0.2431,
        y: 0.4533,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/utils/nodeDefOrderingUtil.ts',
        x: 0.7015,
        y: 0.573,
        states: [
          [0, 0],
          [69, -1],
          [71, 0],
          [73, -1],
          [77, 0]
        ]
      },
      {
        path: 'workbench/utils/nodeHelpUtil.ts',
        x: 0.608,
        y: 0.8191,
        states: [
          [0, 0],
          [1, -1]
        ]
      }
    ],
    edges: [
      [
        193,
        481,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [480, 481, [[0, 3]]],
      [481, 486, [[0, 79]]],
      [481, 588, [[0, 3]]],
      [481, 592, [[0, 3]]],
      [481, 721, [[0, 79]]],
      [481, 722, [[0, 79]]],
      [
        481,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [193, 213, [[0, 3]]],
      [193, 557, [[0, 3]]],
      [193, 588, [[0, 3]]],
      [
        193,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [193, 991, [[0, 3]]],
      [213, 557, [[0, 3]]],
      [
        557,
        558,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        558,
        594,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        508,
        594,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        517,
        594,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        508,
        557,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        508,
        517,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [588, 594, [[0, 3]]],
      [
        487,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [553, 864, [[0, 79]]],
      [554, 864, [[0, 79]]],
      [555, 864, [[0, 79]]],
      [588, 864, [[0, 3]]],
      [644, 864, [[0, 3]]],
      [
        864,
        919,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [864, 991, [[0, 3]]],
      [
        193,
        487,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [486, 487, [[0, 79]]],
      [487, 588, [[0, 3]]],
      [487, 592, [[0, 3]]],
      [487, 594, [[0, 3]]],
      [487, 722, [[0, 79]]],
      [
        193,
        486,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [485, 486, [[0, 79]]],
      [486, 592, [[0, 3]]],
      [485, 919, [[0, 79]]],
      [
        193,
        919,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [214, 919, [[0, 3]]],
      [480, 919, [[0, 3]]],
      [481, 919, [[0, 79]]],
      [487, 919, [[0, 79]]],
      [548, 919, [[0, 3]]],
      [
        556,
        919,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [588, 919, [[0, 3]]],
      [592, 919, [[0, 3]]],
      [721, 919, [[0, 79]]],
      [722, 919, [[0, 79]]],
      [901, 919, [[0, 79]]],
      [914, 919, [[0, 79]]],
      [214, 557, [[0, 3]]],
      [215, 480, [[0, 3]]],
      [480, 557, [[0, 3]]],
      [215, 557, [[0, 3]]],
      [548, 592, [[0, 3]]],
      [586, 592, [[0, 3]]],
      [557, 586, [[0, 3]]],
      [556, 557, [[0, 3]]],
      [
        556,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        646,
        721,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [116, 721, [[0, 79]]],
      [
        193,
        721,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [483, 721, [[0, 79]]],
      [592, 721, [[0, 3]]],
      [721, 722, [[0, 79]]],
      [
        646,
        647,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        487,
        646,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [588, 646, [[0, 3]]],
      [
        646,
        919,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [214, 647, [[0, 3]]],
      [
        647,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [116, 914, [[0, 79]]],
      [116, 919, [[0, 79]]],
      [
        116,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        921,
        960,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [353, 960, [[0, 3]]],
      [355, 960, [[0, 3]]],
      [
        553,
        960,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [644, 960, [[0, 3]]],
      [
        865,
        960,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        897,
        960,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [960, 961, [[0, 79]]],
      [
        306,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        314,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        315,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        318,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        374,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        375,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        378,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        391,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        350,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        386,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [306, 355, [[0, 79]]],
      [321, 355, [[0, 79]]],
      [338, 355, [[0, 79]]],
      [322, 355, [[0, 79]]],
      [324, 355, [[0, 79]]],
      [327, 355, [[0, 79]]],
      [328, 355, [[0, 79]]],
      [331, 355, [[0, 79]]],
      [305, 355, [[0, 79]]],
      [308, 355, [[0, 79]]],
      [
        350,
        355,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [351, 355, [[0, 79]]],
      [
        353,
        355,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 355, [[0, 79]]],
      [
        310,
        355,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        311,
        355,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [312, 355, [[0, 79]]],
      [313, 355, [[0, 79]]],
      [314, 355, [[0, 79]]],
      [317, 355, [[0, 79]]],
      [355, 356, [[0, 79]]],
      [315, 355, [[0, 79]]],
      [
        355,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [355, 358, [[0, 79]]],
      [355, 359, [[0, 79]]],
      [355, 364, [[0, 79]]],
      [318, 355, [[0, 79]]],
      [355, 371, [[0, 79]]],
      [355, 372, [[0, 79]]],
      [355, 376, [[0, 79]]],
      [355, 382, [[0, 79]]],
      [355, 386, [[0, 79]]],
      [355, 389, [[0, 79]]],
      [355, 391, [[0, 79]]],
      [355, 398, [[0, 79]]],
      [355, 399, [[0, 79]]],
      [355, 402, [[0, 79]]],
      [355, 419, [[0, 79]]],
      [355, 433, [[0, 79]]],
      [319, 321, [[0, 79]]],
      [321, 322, [[0, 79]]],
      [321, 323, [[0, 79]]],
      [321, 324, [[0, 79]]],
      [321, 325, [[0, 79]]],
      [321, 327, [[0, 79]]],
      [321, 328, [[0, 79]]],
      [321, 329, [[0, 79]]],
      [321, 330, [[0, 79]]],
      [321, 331, [[0, 79]]],
      [229, 321, [[0, 3]]],
      [321, 349, [[0, 79]]],
      [
        321,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 321, [[0, 79]]],
      [315, 321, [[0, 79]]],
      [321, 363, [[0, 79]]],
      [318, 321, [[0, 79]]],
      [321, 369, [[0, 79]]],
      [321, 370, [[0, 79]]],
      [321, 372, [[0, 79]]],
      [321, 374, [[0, 79]]],
      [321, 375, [[0, 79]]],
      [321, 377, [[0, 79]]],
      [321, 378, [[0, 79]]],
      [321, 386, [[0, 79]]],
      [321, 391, [[0, 79]]],
      [321, 930, [[0, 3]]],
      [319, 325, [[0, 79]]],
      [319, 349, [[0, 79]]],
      [
        319,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 319, [[0, 79]]],
      [315, 319, [[0, 79]]],
      [318, 319, [[0, 79]]],
      [319, 374, [[0, 79]]],
      [319, 377, [[0, 79]]],
      [325, 349, [[0, 79]]],
      [
        325,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 325, [[0, 79]]],
      [325, 355, [[0, 79]]],
      [325, 374, [[0, 79]]],
      [325, 373, [[0, 79]]],
      [325, 377, [[0, 79]]],
      [325, 384, [[0, 79]]],
      [322, 349, [[0, 79]]],
      [324, 349, [[0, 79]]],
      [327, 349, [[0, 79]]],
      [328, 349, [[0, 79]]],
      [314, 349, [[0, 79]]],
      [315, 349, [[0, 79]]],
      [318, 349, [[0, 79]]],
      [349, 375, [[0, 79]]],
      [349, 378, [[0, 79]]],
      [349, 386, [[0, 79]]],
      [349, 391, [[0, 79]]],
      [322, 323, [[0, 79]]],
      [229, 322, [[0, 3]]],
      [
        322,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 322, [[0, 79]]],
      [315, 322, [[0, 79]]],
      [318, 322, [[0, 79]]],
      [322, 377, [[0, 79]]],
      [322, 384, [[0, 79]]],
      [322, 389, [[0, 79]]],
      [323, 325, [[0, 79]]],
      [323, 349, [[0, 79]]],
      [
        323,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 323, [[0, 79]]],
      [315, 323, [[0, 79]]],
      [318, 323, [[0, 79]]],
      [323, 374, [[0, 79]]],
      [323, 377, [[0, 79]]],
      [323, 384, [[0, 79]]],
      [323, 930, [[0, 3]]],
      [314, 338, [[0, 79]]],
      [308, 314, [[0, 79]]],
      [314, 342, [[0, 79]]],
      [314, 343, [[0, 79]]],
      [314, 344, [[0, 79]]],
      [314, 345, [[0, 79]]],
      [
        314,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 314, [[0, 79]]],
      [
        310,
        314,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        311,
        314,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [312, 314, [[0, 79]]],
      [314, 354, [[0, 79]]],
      [314, 315, [[0, 79]]],
      [
        314,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 358, [[0, 79]]],
      [314, 359, [[0, 79]]],
      [314, 362, [[0, 79]]],
      [314, 363, [[0, 79]]],
      [314, 364, [[0, 79]]],
      [314, 365, [[0, 79]]],
      [314, 366, [[0, 79]]],
      [314, 318, [[0, 79]]],
      [314, 375, [[0, 79]]],
      [314, 378, [[0, 79]]],
      [314, 386, [[0, 79]]],
      [314, 384, [[0, 79]]],
      [314, 389, [[0, 79]]],
      [314, 391, [[0, 79]]],
      [314, 393, [[0, 79]]],
      [314, 394, [[0, 79]]],
      [314, 396, [[0, 79]]],
      [314, 397, [[0, 79]]],
      [314, 402, [[0, 79]]],
      [314, 433, [[0, 79]]],
      [218, 314, [[0, 79]]],
      [314, 398, [[0, 79]]],
      [314, 738, [[0, 79]]],
      [314, 742, [[0, 79]]],
      [314, 745, [[0, 79]]],
      [314, 951, [[0, 79]]],
      [314, 966, [[0, 79]]],
      [
        338,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        338,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        308,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        342,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        342,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [342, 356, [[0, 79]]],
      [
        350,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [317, 356, [[0, 79]]],
      [317, 320, [[0, 79]]],
      [306, 317, [[0, 79]]],
      [307, 317, [[0, 79]]],
      [308, 317, [[0, 79]]],
      [317, 342, [[0, 79]]],
      [
        317,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        317,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 317, [[0, 79]]],
      [312, 317, [[0, 79]]],
      [313, 317, [[0, 79]]],
      [314, 317, [[0, 79]]],
      [315, 317, [[0, 79]]],
      [
        317,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [317, 318, [[0, 79]]],
      [317, 373, [[0, 79]]],
      [317, 379, [[0, 79]]],
      [312, 320, [[0, 79]]],
      [312, 332, [[0, 79]]],
      [312, 333, [[0, 79]]],
      [312, 334, [[0, 79]]],
      [312, 335, [[0, 79]]],
      [312, 321, [[0, 79]]],
      [312, 337, [[0, 79]]],
      [312, 338, [[0, 79]]],
      [312, 340, [[0, 79]]],
      [312, 326, [[0, 79]]],
      [305, 312, [[0, 79]]],
      [306, 312, [[0, 79]]],
      [308, 312, [[0, 79]]],
      [312, 342, [[0, 79]]],
      [312, 347, [[0, 79]]],
      [
        312,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        312,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 312, [[0, 79]]],
      [312, 313, [[0, 79]]],
      [312, 354, [[0, 79]]],
      [312, 315, [[0, 79]]],
      [
        312,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [312, 358, [[0, 79]]],
      [312, 363, [[0, 79]]],
      [312, 318, [[0, 79]]],
      [312, 372, [[0, 79]]],
      [312, 375, [[0, 79]]],
      [312, 373, [[0, 79]]],
      [312, 376, [[0, 79]]],
      [312, 378, [[0, 79]]],
      [312, 382, [[0, 79]]],
      [312, 386, [[0, 79]]],
      [312, 389, [[0, 79]]],
      [312, 391, [[0, 79]]],
      [312, 392, [[0, 79]]],
      [312, 393, [[0, 79]]],
      [312, 394, [[0, 79]]],
      [312, 395, [[0, 79]]],
      [312, 398, [[0, 79]]],
      [312, 402, [[0, 79]]],
      [312, 433, [[0, 79]]],
      [229, 312, [[0, 3]]],
      [312, 322, [[0, 79]]],
      [312, 325, [[0, 79]]],
      [312, 592, [[0, 3]]],
      [312, 735, [[0, 79]]],
      [312, 736, [[0, 79]]],
      [312, 737, [[0, 79]]],
      [312, 738, [[0, 79]]],
      [312, 739, [[0, 79]]],
      [312, 743, [[0, 79]]],
      [312, 745, [[0, 79]]],
      [312, 930, [[0, 3]]],
      [
        312,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [312, 975, [[0, 79]]],
      [
        332,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [313, 332, [[0, 79]]],
      [315, 332, [[0, 79]]],
      [318, 332, [[0, 79]]],
      [332, 333, [[0, 79]]],
      [332, 334, [[0, 79]]],
      [332, 337, [[0, 79]]],
      [332, 930, [[0, 3]]],
      [313, 342, [[0, 79]]],
      [
        313,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 313, [[0, 79]]],
      [313, 314, [[0, 79]]],
      [
        313,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [313, 389, [[0, 79]]],
      [313, 742, [[0, 79]]],
      [313, 745, [[0, 79]]],
      [308, 309, [[0, 79]]],
      [309, 343, [[0, 79]]],
      [309, 344, [[0, 79]]],
      [309, 345, [[0, 79]]],
      [309, 348, [[0, 79]]],
      [
        309,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 351, [[0, 79]]],
      [
        309,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 354, [[0, 79]]],
      [309, 316, [[0, 79]]],
      [309, 315, [[0, 79]]],
      [
        309,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 363, [[0, 79]]],
      [309, 365, [[0, 79]]],
      [309, 367, [[0, 79]]],
      [309, 318, [[0, 79]]],
      [309, 381, [[0, 79]]],
      [309, 374, [[0, 79]]],
      [309, 375, [[0, 79]]],
      [309, 377, [[0, 79]]],
      [309, 378, [[0, 79]]],
      [309, 382, [[0, 79]]],
      [309, 383, [[0, 79]]],
      [309, 389, [[0, 79]]],
      [309, 393, [[0, 79]]],
      [309, 394, [[0, 79]]],
      [309, 397, [[0, 79]]],
      [217, 309, [[0, 79]]],
      [219, 309, [[0, 79]]],
      [229, 309, [[0, 3]]],
      [309, 592, [[0, 3]]],
      [309, 735, [[0, 79]]],
      [309, 742, [[0, 79]]],
      [309, 745, [[0, 79]]],
      [309, 920, [[0, 79]]],
      [309, 924, [[0, 79]]],
      [309, 928, [[0, 79]]],
      [309, 930, [[0, 3]]],
      [
        309,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 937, [[0, 79]]],
      [309, 940, [[0, 79]]],
      [309, 942, [[0, 79]]],
      [
        309,
        943,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 951, [[0, 79]]],
      [
        309,
        963,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 975, [[0, 79]]],
      [343, 389, [[0, 79]]],
      [
        353,
        389,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 389, [[0, 79]]],
      [318, 389, [[0, 79]]],
      [389, 391, [[0, 79]]],
      [389, 966, [[0, 79]]],
      [315, 318, [[0, 79]]],
      [315, 374, [[0, 79]]],
      [315, 377, [[0, 79]]],
      [315, 745, [[0, 79]]],
      [315, 930, [[0, 3]]],
      [
        315,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        315,
        963,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        310,
        318,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        318,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [318, 742, [[0, 79]]],
      [318, 745, [[0, 79]]],
      [
        318,
        943,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        310,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        350,
        742,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        742,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [742, 745, [[0, 79]]],
      [592, 745, [[0, 3]]],
      [745, 748, [[0, 79]]],
      [355, 748, [[0, 79]]],
      [
        931,
        943,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        943,
        963,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        931,
        963,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        963,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [345, 374, [[0, 79]]],
      [374, 375, [[0, 79]]],
      [374, 377, [[0, 79]]],
      [374, 379, [[0, 79]]],
      [374, 382, [[0, 79]]],
      [352, 374, [[0, 79]]],
      [314, 374, [[0, 79]]],
      [355, 374, [[0, 79]]],
      [363, 374, [[0, 79]]],
      [318, 374, [[0, 79]]],
      [374, 391, [[0, 79]]],
      [345, 389, [[0, 79]]],
      [345, 375, [[0, 79]]],
      [369, 375, [[0, 79]]],
      [373, 375, [[0, 79]]],
      [375, 377, [[0, 79]]],
      [305, 375, [[0, 79]]],
      [315, 375, [[0, 79]]],
      [318, 375, [[0, 79]]],
      [368, 375, [[0, 79]]],
      [375, 386, [[0, 79]]],
      [375, 384, [[0, 79]]],
      [375, 393, [[0, 79]]],
      [369, 374, [[0, 79]]],
      [
        353,
        369,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 369, [[0, 79]]],
      [315, 369, [[0, 79]]],
      [318, 369, [[0, 79]]],
      [368, 369, [[0, 79]]],
      [355, 368, [[0, 79]]],
      [369, 373, [[0, 79]]],
      [370, 373, [[0, 79]]],
      [372, 373, [[0, 79]]],
      [373, 374, [[0, 79]]],
      [373, 377, [[0, 79]]],
      [321, 373, [[0, 79]]],
      [
        350,
        373,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        373,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [355, 373, [[0, 79]]],
      [
        357,
        373,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [373, 389, [[0, 79]]],
      [370, 377, [[0, 79]]],
      [370, 378, [[0, 79]]],
      [
        353,
        370,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 370, [[0, 79]]],
      [315, 370, [[0, 79]]],
      [318, 370, [[0, 79]]],
      [368, 370, [[0, 79]]],
      [345, 377, [[0, 79]]],
      [377, 378, [[0, 79]]],
      [377, 379, [[0, 79]]],
      [377, 382, [[0, 79]]],
      [
        353,
        377,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 377, [[0, 79]]],
      [355, 377, [[0, 79]]],
      [318, 377, [[0, 79]]],
      [374, 378, [[0, 79]]],
      [373, 378, [[0, 79]]],
      [305, 378, [[0, 79]]],
      [315, 378, [[0, 79]]],
      [318, 378, [[0, 79]]],
      [378, 386, [[0, 79]]],
      [378, 384, [[0, 79]]],
      [378, 389, [[0, 79]]],
      [378, 393, [[0, 79]]],
      [
        305,
        339,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        305,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [305, 386, [[0, 79]]],
      [
        339,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [313, 386, [[0, 79]]],
      [
        353,
        384,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [384, 389, [[0, 79]]],
      [
        353,
        393,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [368, 393, [[0, 79]]],
      [375, 379, [[0, 79]]],
      [378, 379, [[0, 79]]],
      [342, 379, [[0, 79]]],
      [
        346,
        379,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        350,
        379,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        379,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [312, 379, [[0, 79]]],
      [314, 379, [[0, 79]]],
      [355, 379, [[0, 79]]],
      [315, 379, [[0, 79]]],
      [
        361,
        379,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [318, 379, [[0, 79]]],
      [379, 386, [[0, 79]]],
      [379, 389, [[0, 79]]],
      [
        346,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        350,
        361,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        361,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [372, 382, [[0, 79]]],
      [375, 382, [[0, 79]]],
      [376, 382, [[0, 79]]],
      [378, 382, [[0, 79]]],
      [
        353,
        382,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [313, 382, [[0, 79]]],
      [314, 382, [[0, 79]]],
      [315, 382, [[0, 79]]],
      [363, 382, [[0, 79]]],
      [318, 382, [[0, 79]]],
      [368, 382, [[0, 79]]],
      [382, 389, [[0, 79]]],
      [309, 372, [[0, 79]]],
      [371, 376, [[0, 79]]],
      [376, 380, [[0, 79]]],
      [374, 376, [[0, 79]]],
      [225, 376, [[0, 79]]],
      [228, 376, [[0, 79]]],
      [237, 376, [[0, 79]]],
      [239, 376, [[0, 79]]],
      [
        353,
        376,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 376, [[0, 79]]],
      [
        311,
        376,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 376, [[0, 79]]],
      [315, 376, [[0, 79]]],
      [358, 376, [[0, 79]]],
      [359, 376, [[0, 79]]],
      [372, 376, [[0, 79]]],
      [376, 389, [[0, 79]]],
      [376, 391, [[0, 79]]],
      [376, 398, [[0, 79]]],
      [376, 399, [[0, 79]]],
      [376, 433, [[0, 79]]],
      [376, 940, [[0, 79]]],
      [376, 951, [[0, 79]]],
      [376, 966, [[0, 79]]],
      [371, 372, [[0, 79]]],
      [
        353,
        371,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 371, [[0, 79]]],
      [314, 371, [[0, 79]]],
      [315, 371, [[0, 79]]],
      [363, 371, [[0, 79]]],
      [371, 951, [[0, 79]]],
      [
        353,
        363,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 363, [[0, 79]]],
      [
        363,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [344, 951, [[0, 79]]],
      [391, 951, [[0, 79]]],
      [951, 967, [[0, 79]]],
      [951, 969, [[0, 79]]],
      [315, 344, [[0, 79]]],
      [344, 592, [[0, 3]]],
      [386, 391, [[0, 79]]],
      [391, 967, [[0, 79]]],
      [391, 969, [[0, 79]]],
      [967, 969, [[0, 79]]],
      [355, 380, [[0, 79]]],
      [380, 391, [[0, 79]]],
      [380, 951, [[0, 79]]],
      [223, 225, [[0, 79]]],
      [225, 228, [[0, 79]]],
      [225, 355, [[0, 79]]],
      [225, 374, [[0, 79]]],
      [223, 355, [[0, 79]]],
      [223, 391, [[0, 79]]],
      [227, 228, [[0, 79]]],
      [228, 355, [[0, 79]]],
      [
        227,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [227, 355, [[0, 79]]],
      [236, 237, [[0, 79]]],
      [237, 314, [[0, 79]]],
      [236, 314, [[0, 79]]],
      [236, 239, [[0, 79]]],
      [238, 239, [[0, 79]]],
      [239, 314, [[0, 79]]],
      [239, 391, [[0, 79]]],
      [236, 238, [[0, 79]]],
      [238, 314, [[0, 79]]],
      [
        311,
        350,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        310,
        311,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [342, 358, [[0, 79]]],
      [
        353,
        358,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 358, [[0, 79]]],
      [358, 360, [[0, 79]]],
      [358, 363, [[0, 79]]],
      [358, 374, [[0, 79]]],
      [358, 377, [[0, 79]]],
      [358, 382, [[0, 79]]],
      [358, 391, [[0, 79]]],
      [358, 394, [[0, 79]]],
      [
        360,
        361,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [342, 360, [[0, 79]]],
      [
        353,
        360,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 360, [[0, 79]]],
      [355, 360, [[0, 79]]],
      [
        357,
        360,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [360, 374, [[0, 79]]],
      [360, 377, [[0, 79]]],
      [355, 394, [[0, 79]]],
      [342, 359, [[0, 79]]],
      [
        353,
        359,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 359, [[0, 79]]],
      [359, 360, [[0, 79]]],
      [359, 363, [[0, 79]]],
      [359, 374, [[0, 79]]],
      [359, 377, [[0, 79]]],
      [359, 382, [[0, 79]]],
      [359, 394, [[0, 79]]],
      [
        353,
        398,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [391, 398, [[0, 79]]],
      [314, 399, [[0, 79]]],
      [391, 399, [[0, 79]]],
      [399, 951, [[0, 79]]],
      [400, 433, [[0, 79]]],
      [402, 433, [[0, 79]]],
      [403, 433, [[0, 79]]],
      [405, 433, [[0, 79]]],
      [404, 433, [[0, 79]]],
      [406, 433, [[0, 79]]],
      [407, 433, [[0, 79]]],
      [409, 433, [[0, 79]]],
      [408, 433, [[0, 79]]],
      [410, 433, [[0, 79]]],
      [411, 433, [[0, 79]]],
      [412, 433, [[0, 79]]],
      [413, 433, [[0, 79]]],
      [414, 433, [[0, 79]]],
      [415, 433, [[0, 79]]],
      [416, 433, [[0, 79]]],
      [417, 433, [[0, 79]]],
      [418, 433, [[0, 79]]],
      [419, 433, [[0, 79]]],
      [421, 433, [[0, 79]]],
      [422, 433, [[0, 79]]],
      [423, 433, [[0, 79]]],
      [424, 433, [[0, 79]]],
      [425, 433, [[0, 79]]],
      [426, 433, [[0, 79]]],
      [427, 433, [[0, 79]]],
      [429, 433, [[0, 79]]],
      [428, 433, [[0, 79]]],
      [430, 433, [[0, 79]]],
      [431, 433, [[0, 79]]],
      [391, 433, [[0, 79]]],
      [398, 433, [[0, 79]]],
      [400, 402, [[0, 79]]],
      [314, 400, [[0, 79]]],
      [391, 400, [[0, 79]]],
      [342, 402, [[0, 79]]],
      [
        350,
        402,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        402,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [356, 402, [[0, 79]]],
      [386, 402, [[0, 79]]],
      [391, 402, [[0, 79]]],
      [399, 402, [[0, 79]]],
      [402, 951, [[0, 79]]],
      [402, 969, [[0, 79]]],
      [402, 403, [[0, 79]]],
      [391, 403, [[0, 79]]],
      [391, 405, [[0, 79]]],
      [402, 405, [[0, 79]]],
      [391, 404, [[0, 79]]],
      [402, 404, [[0, 79]]],
      [402, 406, [[0, 79]]],
      [314, 406, [[0, 79]]],
      [391, 406, [[0, 79]]],
      [391, 407, [[0, 79]]],
      [407, 432, [[0, 79]]],
      [391, 432, [[0, 79]]],
      [402, 432, [[0, 79]]],
      [391, 409, [[0, 79]]],
      [402, 409, [[0, 79]]],
      [391, 408, [[0, 79]]],
      [402, 408, [[0, 79]]],
      [401, 410, [[0, 79]]],
      [402, 410, [[0, 79]]],
      [
        353,
        410,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 410, [[0, 79]]],
      [355, 410, [[0, 79]]],
      [391, 410, [[0, 79]]],
      [394, 410, [[0, 79]]],
      [399, 410, [[0, 79]]],
      [401, 402, [[0, 79]]],
      [391, 401, [[0, 79]]],
      [391, 411, [[0, 79]]],
      [411, 432, [[0, 79]]],
      [391, 412, [[0, 79]]],
      [402, 412, [[0, 79]]],
      [391, 413, [[0, 79]]],
      [413, 432, [[0, 79]]],
      [391, 414, [[0, 79]]],
      [414, 432, [[0, 79]]],
      [402, 415, [[0, 79]]],
      [391, 415, [[0, 79]]],
      [399, 415, [[0, 79]]],
      [391, 416, [[0, 79]]],
      [416, 432, [[0, 79]]],
      [391, 417, [[0, 79]]],
      [402, 417, [[0, 79]]],
      [402, 418, [[0, 79]]],
      [391, 418, [[0, 79]]],
      [399, 418, [[0, 79]]],
      [402, 419, [[0, 79]]],
      [314, 419, [[0, 79]]],
      [391, 419, [[0, 79]]],
      [391, 421, [[0, 79]]],
      [421, 432, [[0, 79]]],
      [391, 422, [[0, 79]]],
      [422, 432, [[0, 79]]],
      [401, 423, [[0, 79]]],
      [402, 423, [[0, 79]]],
      [391, 423, [[0, 79]]],
      [399, 423, [[0, 79]]],
      [391, 424, [[0, 79]]],
      [402, 424, [[0, 79]]],
      [391, 425, [[0, 79]]],
      [402, 425, [[0, 79]]],
      [391, 426, [[0, 79]]],
      [426, 432, [[0, 79]]],
      [402, 427, [[0, 79]]],
      [391, 427, [[0, 79]]],
      [399, 427, [[0, 79]]],
      [391, 429, [[0, 79]]],
      [402, 429, [[0, 79]]],
      [402, 428, [[0, 79]]],
      [314, 428, [[0, 79]]],
      [391, 428, [[0, 79]]],
      [391, 430, [[0, 79]]],
      [402, 430, [[0, 79]]],
      [391, 431, [[0, 79]]],
      [402, 431, [[0, 79]]],
      [221, 940, [[0, 79]]],
      [223, 940, [[0, 79]]],
      [237, 940, [[0, 79]]],
      [355, 940, [[0, 79]]],
      [368, 940, [[0, 79]]],
      [221, 237, [[0, 79]]],
      [
        353,
        966,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [348, 352, [[0, 79]]],
      [314, 352, [[0, 79]]],
      [352, 355, [[0, 79]]],
      [352, 391, [[0, 79]]],
      [
        348,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 348, [[0, 79]]],
      [315, 348, [[0, 79]]],
      [348, 372, [[0, 79]]],
      [348, 389, [[0, 79]]],
      [592, 930, [[0, 3]]],
      [348, 351, [[0, 79]]],
      [351, 372, [[0, 79]]],
      [351, 374, [[0, 79]]],
      [351, 376, [[0, 79]]],
      [351, 377, [[0, 79]]],
      [351, 391, [[0, 79]]],
      [315, 354, [[0, 79]]],
      [354, 389, [[0, 79]]],
      [354, 588, [[0, 3]]],
      [
        354,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 316, [[0, 79]]],
      [
        353,
        365,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [365, 398, [[0, 79]]],
      [365, 399, [[0, 79]]],
      [365, 402, [[0, 79]]],
      [365, 391, [[0, 79]]],
      [365, 433, [[0, 79]]],
      [365, 951, [[0, 79]]],
      [315, 367, [[0, 79]]],
      [367, 389, [[0, 79]]],
      [
        367,
        931,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [345, 381, [[0, 79]]],
      [354, 381, [[0, 79]]],
      [381, 389, [[0, 79]]],
      [381, 966, [[0, 79]]],
      [
        353,
        383,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 383, [[0, 79]]],
      [355, 383, [[0, 79]]],
      [383, 389, [[0, 79]]],
      [396, 397, [[0, 79]]],
      [397, 542, [[0, 79]]],
      [397, 588, [[0, 3]]],
      [391, 396, [[0, 79]]],
      [355, 542, [[0, 79]]],
      [217, 218, [[0, 79]]],
      [217, 314, [[0, 79]]],
      [217, 365, [[0, 79]]],
      [217, 372, [[0, 79]]],
      [217, 391, [[0, 79]]],
      [217, 398, [[0, 79]]],
      [217, 399, [[0, 79]]],
      [217, 592, [[0, 3]]],
      [217, 940, [[0, 79]]],
      [217, 951, [[0, 79]]],
      [
        218,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [218, 309, [[0, 79]]],
      [218, 742, [[0, 79]]],
      [218, 937, [[0, 79]]],
      [218, 966, [[0, 79]]],
      [937, 966, [[0, 79]]],
      [
        219,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [219, 355, [[0, 79]]],
      [219, 391, [[0, 79]]],
      [219, 951, [[0, 79]]],
      [229, 930, [[0, 3]]],
      [355, 735, [[0, 79]]],
      [735, 745, [[0, 79]]],
      [920, 940, [[0, 79]]],
      [920, 951, [[0, 79]]],
      [314, 920, [[0, 79]]],
      [345, 924, [[0, 79]]],
      [924, 942, [[0, 79]]],
      [928, 942, [[0, 79]]],
      [975, 994, [[0, 79]]],
      [223, 975, [[0, 79]]],
      [355, 975, [[0, 79]]],
      [966, 975, [[0, 79]]],
      [355, 994, [[0, 79]]],
      [
        333,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 333, [[0, 79]]],
      [318, 333, [[0, 79]]],
      [333, 745, [[0, 79]]],
      [309, 334, [[0, 79]]],
      [315, 334, [[0, 79]]],
      [334, 398, [[0, 79]]],
      [334, 335, [[0, 79]]],
      [334, 336, [[0, 79]]],
      [334, 930, [[0, 3]]],
      [
        335,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        310,
        335,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 335, [[0, 79]]],
      [
        335,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [335, 398, [[0, 79]]],
      [
        336,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 336, [[0, 79]]],
      [336, 355, [[0, 79]]],
      [315, 336, [[0, 79]]],
      [336, 363, [[0, 79]]],
      [336, 738, [[0, 79]]],
      [
        353,
        738,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 738, [[0, 79]]],
      [355, 738, [[0, 79]]],
      [364, 738, [[0, 79]]],
      [735, 738, [[0, 79]]],
      [738, 745, [[0, 79]]],
      [
        353,
        364,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [315, 364, [[0, 79]]],
      [363, 364, [[0, 79]]],
      [364, 389, [[0, 79]]],
      [
        337,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 337, [[0, 79]]],
      [315, 337, [[0, 79]]],
      [318, 337, [[0, 79]]],
      [337, 386, [[0, 79]]],
      [337, 930, [[0, 3]]],
      [
        340,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 340, [[0, 79]]],
      [313, 340, [[0, 79]]],
      [314, 340, [[0, 79]]],
      [315, 340, [[0, 79]]],
      [
        340,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [318, 340, [[0, 79]]],
      [340, 375, [[0, 79]]],
      [340, 378, [[0, 79]]],
      [340, 386, [[0, 79]]],
      [333, 340, [[0, 79]]],
      [334, 340, [[0, 79]]],
      [
        326,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 326, [[0, 79]]],
      [326, 737, [[0, 79]]],
      [
        353,
        737,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 737, [[0, 79]]],
      [355, 737, [[0, 79]]],
      [375, 737, [[0, 79]]],
      [373, 737, [[0, 79]]],
      [378, 737, [[0, 79]]],
      [
        347,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [309, 347, [[0, 79]]],
      [
        311,
        347,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [313, 347, [[0, 79]]],
      [314, 347, [[0, 79]]],
      [347, 372, [[0, 79]]],
      [347, 376, [[0, 79]]],
      [347, 386, [[0, 79]]],
      [
        353,
        392,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 392, [[0, 79]]],
      [
        353,
        395,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [355, 395, [[0, 79]]],
      [
        353,
        736,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [355, 736, [[0, 79]]],
      [315, 736, [[0, 79]]],
      [318, 736, [[0, 79]]],
      [736, 745, [[0, 79]]],
      [308, 739, [[0, 79]]],
      [355, 743, [[0, 79]]],
      [743, 745, [[0, 79]]],
      [
        307,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [307, 355, [[0, 79]]],
      [
        307,
        357,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [
        353,
        362,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [358, 362, [[0, 79]]],
      [359, 362, [[0, 79]]],
      [362, 398, [[0, 79]]],
      [
        310,
        366,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [323, 324, [[0, 79]]],
      [229, 324, [[0, 3]]],
      [
        324,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 324, [[0, 79]]],
      [315, 324, [[0, 79]]],
      [318, 324, [[0, 79]]],
      [324, 374, [[0, 79]]],
      [324, 384, [[0, 79]]],
      [324, 389, [[0, 79]]],
      [325, 327, [[0, 79]]],
      [229, 327, [[0, 3]]],
      [
        327,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 327, [[0, 79]]],
      [315, 327, [[0, 79]]],
      [318, 327, [[0, 79]]],
      [327, 374, [[0, 79]]],
      [327, 375, [[0, 79]]],
      [327, 384, [[0, 79]]],
      [327, 930, [[0, 3]]],
      [325, 328, [[0, 79]]],
      [
        328,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 328, [[0, 79]]],
      [315, 328, [[0, 79]]],
      [318, 328, [[0, 79]]],
      [328, 377, [[0, 79]]],
      [328, 384, [[0, 79]]],
      [325, 329, [[0, 79]]],
      [229, 329, [[0, 3]]],
      [329, 349, [[0, 79]]],
      [
        329,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 329, [[0, 79]]],
      [315, 329, [[0, 79]]],
      [318, 329, [[0, 79]]],
      [329, 377, [[0, 79]]],
      [329, 378, [[0, 79]]],
      [329, 384, [[0, 79]]],
      [329, 389, [[0, 79]]],
      [329, 930, [[0, 3]]],
      [328, 330, [[0, 79]]],
      [330, 331, [[0, 79]]],
      [229, 330, [[0, 3]]],
      [314, 330, [[0, 79]]],
      [330, 355, [[0, 79]]],
      [318, 330, [[0, 79]]],
      [330, 930, [[0, 3]]],
      [325, 331, [[0, 79]]],
      [331, 349, [[0, 79]]],
      [
        331,
        353,
        [
          [0, 42],
          [78, 79]
        ]
      ],
      [314, 331, [[0, 79]]],
      [318, 331, [[0, 79]]],
      [331, 374, [[0, 79]]],
      [331, 384, [[0, 79]]],
      [331, 389, [[0, 79]]],
      [553, 585, [[0, 79]]],
      [553, 644, [[0, 3]]],
      [585, 864, [[0, 79]]],
      [309, 644, [[0, 3]]],
      [389, 644, [[0, 3]]],
      [391, 644, [[0, 3]]],
      [644, 966, [[0, 3]]],
      [
        864,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [865, 870, [[0, 3]]],
      [
        865,
        881,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        882,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        883,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        891,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        894,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        897,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        126,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        137,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        198,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [222, 865, [[0, 3]]],
      [225, 865, [[0, 3]]],
      [232, 865, [[0, 3]]],
      [
        269,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [344, 865, [[0, 3]]],
      [353, 865, [[0, 3]]],
      [355, 865, [[0, 3]]],
      [357, 865, [[0, 3]]],
      [391, 865, [[0, 3]]],
      [
        465,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        498,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        501,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        526,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        530,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        532,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [533, 865, [[0, 3]]],
      [
        538,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        540,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [541, 865, [[0, 3]]],
      [542, 865, [[0, 3]]],
      [
        543,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        544,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        546,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        553,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        577,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [588, 865, [[0, 3]]],
      [
        589,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [591, 865, [[0, 3]]],
      [592, 865, [[0, 3]]],
      [594, 865, [[0, 3]]],
      [
        599,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [600, 865, [[0, 12]]],
      [602, 865, [[0, 3]]],
      [
        604,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        606,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        607,
        865,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        613,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [643, 865, [[0, 3]]],
      [644, 865, [[0, 3]]],
      [
        721,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [729, 865, [[0, 3]]],
      [
        731,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        741,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [788, 865, [[0, 3]]],
      [
        865,
        868,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        865,
        879,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        901,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        903,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        905,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        911,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        914,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        922,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        865,
        925,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        926,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        927,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        929,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        939,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        945,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        946,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        950,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [865, 951, [[0, 3]]],
      [
        865,
        958,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        961,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        865,
        973,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        865,
        974,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [865, 975, [[0, 3]]],
      [
        865,
        978,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [865, 979, [[0, 3]]],
      [865, 980, [[0, 3]]],
      [865, 996, [[0, 3]]],
      [644, 870, [[0, 3]]],
      [
        864,
        881,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [873, 881, [[0, 3]]],
      [344, 881, [[0, 3]]],
      [355, 881, [[0, 3]]],
      [391, 881, [[0, 3]]],
      [644, 873, [[0, 3]]],
      [873, 964, [[0, 3]]],
      [644, 964, [[0, 3]]],
      [882, 895, [[0, 3]]],
      [222, 882, [[0, 3]]],
      [225, 882, [[0, 3]]],
      [355, 882, [[0, 3]]],
      [391, 882, [[0, 3]]],
      [
        577,
        882,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [355, 895, [[0, 3]]],
      [391, 895, [[0, 3]]],
      [399, 895, [[0, 3]]],
      [895, 967, [[0, 3]]],
      [222, 228, [[0, 3]]],
      [222, 353, [[0, 3]]],
      [222, 355, [[0, 3]]],
      [222, 391, [[0, 3]]],
      [222, 951, [[0, 3]]],
      [577, 588, [[0, 3]]],
      [577, 594, [[0, 3]]],
      [
        577,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        577,
        968,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [
        938,
        968,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        965,
        968,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [222, 938, [[0, 3]]],
      [225, 938, [[0, 3]]],
      [232, 938, [[0, 3]]],
      [355, 938, [[0, 3]]],
      [
        577,
        938,
        [
          [0, 68],
          [71, 74],
          [77, 79]
        ]
      ],
      [863, 938, [[0, 3]]],
      [
        909,
        938,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        938,
        946,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        938,
        993,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [232, 967, [[0, 3]]],
      [861, 863, [[0, 3]]],
      [592, 861, [[0, 3]]],
      [355, 946, [[0, 3]]],
      [
        577,
        946,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [604, 946, [[0, 79]]],
      [
        612,
        946,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [613, 946, [[0, 79]]],
      [644, 946, [[0, 3]]],
      [730, 946, [[0, 79]]],
      [
        864,
        946,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        901,
        946,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [925, 946, [[0, 79]]],
      [
        946,
        948,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [187, 604, [[0, 79]]],
      [355, 604, [[0, 3]]],
      [532, 604, [[0, 79]]],
      [540, 604, [[0, 79]]],
      [
        544,
        604,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        577,
        604,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [588, 604, [[0, 3]]],
      [592, 604, [[0, 3]]],
      [
        604,
        606,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [604, 608, [[0, 3]]],
      [604, 609, [[0, 3]]],
      [604, 613, [[0, 79]]],
      [
        604,
        615,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [604, 644, [[0, 3]]],
      [604, 751, [[0, 79]]],
      [604, 870, [[0, 3]]],
      [
        604,
        901,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [604, 915, [[0, 79]]],
      [
        604,
        922,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [604, 925, [[0, 79]]],
      [604, 939, [[0, 79]]],
      [604, 945, [[0, 79]]],
      [604, 958, [[0, 79]]],
      [187, 613, [[0, 79]]],
      [
        612,
        613,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [355, 613, [[0, 3]]],
      [608, 613, [[0, 3]]],
      [
        613,
        615,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [613, 644, [[0, 3]]],
      [613, 751, [[0, 79]]],
      [
        613,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 870, [[0, 3]]],
      [613, 926, [[0, 79]]],
      [
        613,
        992,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 994, [[0, 3]]],
      [533, 612, [[0, 3]]],
      [541, 612, [[0, 3]]],
      [
        577,
        612,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [592, 612, [[0, 3]]],
      [
        612,
        615,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [612, 644, [[0, 3]]],
      [
        612,
        868,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        612,
        901,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        612,
        948,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        612,
        960,
        [
          [0, 12],
          [73, 76]
        ]
      ],
      [223, 533, [[0, 3]]],
      [223, 541, [[0, 3]]],
      [592, 615, [[0, 3]]],
      [
        615,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        864,
        868,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [355, 868, [[0, 3]]],
      [
        553,
        868,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 868, [[0, 79]]],
      [644, 868, [[0, 3]]],
      [
        769,
        868,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [868, 926, [[0, 79]]],
      [868, 939, [[0, 79]]],
      [868, 945, [[0, 79]]],
      [868, 978, [[0, 79]]],
      [
        768,
        769,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [314, 768, [[0, 3]]],
      [
        613,
        768,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [753, 768, [[0, 3]]],
      [
        754,
        768,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [756, 768, [[0, 3]]],
      [
        768,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [314, 753, [[0, 3]]],
      [753, 755, [[0, 3]]],
      [753, 758, [[0, 3]]],
      [234, 755, [[0, 3]]],
      [314, 755, [[0, 3]]],
      [234, 355, [[0, 3]]],
      [234, 951, [[0, 3]]],
      [234, 967, [[0, 3]]],
      [314, 758, [[0, 3]]],
      [758, 994, [[0, 3]]],
      [314, 754, [[0, 3]]],
      [754, 755, [[0, 3]]],
      [754, 758, [[0, 3]]],
      [
        754,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        754,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [314, 756, [[0, 3]]],
      [753, 756, [[0, 3]]],
      [355, 939, [[0, 3]]],
      [
        553,
        939,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 939, [[0, 79]]],
      [
        864,
        939,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        894,
        939,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        939,
        970,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [939, 975, [[0, 3]]],
      [939, 978, [[0, 79]]],
      [
        939,
        984,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        864,
        894,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        883,
        894,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [894, 990, [[0, 3]]],
      [
        864,
        883,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        883,
        889,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [883, 892, [[0, 79]]],
      [
        883,
        893,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [
        200,
        883,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        553,
        883,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        554,
        883,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        574,
        883,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        577,
        883,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [588, 883, [[0, 3]]],
      [
        883,
        905,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        883,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        883,
        939,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        883,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        889,
        892,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [
        577,
        892,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        865,
        892,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        187,
        200,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [200, 588, [[0, 3]]],
      [200, 594, [[0, 3]]],
      [200, 598, [[0, 3]]],
      [
        200,
        599,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [594, 598, [[0, 3]]],
      [594, 599, [[0, 3]]],
      [
        599,
        613,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        599,
        633,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        599,
        938,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [599, 975, [[0, 3]]],
      [
        633,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [554, 555, [[0, 79]]],
      [553, 554, [[0, 79]]],
      [554, 644, [[0, 3]]],
      [553, 555, [[0, 79]]],
      [
        567,
        574,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        574,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        33,
        567,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        567,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        564,
        567,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        570,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        571,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        572,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [567, 593, [[0, 3]]],
      [
        567,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        567,
        993,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        33,
        949,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        864,
        949,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        120,
        121,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        123,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        124,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        501,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        507,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [121, 508, [[0, 3]]],
      [121, 557, [[0, 3]]],
      [
        121,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        121,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        120,
        507,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [120, 508, [[0, 3]]],
      [
        120,
        646,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        123,
        507,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        193,
        507,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [497, 507, [[0, 79]]],
      [
        507,
        510,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [507, 588, [[0, 3]]],
      [507, 594, [[0, 3]]],
      [
        507,
        653,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [507, 665, [[0, 79]]],
      [507, 666, [[0, 79]]],
      [
        507,
        707,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        507,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        507,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        507,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        507,
        726,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        507,
        901,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        507,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        118,
        123,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        120,
        123,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        123,
        193,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        123,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        118,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        109,
        497,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        497,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        493,
        497,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [495, 497, [[0, 79]]],
      [497, 588, [[0, 3]]],
      [497, 594, [[0, 3]]],
      [
        497,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        109,
        110,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        109,
        960,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        110,
        960,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        493,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        493,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [493, 508, [[0, 3]]],
      [493, 515, [[0, 3]]],
      [
        493,
        516,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [493, 517, [[0, 3]]],
      [493, 588, [[0, 3]]],
      [493, 594, [[0, 3]]],
      [
        493,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [493, 597, [[0, 3]]],
      [
        493,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        493,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        119,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        121,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        114,
        127,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [114, 588, [[0, 3]]],
      [114, 594, [[0, 3]]],
      [
        114,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        604,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        613,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        901,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        119,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        127,
        900,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [214, 900, [[0, 3]]],
      [
        487,
        900,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        900,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [900, 994, [[0, 3]]],
      [
        595,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        595,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        24,
        901,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [25, 901, [[0, 79]]],
      [26, 901, [[0, 79]]],
      [
        27,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        45,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        28,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        29,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        121,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [490, 901, [[0, 3]]],
      [
        509,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        524,
        901,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        556,
        901,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [557, 901, [[0, 3]]],
      [588, 901, [[0, 3]]],
      [592, 901, [[0, 3]]],
      [594, 901, [[0, 3]]],
      [
        620,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        646,
        901,
        [
          [0, 69],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        672,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        673,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        674,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        675,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        677,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        678,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        679,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        680,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        681,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        682,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        683,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        684,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        669,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        698,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        701,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        721,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        864,
        901,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        24,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        25,
        574,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        25,
        577,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [26, 30, [[0, 3]]],
      [26, 519, [[0, 79]]],
      [
        26,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [26, 588, [[0, 3]]],
      [
        26,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        26,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        26,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        26,
        947,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [26, 971, [[0, 3]]],
      [30, 588, [[0, 3]]],
      [
        519,
        520,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [519, 521, [[0, 79]]],
      [
        519,
        522,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        519,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        519,
        525,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        520,
        523,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        520,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        523,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [524, 533, [[0, 3]]],
      [524, 541, [[0, 3]]],
      [
        524,
        553,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [524, 960, [[0, 12]]],
      [
        521,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [521, 529, [[0, 3]]],
      [
        521,
        536,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [529, 533, [[0, 3]]],
      [
        536,
        539,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [536, 541, [[0, 3]]],
      [539, 541, [[0, 3]]],
      [222, 539, [[0, 3]]],
      [223, 539, [[0, 3]]],
      [225, 539, [[0, 3]]],
      [226, 539, [[0, 3]]],
      [230, 539, [[0, 3]]],
      [309, 539, [[0, 3]]],
      [314, 539, [[0, 3]]],
      [391, 539, [[0, 3]]],
      [539, 605, [[0, 3]]],
      [539, 644, [[0, 3]]],
      [
        539,
        918,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [539, 975, [[0, 3]]],
      [
        539,
        978,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [222, 226, [[0, 3]]],
      [225, 226, [[0, 3]]],
      [226, 353, [[0, 3]]],
      [226, 355, [[0, 3]]],
      [226, 391, [[0, 3]]],
      [226, 975, [[0, 3]]],
      [230, 391, [[0, 3]]],
      [605, 644, [[0, 3]]],
      [
        916,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        918,
        935,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [918, 941, [[0, 79]]],
      [
        193,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [449, 918, [[0, 79]]],
      [
        457,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        466,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        555,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        864,
        918,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        916,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        585,
        916,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        864,
        916,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        935,
        938,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        941,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        554,
        941,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        555,
        941,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        577,
        941,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        864,
        941,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        865,
        941,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [903, 941, [[0, 79]]],
      [904, 941, [[0, 79]]],
      [926, 941, [[0, 79]]],
      [939, 941, [[0, 79]]],
      [
        941,
        944,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        941,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        261,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        116,
        903,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [341, 903, [[0, 3]]],
      [
        577,
        903,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [591, 903, [[0, 3]]],
      [592, 903, [[0, 3]]],
      [
        864,
        903,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        903,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        903,
        927,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [903, 933, [[0, 79]]],
      [903, 950, [[0, 79]]],
      [
        903,
        953,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        903,
        960,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        240,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        245,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        246,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        247,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        248,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        249,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        250,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        251,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        252,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        253,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        254,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        255,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        256,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        257,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        258,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        259,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        260,
        261,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        262,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        284,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        286,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        287,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        288,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        289,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        290,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        291,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        292,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        294,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        295,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        296,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        298,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        300,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        301,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        302,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        261,
        303,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        116,
        240,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        193,
        240,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        240,
        549,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [240, 557, [[0, 3]]],
      [240, 588, [[0, 3]]],
      [240, 592, [[0, 3]]],
      [240, 594, [[0, 3]]],
      [
        240,
        613,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        721,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        730,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        760,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [240, 975, [[0, 3]]],
      [
        240,
        998,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        1004,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        1007,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        1008,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        240,
        1011,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [547, 549, [[0, 3]]],
      [549, 550, [[0, 3]]],
      [549, 551, [[0, 3]]],
      [
        549,
        552,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        549,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [549, 588, [[0, 3]]],
      [549, 594, [[0, 3]]],
      [
        549,
        957,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [547, 550, [[0, 3]]],
      [550, 594, [[0, 3]]],
      [550, 551, [[0, 3]]],
      [550, 552, [[0, 3]]],
      [
        187,
        552,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        552,
        915,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        5,
        915,
        [
          [0, 24],
          [78, 79]
        ]
      ],
      [187, 915, [[0, 79]]],
      [228, 915, [[0, 3]]],
      [355, 915, [[0, 3]]],
      [376, 915, [[0, 3]]],
      [391, 915, [[0, 3]]],
      [
        577,
        915,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        612,
        915,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [613, 915, [[0, 79]]],
      [730, 915, [[0, 79]]],
      [
        865,
        915,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [868, 915, [[0, 79]]],
      [
        915,
        957,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [915, 978, [[0, 79]]],
      [
        5,
        207,
        [
          [0, 24],
          [78, 79]
        ]
      ],
      [
        5,
        865,
        [
          [0, 24],
          [78, 79]
        ]
      ],
      [
        5,
        901,
        [
          [0, 24],
          [78, 79]
        ]
      ],
      [
        23,
        207,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [207, 588, [[0, 3]]],
      [207, 594, [[0, 3]]],
      [
        207,
        901,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        207,
        912,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        17,
        23,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [18, 23, [[0, 3]]],
      [
        23,
        201,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [23, 214, [[0, 3]]],
      [
        23,
        534,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        23,
        535,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [23, 588, [[0, 3]]],
      [23, 592, [[0, 3]]],
      [23, 605, [[0, 3]]],
      [
        23,
        630,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        23,
        631,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        23,
        632,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        23,
        633,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [23, 636, [[0, 3]]],
      [23, 637, [[0, 3]]],
      [
        23,
        639,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [23, 640, [[0, 3]]],
      [
        23,
        641,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        17,
        201,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        201,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [201, 588, [[0, 3]]],
      [201, 593, [[0, 3]]],
      [
        201,
        947,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [588, 593, [[0, 3]]],
      [593, 594, [[0, 3]]],
      [
        864,
        947,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [18, 19, [[0, 3]]],
      [18, 636, [[0, 3]]],
      [19, 22, [[0, 3]]],
      [19, 636, [[0, 3]]],
      [21, 22, [[0, 3]]],
      [22, 636, [[0, 3]]],
      [20, 21, [[0, 3]]],
      [21, 636, [[0, 3]]],
      [21, 638, [[0, 3]]],
      [20, 638, [[0, 3]]],
      [605, 638, [[0, 3]]],
      [636, 638, [[0, 3]]],
      [
        534,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [535, 592, [[0, 3]]],
      [535, 923, [[0, 3]]],
      [
        535,
        957,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [592, 923, [[0, 3]]],
      [182, 957, [[0, 0]]],
      [183, 957, [[0, 0]]],
      [184, 957, [[0, 0]]],
      [185, 957, [[0, 0]]],
      [
        193,
        957,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        450,
        957,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        577,
        957,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [610, 957, [[0, 0]]],
      [611, 957, [[0, 0]]],
      [
        921,
        957,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [933, 957, [[0, 0]]],
      [
        957,
        961,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [87, 182, [[0, 0]]],
      [182, 577, [[0, 0]]],
      [182, 952, [[0, 0]]],
      [182, 961, [[0, 0]]],
      [54, 87, [[0, 0]]],
      [85, 87, [[0, 0]]],
      [86, 87, [[0, 0]]],
      [87, 104, [[0, 0]]],
      [87, 94, [[0, 0]]],
      [87, 449, [[0, 0]]],
      [87, 454, [[0, 0]]],
      [87, 455, [[0, 0]]],
      [87, 458, [[0, 0]]],
      [87, 462, [[0, 0]]],
      [87, 464, [[0, 0]]],
      [87, 469, [[0, 0]]],
      [87, 477, [[0, 0]]],
      [87, 642, [[0, 0]]],
      [87, 918, [[0, 0]]],
      [87, 988, [[0, 0]]],
      [
        54,
        56,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        54,
        196,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [54, 314, [[0, 3]]],
      [
        54,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        56,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        196,
        278,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        196,
        268,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        196,
        269,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [196, 314, [[0, 3]]],
      [
        196,
        468,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        196,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [196, 906, [[0, 79]]],
      [265, 278, [[0, 3]]],
      [
        266,
        278,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        268,
        278,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        270,
        278,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        272,
        278,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        274,
        278,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        275,
        278,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [265, 282, [[0, 3]]],
      [282, 979, [[0, 3]]],
      [353, 979, [[0, 3]]],
      [
        266,
        269,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        269,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [265, 268, [[0, 3]]],
      [
        266,
        268,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [268, 282, [[0, 3]]],
      [
        268,
        270,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        268,
        272,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        268,
        275,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        268,
        277,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        270,
        271,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        270,
        272,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        270,
        273,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        270,
        276,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        271,
        272,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        272,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        272,
        273,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        273,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        272,
        276,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        272,
        275,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        273,
        275,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [277, 282, [[0, 3]]],
      [
        274,
        277,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [277, 979, [[0, 3]]],
      [
        269,
        274,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        468,
        469,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        193,
        468,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        466,
        468,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        468,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        468,
        918,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        464,
        469,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        193,
        469,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        469,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [464, 644, [[0, 3]]],
      [
        464,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        193,
        466,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        466,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        466,
        935,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [195, 906, [[0, 79]]],
      [
        268,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [355, 906, [[0, 3]]],
      [
        195,
        278,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        268,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        269,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [195, 314, [[0, 3]]],
      [195, 355, [[0, 3]]],
      [
        195,
        468,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        195,
        730,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        195,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [135, 730, [[0, 79]]],
      [187, 730, [[0, 79]]],
      [224, 730, [[0, 79]]],
      [353, 730, [[0, 3]]],
      [355, 730, [[0, 3]]],
      [730, 737, [[0, 3]]],
      [730, 743, [[0, 3]]],
      [730, 978, [[0, 79]]],
      [730, 985, [[0, 3]]],
      [135, 353, [[0, 3]]],
      [135, 355, [[0, 3]]],
      [135, 1011, [[0, 79]]],
      [588, 1011, [[0, 3]]],
      [594, 1011, [[0, 3]]],
      [
        612,
        1011,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [613, 1011, [[0, 79]]],
      [
        864,
        1011,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [161, 224, [[0, 3]]],
      [223, 224, [[0, 3]]],
      [224, 355, [[0, 3]]],
      [224, 368, [[0, 3]]],
      [224, 376, [[0, 3]]],
      [224, 382, [[0, 3]]],
      [224, 391, [[0, 3]]],
      [224, 905, [[0, 79]]],
      [224, 940, [[0, 3]]],
      [224, 945, [[0, 79]]],
      [224, 951, [[0, 3]]],
      [161, 355, [[0, 3]]],
      [903, 905, [[0, 79]]],
      [134, 905, [[0, 79]]],
      [135, 905, [[0, 79]]],
      [152, 905, [[0, 79]]],
      [
        157,
        905,
        [
          [0, 36],
          [78, 79]
        ]
      ],
      [163, 905, [[0, 79]]],
      [164, 905, [[0, 79]]],
      [168, 905, [[0, 79]]],
      [233, 905, [[0, 79]]],
      [355, 905, [[0, 3]]],
      [389, 905, [[0, 3]]],
      [391, 905, [[0, 3]]],
      [433, 905, [[0, 3]]],
      [
        577,
        905,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 905, [[0, 79]]],
      [730, 905, [[0, 79]]],
      [
        857,
        905,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        901,
        905,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [905, 910, [[0, 3]]],
      [905, 926, [[0, 79]]],
      [
        905,
        938,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [905, 939, [[0, 79]]],
      [905, 940, [[0, 3]]],
      [905, 946, [[0, 79]]],
      [905, 950, [[0, 79]]],
      [905, 954, [[0, 79]]],
      [
        905,
        956,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [905, 978, [[0, 79]]],
      [
        905,
        1017,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [134, 355, [[0, 3]]],
      [134, 730, [[0, 79]]],
      [134, 975, [[0, 3]]],
      [134, 978, [[0, 79]]],
      [355, 978, [[0, 3]]],
      [389, 978, [[0, 3]]],
      [391, 978, [[0, 3]]],
      [
        553,
        978,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [784, 978, [[0, 79]]],
      [861, 978, [[0, 3]]],
      [730, 784, [[0, 79]]],
      [743, 784, [[0, 3]]],
      [134, 152, [[0, 79]]],
      [152, 355, [[0, 3]]],
      [152, 613, [[0, 79]]],
      [152, 730, [[0, 79]]],
      [152, 939, [[0, 79]]],
      [152, 946, [[0, 79]]],
      [
        63,
        157,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        59,
        157,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [157, 314, [[0, 3]]],
      [
        63,
        159,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [153, 159, [[0, 3]]],
      [159, 355, [[0, 3]]],
      [
        159,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        159,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [159, 932, [[0, 3]]],
      [
        159,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [159, 994, [[0, 3]]],
      [153, 234, [[0, 3]]],
      [153, 355, [[0, 3]]],
      [355, 932, [[0, 3]]],
      [
        59,
        60,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        59,
        61,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        59,
        62,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [59, 156, [[0, 3]]],
      [
        59,
        158,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        59,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [59, 355, [[0, 3]]],
      [59, 932, [[0, 3]]],
      [
        60,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        154,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        160,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        154,
        155,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        155,
        894,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        58,
        61,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        61,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        58,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        62,
        160,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [156, 932, [[0, 3]]],
      [153, 158, [[0, 3]]],
      [158, 234, [[0, 3]]],
      [158, 355, [[0, 3]]],
      [
        158,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        158,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [158, 932, [[0, 3]]],
      [
        158,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        158,
        976,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        970,
        976,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        970,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [163, 355, [[0, 3]]],
      [163, 740, [[0, 79]]],
      [
        163,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        163,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        577,
        740,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [730, 740, [[0, 79]]],
      [355, 871, [[0, 3]]],
      [365, 871, [[0, 3]]],
      [391, 871, [[0, 3]]],
      [419, 871, [[0, 3]]],
      [
        871,
        922,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        136,
        922,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        136,
        137,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [136, 355, [[0, 3]]],
      [
        136,
        577,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        136,
        730,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [137, 355, [[0, 3]]],
      [
        137,
        730,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [161, 164, [[0, 3]]],
      [164, 355, [[0, 3]]],
      [164, 839, [[0, 79]]],
      [355, 839, [[0, 3]]],
      [391, 839, [[0, 3]]],
      [402, 839, [[0, 3]]],
      [
        577,
        839,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [730, 839, [[0, 79]]],
      [
        839,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        839,
        890,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        839,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        839,
        976,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        865,
        890,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        883,
        890,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [314, 890, [[0, 3]]],
      [
        871,
        897,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        872,
        897,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [895, 897, [[0, 3]]],
      [233, 897, [[0, 79]]],
      [355, 897, [[0, 3]]],
      [391, 897, [[0, 3]]],
      [
        577,
        897,
        [
          [0, 66],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        824,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        827,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        825,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        828,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        830,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        829,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [831, 897, [[0, 79]]],
      [
        832,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        833,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        835,
        897,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        836,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        838,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [840, 897, [[0, 79]]],
      [
        841,
        897,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        843,
        897,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        844,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        846,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        848,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        849,
        897,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        850,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        851,
        897,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [897, 967, [[0, 3]]],
      [355, 872, [[0, 3]]],
      [391, 872, [[0, 3]]],
      [
        824,
        872,
        [
          [0, 66],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        835,
        872,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        849,
        872,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [355, 824, [[0, 3]]],
      [355, 835, [[0, 3]]],
      [391, 835, [[0, 3]]],
      [
        577,
        835,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [355, 849, [[0, 3]]],
      [394, 849, [[0, 3]]],
      [399, 849, [[0, 3]]],
      [
        849,
        857,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        849,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        849,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [849, 951, [[0, 3]]],
      [355, 857, [[0, 3]]],
      [391, 857, [[0, 3]]],
      [
        577,
        857,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        856,
        857,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        857,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        857,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        857,
        922,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [857, 951, [[0, 3]]],
      [
        856,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [231, 233, [[0, 79]]],
      [233, 353, [[0, 3]]],
      [233, 314, [[0, 3]]],
      [233, 355, [[0, 3]]],
      [233, 315, [[0, 3]]],
      [233, 363, [[0, 3]]],
      [233, 398, [[0, 3]]],
      [233, 399, [[0, 3]]],
      [
        233,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [233, 931, [[0, 3]]],
      [233, 951, [[0, 3]]],
      [233, 967, [[0, 3]]],
      [231, 309, [[0, 3]]],
      [231, 314, [[0, 3]]],
      [231, 363, [[0, 3]]],
      [231, 376, [[0, 3]]],
      [231, 391, [[0, 3]]],
      [231, 399, [[0, 3]]],
      [231, 432, [[0, 3]]],
      [231, 905, [[0, 79]]],
      [
        231,
        938,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [231, 951, [[0, 3]]],
      [231, 975, [[0, 3]]],
      [231, 994, [[0, 3]]],
      [355, 827, [[0, 3]]],
      [391, 827, [[0, 3]]],
      [355, 825, [[0, 3]]],
      [391, 825, [[0, 3]]],
      [355, 828, [[0, 3]]],
      [391, 828, [[0, 3]]],
      [355, 830, [[0, 3]]],
      [391, 830, [[0, 3]]],
      [355, 829, [[0, 3]]],
      [391, 829, [[0, 3]]],
      [
        831,
        847,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        48,
        831,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [230, 831, [[0, 3]]],
      [355, 831, [[0, 3]]],
      [391, 831, [[0, 3]]],
      [
        466,
        831,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [472, 831, [[0, 79]]],
      [
        831,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [831, 918, [[0, 79]]],
      [230, 847, [[0, 3]]],
      [355, 847, [[0, 3]]],
      [
        847,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        847,
        919,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        48,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [355, 472, [[0, 3]]],
      [391, 472, [[0, 3]]],
      [
        452,
        472,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [472, 613, [[0, 79]]],
      [
        434,
        452,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        452,
        901,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        193,
        434,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        436,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        448,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        451,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        459,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        460,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        918,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        434,
        935,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        435,
        436,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        436,
        451,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        435,
        451,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        435,
        466,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        435,
        577,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        435,
        916,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        193,
        451,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        451,
        466,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        451,
        916,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        193,
        448,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        448,
        451,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        448,
        459,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        448,
        918,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        459,
        864,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        193,
        460,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        444,
        460,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        446,
        460,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        460,
        463,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        443,
        444,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        444,
        445,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        444,
        447,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        444,
        459,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        444,
        463,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        443,
        459,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        443,
        463,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        193,
        463,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        463,
        466,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        463,
        916,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        463,
        918,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        463,
        935,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        445,
        463,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        193,
        447,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        447,
        574,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [
        121,
        446,
        [
          [0, 31],
          [78, 79]
        ]
      ],
      [355, 832, [[0, 3]]],
      [391, 832, [[0, 3]]],
      [355, 833, [[0, 3]]],
      [391, 833, [[0, 3]]],
      [355, 836, [[0, 3]]],
      [391, 836, [[0, 3]]],
      [355, 838, [[0, 3]]],
      [391, 838, [[0, 3]]],
      [168, 840, [[0, 79]]],
      [169, 840, [[0, 79]]],
      [355, 840, [[0, 3]]],
      [391, 840, [[0, 3]]],
      [
        553,
        840,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 840, [[0, 79]]],
      [840, 939, [[0, 79]]],
      [
        840,
        970,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [840, 978, [[0, 79]]],
      [168, 355, [[0, 3]]],
      [168, 588, [[0, 3]]],
      [168, 587, [[0, 3]]],
      [168, 594, [[0, 3]]],
      [168, 740, [[0, 79]]],
      [168, 939, [[0, 79]]],
      [
        168,
        976,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [587, 594, [[0, 3]]],
      [
        165,
        169,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [167, 169, [[0, 3]]],
      [169, 170, [[0, 3]]],
      [169, 193, [[0, 3]]],
      [169, 355, [[0, 3]]],
      [
        169,
        553,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        169,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [169, 918, [[0, 79]]],
      [165, 355, [[0, 3]]],
      [
        165,
        465,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        165,
        553,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        465,
        553,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [167, 355, [[0, 3]]],
      [170, 355, [[0, 3]]],
      [355, 841, [[0, 3]]],
      [391, 841, [[0, 3]]],
      [
        577,
        841,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [355, 843, [[0, 3]]],
      [399, 843, [[0, 3]]],
      [
        843,
        856,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        843,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [843, 951, [[0, 3]]],
      [355, 844, [[0, 3]]],
      [391, 844, [[0, 3]]],
      [355, 846, [[0, 3]]],
      [391, 846, [[0, 3]]],
      [355, 848, [[0, 3]]],
      [391, 848, [[0, 3]]],
      [355, 850, [[0, 3]]],
      [391, 850, [[0, 3]]],
      [355, 851, [[0, 3]]],
      [391, 851, [[0, 3]]],
      [223, 910, [[0, 3]]],
      [
        173,
        926,
        [
          [0, 67],
          [69, 79]
        ]
      ],
      [187, 926, [[0, 79]]],
      [
        553,
        926,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [588, 926, [[0, 3]]],
      [594, 926, [[0, 3]]],
      [644, 926, [[0, 3]]],
      [
        730,
        926,
        [
          [0, 67],
          [69, 79]
        ]
      ],
      [
        864,
        926,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [925, 926, [[0, 79]]],
      [
        926,
        929,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [926, 939, [[0, 79]]],
      [926, 975, [[0, 3]]],
      [173, 355, [[0, 3]]],
      [
        173,
        845,
        [
          [0, 67],
          [69, 79]
        ]
      ],
      [
        173,
        865,
        [
          [0, 67],
          [69, 71],
          [77, 79]
        ]
      ],
      [173, 951, [[0, 3]]],
      [
        49,
        845,
        [
          [0, 67],
          [69, 79]
        ]
      ],
      [355, 845, [[0, 3]]],
      [391, 845, [[0, 3]]],
      [
        845,
        865,
        [
          [0, 67],
          [69, 71],
          [77, 79]
        ]
      ],
      [
        845,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        845,
        897,
        [
          [0, 66],
          [69, 70],
          [77, 79]
        ]
      ],
      [845, 951, [[0, 3]]],
      [
        49,
        926,
        [
          [0, 67],
          [69, 79]
        ]
      ],
      [146, 925, [[0, 79]]],
      [220, 925, [[0, 3]]],
      [355, 925, [[0, 3]]],
      [532, 925, [[0, 79]]],
      [533, 925, [[0, 3]]],
      [540, 925, [[0, 79]]],
      [541, 925, [[0, 3]]],
      [
        544,
        925,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        553,
        925,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        577,
        925,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 925, [[0, 79]]],
      [730, 925, [[0, 79]]],
      [868, 925, [[0, 79]]],
      [
        901,
        925,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        925,
        972,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [925, 975, [[0, 3]]],
      [925, 981, [[0, 3]]],
      [146, 355, [[0, 3]]],
      [146, 532, [[0, 79]]],
      [146, 540, [[0, 79]]],
      [
        146,
        544,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        146,
        577,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        146,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [146, 975, [[0, 3]]],
      [355, 532, [[0, 3]]],
      [532, 533, [[0, 3]]],
      [
        532,
        576,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [532, 613, [[0, 79]]],
      [532, 730, [[0, 79]]],
      [532, 975, [[0, 3]]],
      [
        576,
        577,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [355, 540, [[0, 3]]],
      [540, 541, [[0, 3]]],
      [
        540,
        576,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [540, 613, [[0, 79]]],
      [540, 730, [[0, 79]]],
      [540, 975, [[0, 3]]],
      [355, 544, [[0, 3]]],
      [
        544,
        576,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        544,
        577,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        544,
        606,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [544, 960, [[0, 12]]],
      [544, 975, [[0, 3]]],
      [
        606,
        612,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [606, 960, [[0, 12]]],
      [220, 355, [[0, 3]]],
      [220, 975, [[0, 3]]],
      [220, 994, [[0, 3]]],
      [972, 981, [[0, 3]]],
      [533, 972, [[0, 3]]],
      [541, 972, [[0, 3]]],
      [
        553,
        972,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [220, 981, [[0, 3]]],
      [223, 981, [[0, 3]]],
      [533, 981, [[0, 3]]],
      [541, 981, [[0, 3]]],
      [
        553,
        929,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        577,
        929,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [897, 950, [[0, 79]]],
      [355, 954, [[0, 3]]],
      [391, 954, [[0, 3]]],
      [613, 954, [[0, 79]]],
      [730, 954, [[0, 79]]],
      [
        865,
        954,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [954, 975, [[0, 3]]],
      [
        577,
        956,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [355, 1017, [[0, 3]]],
      [
        938,
        1017,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [308, 945, [[0, 3]]],
      [355, 945, [[0, 3]]],
      [592, 945, [[0, 3]]],
      [613, 945, [[0, 79]]],
      [730, 945, [[0, 79]]],
      [741, 945, [[0, 79]]],
      [905, 945, [[0, 79]]],
      [945, 975, [[0, 3]]],
      [945, 994, [[0, 3]]],
      [592, 741, [[0, 3]]],
      [730, 741, [[0, 79]]],
      [353, 985, [[0, 3]]],
      [85, 438, [[0, 0]]],
      [438, 449, [[0, 0]]],
      [438, 458, [[0, 0]]],
      [438, 465, [[0, 0]]],
      [438, 467, [[0, 0]]],
      [438, 469, [[0, 0]]],
      [437, 438, [[0, 0]]],
      [438, 439, [[0, 0]]],
      [438, 440, [[0, 0]]],
      [438, 441, [[0, 0]]],
      [438, 442, [[0, 0]]],
      [438, 918, [[0, 0]]],
      [
        449,
        464,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        449,
        465,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        449,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [449, 941, [[0, 79]]],
      [
        449,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        449,
        989,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        864,
        989,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        988,
        989,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [458, 464, [[0, 0]]],
      [458, 465, [[0, 0]]],
      [458, 466, [[0, 0]]],
      [458, 469, [[0, 0]]],
      [458, 470, [[0, 0]]],
      [458, 471, [[0, 0]]],
      [458, 473, [[0, 0]]],
      [458, 476, [[0, 0]]],
      [458, 477, [[0, 0]]],
      [453, 458, [[0, 0]]],
      [456, 458, [[0, 0]]],
      [193, 458, [[0, 0]]],
      [458, 590, [[0, 0]]],
      [458, 592, [[0, 0]]],
      [458, 603, [[0, 0]]],
      [458, 613, [[0, 0]]],
      [458, 642, [[0, 0]]],
      [458, 864, [[0, 0]]],
      [458, 865, [[0, 0]]],
      [458, 901, [[0, 0]]],
      [458, 905, [[0, 0]]],
      [458, 918, [[0, 0]]],
      [458, 938, [[0, 0]]],
      [458, 939, [[0, 0]]],
      [458, 970, [[0, 0]]],
      [458, 994, [[0, 0]]],
      [470, 471, [[0, 0]]],
      [355, 470, [[0, 0]]],
      [355, 471, [[0, 0]]],
      [471, 975, [[0, 0]]],
      [471, 473, [[0, 0]]],
      [355, 473, [[0, 0]]],
      [473, 531, [[0, 0]]],
      [473, 532, [[0, 0]]],
      [473, 533, [[0, 0]]],
      [473, 975, [[0, 0]]],
      [528, 531, [[0, 9]]],
      [531, 533, [[0, 3]]],
      [
        193,
        531,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [225, 531, [[0, 3]]],
      [226, 531, [[0, 3]]],
      [309, 531, [[0, 3]]],
      [314, 531, [[0, 3]]],
      [391, 531, [[0, 3]]],
      [
        531,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [531, 975, [[0, 3]]],
      [
        531,
        978,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [531, 994, [[0, 3]]],
      [193, 528, [[0, 9]]],
      [466, 528, [[0, 9]]],
      [528, 554, [[0, 9]]],
      [528, 555, [[0, 9]]],
      [528, 864, [[0, 9]]],
      [528, 994, [[0, 3]]],
      [464, 476, [[0, 0]]],
      [464, 477, [[0, 0]]],
      [477, 555, [[0, 0]]],
      [477, 904, [[0, 0]]],
      [477, 988, [[0, 0]]],
      [477, 989, [[0, 0]]],
      [
        553,
        904,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        554,
        904,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        555,
        904,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [644, 904, [[0, 3]]],
      [
        864,
        904,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        904,
        944,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        904,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        904,
        989,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        944,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        944,
        988,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [453, 592, [[0, 0]]],
      [456, 466, [[0, 0]]],
      [456, 592, [[0, 0]]],
      [456, 917, [[0, 0]]],
      [466, 917, [[0, 0]]],
      [553, 917, [[0, 0]]],
      [585, 917, [[0, 0]]],
      [864, 917, [[0, 0]]],
      [590, 594, [[0, 3]]],
      [577, 603, [[0, 0]]],
      [603, 604, [[0, 0]]],
      [603, 613, [[0, 0]]],
      [603, 644, [[0, 0]]],
      [603, 894, [[0, 0]]],
      [603, 901, [[0, 0]]],
      [464, 642, [[0, 0]]],
      [469, 642, [[0, 0]]],
      [642, 644, [[0, 0]]],
      [642, 879, [[0, 0]]],
      [642, 904, [[0, 0]]],
      [874, 879, [[0, 3]]],
      [875, 879, [[0, 3]]],
      [876, 879, [[0, 3]]],
      [877, 879, [[0, 3]]],
      [878, 879, [[0, 3]]],
      [879, 880, [[0, 3]]],
      [
        879,
        881,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [879, 964, [[0, 3]]],
      [644, 874, [[0, 3]]],
      [874, 964, [[0, 3]]],
      [644, 875, [[0, 3]]],
      [875, 964, [[0, 3]]],
      [644, 876, [[0, 3]]],
      [876, 964, [[0, 3]]],
      [644, 877, [[0, 3]]],
      [644, 878, [[0, 3]]],
      [880, 964, [[0, 3]]],
      [449, 467, [[0, 0]]],
      [464, 467, [[0, 0]]],
      [465, 467, [[0, 0]]],
      [467, 468, [[0, 0]]],
      [467, 469, [[0, 0]]],
      [437, 465, [[0, 0]]],
      [437, 468, [[0, 0]]],
      [439, 465, [[0, 0]]],
      [15, 439, [[0, 0]]],
      [15, 206, [[0, 0]]],
      [206, 864, [[0, 0]]],
      [440, 465, [[0, 0]]],
      [441, 465, [[0, 0]]],
      [442, 465, [[0, 0]]],
      [86, 462, [[0, 0]]],
      [86, 464, [[0, 0]]],
      [86, 467, [[0, 0]]],
      [86, 475, [[0, 0]]],
      [86, 918, [[0, 0]]],
      [462, 464, [[0, 0]]],
      [462, 477, [[0, 0]]],
      [465, 475, [[0, 0]]],
      [104, 105, [[0, 0]]],
      [104, 106, [[0, 0]]],
      [104, 107, [[0, 0]]],
      [104, 988, [[0, 0]]],
      [104, 989, [[0, 0]]],
      [15, 105, [[0, 0]]],
      [105, 988, [[0, 0]]],
      [105, 989, [[0, 0]]],
      [106, 988, [[0, 0]]],
      [106, 989, [[0, 0]]],
      [107, 577, [[0, 0]]],
      [107, 927, [[0, 0]]],
      [107, 988, [[0, 0]]],
      [107, 989, [[0, 0]]],
      [
        927,
        960,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [93, 94, [[0, 0]]],
      [93, 957, [[0, 0]]],
      [454, 474, [[0, 0]]],
      [454, 979, [[0, 0]]],
      [474, 979, [[0, 0]]],
      [455, 476, [[0, 0]]],
      [941, 952, [[0, 0]]],
      [952, 957, [[0, 0]]],
      [
        553,
        961,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        613,
        961,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        901,
        961,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        921,
        961,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [89, 183, [[0, 0]]],
      [183, 941, [[0, 0]]],
      [183, 961, [[0, 0]]],
      [54, 89, [[0, 0]]],
      [73, 89, [[0, 0]]],
      [76, 89, [[0, 0]]],
      [71, 89, [[0, 0]]],
      [89, 104, [[0, 0]]],
      [89, 94, [[0, 0]]],
      [89, 176, [[0, 0]]],
      [89, 177, [[0, 0]]],
      [89, 178, [[0, 0]]],
      [89, 181, [[0, 0]]],
      [89, 921, [[0, 0]]],
      [89, 926, [[0, 0]]],
      [89, 941, [[0, 0]]],
      [89, 988, [[0, 0]]],
      [73, 77, [[0, 0]]],
      [73, 74, [[0, 0]]],
      [73, 176, [[0, 0]]],
      [73, 986, [[0, 0]]],
      [73, 987, [[0, 0]]],
      [73, 988, [[0, 0]]],
      [73, 989, [[0, 0]]],
      [77, 176, [[0, 0]]],
      [176, 180, [[0, 0]]],
      [176, 613, [[0, 0]]],
      [176, 926, [[0, 0]]],
      [176, 929, [[0, 0]]],
      [176, 941, [[0, 0]]],
      [176, 986, [[0, 0]]],
      [176, 987, [[0, 0]]],
      [180, 926, [[0, 0]]],
      [941, 986, [[0, 0]]],
      [986, 988, [[0, 0]]],
      [986, 989, [[0, 0]]],
      [941, 987, [[0, 0]]],
      [74, 75, [[0, 0]]],
      [75, 78, [[0, 0]]],
      [75, 79, [[0, 0]]],
      [75, 613, [[0, 0]]],
      [75, 901, [[0, 0]]],
      [75, 926, [[0, 0]]],
      [75, 941, [[0, 0]]],
      [75, 987, [[0, 0]]],
      [78, 901, [[0, 0]]],
      [78, 941, [[0, 0]]],
      [79, 926, [[0, 0]]],
      [79, 941, [[0, 0]]],
      [76, 176, [[0, 0]]],
      [71, 179, [[0, 0]]],
      [71, 577, [[0, 0]]],
      [71, 957, [[0, 0]]],
      [179, 577, [[0, 0]]],
      [176, 177, [[0, 0]]],
      [177, 553, [[0, 0]]],
      [177, 577, [[0, 0]]],
      [177, 590, [[0, 0]]],
      [177, 604, [[0, 0]]],
      [177, 613, [[0, 0]]],
      [177, 864, [[0, 0]]],
      [177, 894, [[0, 0]]],
      [177, 901, [[0, 0]]],
      [177, 904, [[0, 0]]],
      [177, 905, [[0, 0]]],
      [177, 926, [[0, 0]]],
      [177, 938, [[0, 0]]],
      [177, 941, [[0, 0]]],
      [177, 970, [[0, 0]]],
      [177, 988, [[0, 0]]],
      [177, 989, [[0, 0]]],
      [177, 994, [[0, 0]]],
      [72, 178, [[0, 0]]],
      [72, 941, [[0, 0]]],
      [176, 181, [[0, 0]]],
      [181, 904, [[0, 0]]],
      [181, 941, [[0, 0]]],
      [181, 988, [[0, 0]]],
      [181, 989, [[0, 0]]],
      [90, 184, [[0, 0]]],
      [184, 923, [[0, 0]]],
      [184, 961, [[0, 0]]],
      [11, 90, [[0, 0]]],
      [90, 97, [[0, 0]]],
      [90, 98, [[0, 0]]],
      [90, 94, [[0, 0]]],
      [90, 162, [[0, 0]]],
      [90, 193, [[0, 0]]],
      [90, 202, [[0, 0]]],
      [90, 577, [[0, 0]]],
      [90, 916, [[0, 0]]],
      [90, 934, [[0, 0]]],
      [90, 935, [[0, 0]]],
      [90, 968, [[0, 0]]],
      [90, 993, [[0, 0]]],
      [11, 12, [[0, 0]]],
      [11, 186, [[0, 0]]],
      [11, 577, [[0, 0]]],
      [11, 968, [[0, 0]]],
      [11, 993, [[0, 0]]],
      [12, 968, [[0, 0]]],
      [186, 968, [[0, 0]]],
      [
        968,
        993,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [96, 97, [[0, 0]]],
      [97, 923, [[0, 0]]],
      [96, 923, [[0, 0]]],
      [98, 934, [[0, 0]]],
      [
        193,
        934,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        466,
        934,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        864,
        934,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        162,
        166,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        162,
        479,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [162, 594, [[0, 3]]],
      [
        162,
        935,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [166, 355, [[0, 3]]],
      [166, 590, [[0, 3]]],
      [166, 594, [[0, 3]]],
      [
        166,
        730,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        166,
        905,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        166,
        938,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        193,
        479,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        466,
        479,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        479,
        935,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [202, 968, [[0, 0]]],
      [91, 185, [[0, 0]]],
      [92, 185, [[0, 0]]],
      [185, 577, [[0, 0]]],
      [185, 961, [[0, 0]]],
      [91, 102, [[0, 0]]],
      [11, 91, [[0, 0]]],
      [12, 91, [[0, 0]]],
      [65, 91, [[0, 0]]],
      [83, 91, [[0, 0]]],
      [91, 103, [[0, 0]]],
      [91, 94, [[0, 0]]],
      [91, 202, [[0, 0]]],
      [91, 588, [[0, 0]]],
      [91, 590, [[0, 0]]],
      [91, 593, [[0, 0]]],
      [91, 905, [[0, 0]]],
      [91, 908, [[0, 0]]],
      [91, 921, [[0, 0]]],
      [91, 936, [[0, 0]]],
      [91, 938, [[0, 0]]],
      [91, 946, [[0, 0]]],
      [91, 955, [[0, 0]]],
      [91, 965, [[0, 0]]],
      [91, 968, [[0, 0]]],
      [9, 102, [[0, 0]]],
      [11, 102, [[0, 0]]],
      [12, 102, [[0, 0]]],
      [65, 102, [[0, 0]]],
      [102, 202, [[0, 0]]],
      [102, 590, [[0, 0]]],
      [102, 905, [[0, 0]]],
      [102, 936, [[0, 0]]],
      [102, 938, [[0, 0]]],
      [102, 946, [[0, 0]]],
      [102, 968, [[0, 0]]],
      [9, 936, [[0, 0]]],
      [936, 938, [[0, 0]]],
      [577, 936, [[0, 0]]],
      [936, 968, [[0, 0]]],
      [65, 205, [[0, 0]]],
      [65, 776, [[0, 0]]],
      [65, 862, [[0, 0]]],
      [65, 950, [[0, 0]]],
      [205, 355, [[0, 3]]],
      [
        205,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [353, 776, [[0, 0]]],
      [355, 776, [[0, 0]]],
      [776, 778, [[0, 0]]],
      [776, 779, [[0, 0]]],
      [776, 782, [[0, 0]]],
      [776, 789, [[0, 0]]],
      [776, 806, [[0, 0]]],
      [776, 854, [[0, 0]]],
      [776, 861, [[0, 0]]],
      [776, 950, [[0, 0]]],
      [776, 966, [[0, 0]]],
      [776, 967, [[0, 0]]],
      [777, 778, [[0, 0]]],
      [355, 778, [[0, 0]]],
      [778, 783, [[0, 0]]],
      [778, 966, [[0, 0]]],
      [310, 777, [[0, 0]]],
      [577, 783, [[0, 0]]],
      [783, 938, [[0, 0]]],
      [775, 779, [[0, 0]]],
      [779, 780, [[0, 0]]],
      [355, 779, [[0, 0]]],
      [730, 779, [[0, 0]]],
      [744, 779, [[0, 0]]],
      [745, 779, [[0, 0]]],
      [779, 792, [[0, 0]]],
      [779, 925, [[0, 0]]],
      [779, 931, [[0, 0]]],
      [779, 966, [[0, 0]]],
      [779, 975, [[0, 0]]],
      [775, 781, [[0, 0]]],
      [355, 775, [[0, 0]]],
      [730, 775, [[0, 0]]],
      [775, 783, [[0, 0]]],
      [775, 785, [[0, 0]]],
      [775, 786, [[0, 0]]],
      [355, 781, [[0, 0]]],
      [137, 785, [[0, 0]]],
      [325, 785, [[0, 0]]],
      [353, 785, [[0, 0]]],
      [309, 785, [[0, 0]]],
      [314, 785, [[0, 0]]],
      [315, 785, [[0, 0]]],
      [363, 785, [[0, 0]]],
      [318, 785, [[0, 0]]],
      [613, 785, [[0, 0]]],
      [730, 785, [[0, 0]]],
      [732, 785, [[0, 0]]],
      [733, 785, [[0, 0]]],
      [734, 785, [[0, 0]]],
      [738, 785, [[0, 0]]],
      [739, 785, [[0, 0]]],
      [745, 785, [[0, 0]]],
      [785, 790, [[0, 0]]],
      [785, 865, [[0, 0]]],
      [785, 930, [[0, 0]]],
      [785, 931, [[0, 0]]],
      [137, 732, [[0, 0]]],
      [386, 732, [[0, 0]]],
      [730, 732, [[0, 0]]],
      [321, 733, [[0, 0]]],
      [325, 733, [[0, 0]]],
      [353, 733, [[0, 0]]],
      [309, 733, [[0, 0]]],
      [318, 733, [[0, 0]]],
      [386, 733, [[0, 0]]],
      [730, 733, [[0, 0]]],
      [733, 994, [[0, 0]]],
      [309, 734, [[0, 0]]],
      [733, 734, [[0, 0]]],
      [734, 738, [[0, 0]]],
      [734, 745, [[0, 0]]],
      [312, 790, [[0, 0]]],
      [314, 790, [[0, 0]]],
      [386, 790, [[0, 0]]],
      [786, 865, [[0, 0]]],
      [786, 930, [[0, 0]]],
      [786, 931, [[0, 0]]],
      [780, 781, [[0, 0]]],
      [355, 780, [[0, 0]]],
      [780, 783, [[0, 0]]],
      [780, 785, [[0, 0]]],
      [780, 786, [[0, 0]]],
      [355, 744, [[0, 0]]],
      [744, 745, [[0, 0]]],
      [353, 792, [[0, 0]]],
      [792, 931, [[0, 0]]],
      [792, 994, [[0, 0]]],
      [775, 782, [[0, 0]]],
      [730, 782, [[0, 0]]],
      [744, 782, [[0, 0]]],
      [771, 782, [[0, 0]]],
      [782, 787, [[0, 0]]],
      [782, 789, [[0, 0]]],
      [782, 854, [[0, 0]]],
      [612, 771, [[0, 0]]],
      [771, 915, [[0, 0]]],
      [137, 787, [[0, 0]]],
      [355, 787, [[0, 0]]],
      [730, 787, [[0, 0]]],
      [744, 787, [[0, 0]]],
      [745, 787, [[0, 0]]],
      [748, 787, [[0, 0]]],
      [789, 967, [[0, 0]]],
      [795, 854, [[0, 0]]],
      [797, 854, [[0, 0]]],
      [798, 854, [[0, 0]]],
      [799, 854, [[0, 0]]],
      [800, 854, [[0, 0]]],
      [801, 854, [[0, 0]]],
      [805, 854, [[0, 0]]],
      [806, 854, [[0, 0]]],
      [807, 854, [[0, 0]]],
      [808, 854, [[0, 0]]],
      [809, 854, [[0, 0]]],
      [810, 854, [[0, 0]]],
      [814, 854, [[0, 0]]],
      [813, 854, [[0, 0]]],
      [815, 854, [[0, 0]]],
      [4, 854, [[0, 0]]],
      [6, 854, [[0, 0]]],
      [7, 854, [[0, 0]]],
      [16, 854, [[0, 0]]],
      [50, 854, [[0, 0]]],
      [51, 854, [[0, 0]]],
      [52, 854, [[0, 0]]],
      [69, 854, [[0, 0]]],
      [70, 854, [[0, 0]]],
      [81, 854, [[0, 0]]],
      [113, 854, [[0, 0]]],
      [752, 854, [[0, 0]]],
      [795, 967, [[0, 0]]],
      [796, 797, [[0, 0]]],
      [797, 967, [[0, 0]]],
      [391, 796, [[0, 0]]],
      [798, 821, [[0, 0]]],
      [391, 798, [[0, 0]]],
      [798, 967, [[0, 0]]],
      [821, 967, [[0, 0]]],
      [799, 967, [[0, 0]]],
      [800, 837, [[0, 0]]],
      [800, 865, [[0, 0]]],
      [800, 967, [[0, 0]]],
      [800, 975, [[0, 0]]],
      [355, 837, [[0, 0]]],
      [837, 859, [[0, 0]]],
      [837, 939, [[0, 0]]],
      [837, 975, [[0, 0]]],
      [553, 859, [[0, 0]]],
      [859, 864, [[0, 0]]],
      [859, 865, [[0, 0]]],
      [801, 802, [[0, 0]]],
      [801, 803, [[0, 0]]],
      [801, 804, [[0, 0]]],
      [801, 816, [[0, 0]]],
      [801, 967, [[0, 0]]],
      [802, 821, [[0, 0]]],
      [46, 802, [[0, 0]]],
      [353, 802, [[0, 0]]],
      [391, 802, [[0, 0]]],
      [802, 967, [[0, 0]]],
      [46, 47, [[0, 0]]],
      [46, 353, [[0, 0]]],
      [47, 353, [[0, 0]]],
      [803, 821, [[0, 0]]],
      [399, 803, [[0, 0]]],
      [803, 967, [[0, 0]]],
      [804, 821, [[0, 0]]],
      [804, 967, [[0, 0]]],
      [793, 816, [[0, 0]]],
      [794, 816, [[0, 0]]],
      [816, 967, [[0, 0]]],
      [793, 967, [[0, 0]]],
      [577, 794, [[0, 0]]],
      [794, 967, [[0, 0]]],
      [805, 821, [[0, 0]]],
      [805, 967, [[0, 0]]],
      [305, 806, [[0, 0]]],
      [312, 806, [[0, 0]]],
      [314, 806, [[0, 0]]],
      [391, 806, [[0, 0]]],
      [730, 806, [[0, 0]]],
      [790, 806, [[0, 0]]],
      [806, 858, [[0, 0]]],
      [806, 967, [[0, 0]]],
      [355, 858, [[0, 0]]],
      [391, 858, [[0, 0]]],
      [807, 967, [[0, 0]]],
      [808, 822, [[0, 0]]],
      [314, 808, [[0, 0]]],
      [808, 865, [[0, 0]]],
      [808, 871, [[0, 0]]],
      [822, 898, [[0, 0]]],
      [
        864,
        898,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [391, 809, [[0, 0]]],
      [809, 951, [[0, 0]]],
      [809, 967, [[0, 0]]],
      [809, 978, [[0, 0]]],
      [466, 810, [[0, 0]]],
      [810, 811, [[0, 0]]],
      [810, 812, [[0, 0]]],
      [810, 816, [[0, 0]]],
      [810, 967, [[0, 0]]],
      [811, 821, [[0, 0]]],
      [613, 811, [[0, 0]]],
      [811, 967, [[0, 0]]],
      [812, 817, [[0, 0]]],
      [812, 821, [[0, 0]]],
      [812, 823, [[0, 0]]],
      [812, 852, [[0, 0]]],
      [812, 853, [[0, 0]]],
      [812, 918, [[0, 0]]],
      [812, 967, [[0, 0]]],
      [817, 818, [[0, 0]]],
      [817, 834, [[0, 0]]],
      [818, 819, [[0, 0]]],
      [818, 820, [[0, 0]]],
      [460, 819, [[0, 0]]],
      [468, 820, [[0, 0]]],
      [730, 834, [[0, 0]]],
      [747, 834, [[0, 0]]],
      [355, 747, [[0, 3]]],
      [823, 918, [[0, 0]]],
      [823, 935, [[0, 0]]],
      [193, 852, [[0, 0]]],
      [613, 852, [[0, 0]]],
      [852, 864, [[0, 0]]],
      [852, 918, [[0, 0]]],
      [852, 967, [[0, 0]]],
      [464, 853, [[0, 0]]],
      [477, 853, [[0, 0]]],
      [532, 853, [[0, 0]]],
      [823, 853, [[0, 0]]],
      [143, 814, [[0, 0]]],
      [814, 967, [[0, 0]]],
      [
        138,
        143,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        141,
        143,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        142,
        143,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        143,
        147,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        143,
        149,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [143, 151, [[0, 0]]],
      [143, 355, [[0, 0]]],
      [143, 461, [[0, 0]]],
      [143, 730, [[0, 0]]],
      [143, 791, [[0, 0]]],
      [143, 905, [[0, 0]]],
      [143, 939, [[0, 0]]],
      [143, 978, [[0, 0]]],
      [138, 353, [[0, 0]]],
      [138, 355, [[0, 0]]],
      [139, 141, [[0, 0]]],
      [141, 145, [[0, 0]]],
      [141, 355, [[0, 0]]],
      [141, 577, [[0, 0]]],
      [141, 613, [[0, 0]]],
      [141, 730, [[0, 0]]],
      [139, 613, [[0, 0]]],
      [139, 730, [[0, 0]]],
      [139, 145, [[0, 0]]],
      [145, 355, [[0, 0]]],
      [145, 730, [[0, 0]]],
      [142, 314, [[0, 0]]],
      [142, 461, [[0, 0]]],
      [142, 921, [[0, 0]]],
      [193, 461, [[0, 0]]],
      [355, 461, [[0, 0]]],
      [453, 461, [[0, 0]]],
      [456, 461, [[0, 0]]],
      [461, 478, [[0, 0]]],
      [461, 901, [[0, 0]]],
      [461, 939, [[0, 0]]],
      [461, 976, [[0, 0]]],
      [478, 553, [[0, 0]]],
      [478, 864, [[0, 0]]],
      [145, 147, [[0, 0]]],
      [147, 148, [[0, 0]]],
      [147, 151, [[0, 0]]],
      [134, 147, [[0, 0]]],
      [147, 355, [[0, 0]]],
      [134, 148, [[0, 0]]],
      [148, 355, [[0, 0]]],
      [148, 613, [[0, 0]]],
      [148, 865, [[0, 0]]],
      [148, 921, [[0, 0]]],
      [148, 983, [[0, 0]]],
      [355, 983, [[0, 3]]],
      [151, 355, [[0, 0]]],
      [151, 577, [[0, 0]]],
      [151, 730, [[0, 0]]],
      [151, 938, [[0, 0]]],
      [151, 956, [[0, 0]]],
      [151, 978, [[0, 0]]],
      [151, 983, [[0, 0]]],
      [140, 149, [[0, 0]]],
      [144, 149, [[0, 0]]],
      [149, 150, [[0, 0]]],
      [149, 152, [[0, 0]]],
      [149, 355, [[0, 0]]],
      [140, 151, [[0, 0]]],
      [140, 355, [[0, 0]]],
      [140, 577, [[0, 0]]],
      [140, 730, [[0, 0]]],
      [140, 865, [[0, 0]]],
      [139, 144, [[0, 0]]],
      [144, 353, [[0, 0]]],
      [144, 355, [[0, 0]]],
      [144, 392, [[0, 0]]],
      [144, 730, [[0, 0]]],
      [144, 978, [[0, 0]]],
      [150, 355, [[0, 0]]],
      [150, 613, [[0, 0]]],
      [150, 730, [[0, 0]]],
      [150, 865, [[0, 0]]],
      [150, 901, [[0, 0]]],
      [150, 978, [[0, 0]]],
      [355, 791, [[0, 0]]],
      [553, 791, [[0, 0]]],
      [791, 984, [[0, 0]]],
      [
        553,
        984,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        553,
        813,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        613,
        813,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        730,
        813,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        813,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        813,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [813, 951, [[0, 3]]],
      [813, 967, [[0, 3]]],
      [
        813,
        978,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [815, 821, [[0, 0]]],
      [391, 815, [[0, 0]]],
      [815, 967, [[0, 0]]],
      [4, 133, [[0, 0]]],
      [133, 730, [[0, 0]]],
      [133, 826, [[0, 0]]],
      [133, 865, [[0, 0]]],
      [355, 826, [[0, 0]]],
      [826, 859, [[0, 0]]],
      [826, 939, [[0, 0]]],
      [826, 975, [[0, 0]]],
      [
        6,
        188,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [6, 314, [[0, 3]]],
      [
        6,
        730,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        6,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [6, 967, [[0, 3]]],
      [6, 975, [[0, 3]]],
      [
        188,
        204,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        188,
        242,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [188, 314, [[0, 3]]],
      [
        188,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        204,
        277,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [204, 314, [[0, 3]]],
      [
        242,
        279,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        242,
        277,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        274,
        279,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        277,
        279,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        7,
        189,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        7,
        244,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [7, 314, [[0, 3]]],
      [
        7,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [7, 967, [[0, 3]]],
      [
        7,
        978,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        189,
        204,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        189,
        244,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [189, 314, [[0, 3]]],
      [
        244,
        279,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        244,
        277,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [16, 203, [[0, 0]]],
      [16, 939, [[0, 0]]],
      [16, 967, [[0, 0]]],
      [203, 730, [[0, 0]]],
      [203, 951, [[0, 0]]],
      [203, 967, [[0, 0]]],
      [203, 969, [[0, 0]]],
      [50, 194, [[0, 0]]],
      [50, 203, [[0, 0]]],
      [50, 967, [[0, 0]]],
      [194, 314, [[0, 0]]],
      [194, 939, [[0, 0]]],
      [194, 978, [[0, 0]]],
      [
        51,
        53,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        51,
        195,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [51, 314, [[0, 3]]],
      [
        51,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        51,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [51, 967, [[0, 3]]],
      [
        51,
        978,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        53,
        55,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        53,
        57,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [53, 314, [[0, 3]]],
      [
        54,
        55,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [55, 314, [[0, 3]]],
      [
        55,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        57,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        51,
        52,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        52,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [52, 967, [[0, 3]]],
      [69, 175, [[0, 0]]],
      [175, 234, [[0, 0]]],
      [175, 391, [[0, 0]]],
      [175, 864, [[0, 0]]],
      [175, 865, [[0, 0]]],
      [175, 939, [[0, 0]]],
      [175, 951, [[0, 0]]],
      [70, 967, [[0, 0]]],
      [80, 81, [[0, 0]]],
      [81, 82, [[0, 0]]],
      [81, 203, [[0, 0]]],
      [81, 391, [[0, 0]]],
      [81, 939, [[0, 0]]],
      [81, 967, [[0, 0]]],
      [80, 82, [[0, 0]]],
      [80, 199, [[0, 0]]],
      [80, 353, [[0, 0]]],
      [80, 391, [[0, 0]]],
      [80, 979, [[0, 0]]],
      [82, 391, [[0, 0]]],
      [199, 391, [[0, 0]]],
      [199, 979, [[0, 0]]],
      [111, 113, [[0, 0]]],
      [113, 210, [[0, 0]]],
      [113, 211, [[0, 0]]],
      [113, 212, [[0, 0]]],
      [113, 391, [[0, 0]]],
      [113, 865, [[0, 0]]],
      [113, 967, [[0, 0]]],
      [113, 975, [[0, 0]]],
      [111, 112, [[0, 0]]],
      [111, 208, [[0, 0]]],
      [111, 211, [[0, 0]]],
      [111, 391, [[0, 0]]],
      [111, 803, [[0, 0]]],
      [111, 967, [[0, 0]]],
      [112, 199, [[0, 0]]],
      [112, 209, [[0, 0]]],
      [112, 391, [[0, 0]]],
      [209, 979, [[0, 0]]],
      [194, 208, [[0, 0]]],
      [211, 995, [[0, 0]]],
      [864, 995, [[0, 0]]],
      [210, 391, [[0, 0]]],
      [212, 355, [[0, 0]]],
      [212, 613, [[0, 0]]],
      [212, 864, [[0, 0]]],
      [212, 865, [[0, 0]]],
      [212, 939, [[0, 0]]],
      [212, 951, [[0, 0]]],
      [212, 976, [[0, 0]]],
      [752, 757, [[0, 0]]],
      [752, 758, [[0, 0]]],
      [752, 759, [[0, 0]]],
      [752, 865, [[0, 0]]],
      [752, 939, [[0, 0]]],
      [314, 757, [[0, 0]]],
      [757, 758, [[0, 0]]],
      [757, 769, [[0, 0]]],
      [314, 759, [[0, 0]]],
      [754, 759, [[0, 0]]],
      [861, 862, [[0, 0]]],
      [83, 938, [[0, 0]]],
      [64, 103, [[0, 0]]],
      [93, 103, [[0, 0]]],
      [103, 938, [[0, 0]]],
      [64, 197, [[0, 0]]],
      [64, 862, [[0, 0]]],
      [64, 938, [[0, 0]]],
      [197, 907, [[0, 0]]],
      [197, 938, [[0, 0]]],
      [197, 1018, [[0, 0]]],
      [864, 907, [[0, 0]]],
      [907, 938, [[0, 0]]],
      [907, 1018, [[0, 0]]],
      [938, 1018, [[0, 0]]],
      [908, 938, [[0, 0]]],
      [908, 965, [[0, 0]]],
      [908, 968, [[0, 0]]],
      [908, 993, [[0, 0]]],
      [
        938,
        965,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [938, 955, [[0, 0]]],
      [92, 99, [[0, 0]]],
      [92, 101, [[0, 0]]],
      [92, 94, [[0, 0]]],
      [92, 166, [[0, 0]]],
      [92, 193, [[0, 0]]],
      [92, 593, [[0, 0]]],
      [92, 908, [[0, 0]]],
      [92, 938, [[0, 0]]],
      [92, 965, [[0, 0]]],
      [92, 968, [[0, 0]]],
      [92, 993, [[0, 0]]],
      [13, 99, [[0, 0]]],
      [99, 936, [[0, 0]]],
      [99, 938, [[0, 0]]],
      [99, 965, [[0, 0]]],
      [99, 968, [[0, 0]]],
      [13, 14, [[0, 0]]],
      [13, 936, [[0, 0]]],
      [13, 938, [[0, 0]]],
      [13, 946, [[0, 0]]],
      [13, 968, [[0, 0]]],
      [14, 66, [[0, 0]]],
      [14, 171, [[0, 0]]],
      [14, 936, [[0, 0]]],
      [14, 938, [[0, 0]]],
      [14, 946, [[0, 0]]],
      [14, 968, [[0, 0]]],
      [66, 67, [[0, 0]]],
      [66, 68, [[0, 0]]],
      [66, 776, [[0, 0]]],
      [66, 862, [[0, 0]]],
      [66, 938, [[0, 0]]],
      [67, 938, [[0, 0]]],
      [68, 938, [[0, 0]]],
      [166, 171, [[0, 0]]],
      [171, 577, [[0, 0]]],
      [171, 938, [[0, 0]]],
      [100, 101, [[0, 0]]],
      [101, 192, [[0, 0]]],
      [101, 938, [[0, 0]]],
      [66, 100, [[0, 0]]],
      [100, 166, [[0, 0]]],
      [100, 171, [[0, 0]]],
      [100, 192, [[0, 0]]],
      [192, 938, [[0, 0]]],
      [
        162,
        450,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        193,
        450,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [
        450,
        452,
        [
          [0, 52],
          [78, 79]
        ]
      ],
      [450, 592, [[0, 3]]],
      [84, 610, [[0, 0]]],
      [610, 961, [[0, 0]]],
      [84, 88, [[0, 0]]],
      [84, 613, [[0, 0]]],
      [84, 921, [[0, 0]]],
      [11, 88, [[0, 0]]],
      [12, 88, [[0, 0]]],
      [88, 94, [[0, 0]]],
      [88, 108, [[0, 0]]],
      [88, 187, [[0, 0]]],
      [88, 202, [[0, 0]]],
      [88, 577, [[0, 0]]],
      [88, 593, [[0, 0]]],
      [88, 604, [[0, 0]]],
      [88, 613, [[0, 0]]],
      [88, 958, [[0, 0]]],
      [88, 968, [[0, 0]]],
      [88, 993, [[0, 0]]],
      [12, 108, [[0, 0]]],
      [108, 613, [[0, 0]]],
      [108, 968, [[0, 0]]],
      [
        914,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        919,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        921,
        958,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [925, 958, [[0, 79]]],
      [
        953,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        957,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        577,
        958,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [613, 958, [[0, 79]]],
      [
        899,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        901,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        958,
        961,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        131,
        953,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        132,
        953,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        921,
        953,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        953,
        960,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        953,
        961,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        0,
        131,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        2,
        131,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        131,
        961,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        0,
        1,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        0,
        129,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        0,
        921,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        1,
        921,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        129,
        921,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        1,
        2,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        2,
        129,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        2,
        921,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        3,
        132,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        132,
        961,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        3,
        130,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        130,
        553,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        130,
        864,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [
        130,
        926,
        [
          [0, 32],
          [78, 79]
        ]
      ],
      [355, 899, [[0, 3]]],
      [
        577,
        899,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        865,
        899,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        894,
        899,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        899,
        938,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [95, 611, [[0, 0]]],
      [577, 611, [[0, 0]]],
      [611, 613, [[0, 0]]],
      [611, 961, [[0, 0]]],
      [88, 95, [[0, 0]]],
      [
        921,
        933,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [730, 933, [[0, 79]]],
      [
        933,
        960,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [592, 630, [[0, 3]]],
      [630, 637, [[0, 3]]],
      [630, 644, [[0, 3]]],
      [
        630,
        934,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [605, 637, [[0, 3]]],
      [637, 644, [[0, 3]]],
      [
        535,
        631,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [631, 638, [[0, 3]]],
      [631, 923, [[0, 3]]],
      [
        632,
        634,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        577,
        632,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [588, 632, [[0, 3]]],
      [592, 632, [[0, 3]]],
      [
        632,
        633,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        632,
        635,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [632, 644, [[0, 3]]],
      [
        632,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        632,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        632,
        918,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [391, 634, [[0, 3]]],
      [634, 644, [[0, 3]]],
      [
        634,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        577,
        635,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [592, 635, [[0, 3]]],
      [
        535,
        639,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [639, 644, [[0, 3]]],
      [605, 640, [[0, 3]]],
      [640, 644, [[0, 3]]],
      [
        535,
        641,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [605, 641, [[0, 3]]],
      [637, 641, [[0, 3]]],
      [
        639,
        641,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [640, 641, [[0, 3]]],
      [641, 644, [[0, 3]]],
      [
        577,
        912,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [592, 912, [[0, 3]]],
      [
        760,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        193,
        760,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        503,
        760,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [548, 760, [[0, 3]]],
      [
        549,
        760,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        577,
        760,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [592, 760, [[0, 3]]],
      [
        626,
        760,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        760,
        912,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        760,
        919,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        760,
        921,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        766,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        121,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [550, 767, [[0, 3]]],
      [
        549,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        577,
        767,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        613,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        730,
        767,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        767,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        767,
        925,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        767,
        926,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        762,
        766,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        763,
        766,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        764,
        766,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        765,
        766,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [547, 766, [[0, 3]]],
      [550, 766, [[0, 3]]],
      [
        766,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [761, 762, [[0, 3]]],
      [309, 762, [[0, 3]]],
      [314, 762, [[0, 3]]],
      [762, 975, [[0, 3]]],
      [
        762,
        978,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [228, 761, [[0, 3]]],
      [309, 761, [[0, 3]]],
      [314, 761, [[0, 3]]],
      [761, 975, [[0, 3]]],
      [761, 983, [[0, 3]]],
      [
        762,
        763,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [353, 764, [[0, 3]]],
      [
        730,
        764,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [355, 765, [[0, 3]]],
      [547, 765, [[0, 3]]],
      [
        730,
        765,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [745, 765, [[0, 3]]],
      [747, 765, [[0, 3]]],
      [
        503,
        505,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        114,
        503,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        116,
        503,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [214, 503, [[0, 3]]],
      [
        503,
        507,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [503, 508, [[0, 3]]],
      [503, 515, [[0, 3]]],
      [
        503,
        516,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [503, 517, [[0, 3]]],
      [503, 588, [[0, 3]]],
      [503, 592, [[0, 3]]],
      [503, 594, [[0, 3]]],
      [
        503,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        503,
        596,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [503, 597, [[0, 3]]],
      [
        503,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        503,
        696,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        503,
        699,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        503,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        503,
        727,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        503,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        503,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [505, 594, [[0, 3]]],
      [
        505,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [508, 515, [[0, 3]]],
      [515, 517, [[0, 3]]],
      [515, 594, [[0, 3]]],
      [511, 516, [[0, 3]]],
      [516, 517, [[0, 3]]],
      [214, 516, [[0, 3]]],
      [508, 516, [[0, 3]]],
      [515, 516, [[0, 3]]],
      [516, 588, [[0, 3]]],
      [516, 592, [[0, 3]]],
      [516, 594, [[0, 3]]],
      [
        516,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        516,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        516,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [511, 597, [[0, 3]]],
      [594, 597, [[0, 3]]],
      [594, 596, [[0, 3]]],
      [
        595,
        596,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        696,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        193,
        699,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        646,
        699,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [653, 699, [[0, 79]]],
      [
        651,
        653,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        652,
        653,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        654,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        655,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        656,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        657,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        658,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        653,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        193,
        653,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        574,
        653,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [588, 653, [[0, 3]]],
      [
        646,
        653,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        647,
        653,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        648,
        653,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [653, 659, [[0, 3]]],
      [653, 698, [[0, 79]]],
      [
        653,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        653,
        722,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [653, 723, [[0, 3]]],
      [
        646,
        651,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        646,
        652,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        646,
        654,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        655,
        657,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        646,
        655,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        646,
        657,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        655,
        656,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        656,
        657,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        646,
        656,
        [
          [0, 69],
          [71, 79]
        ]
      ],
      [
        481,
        658,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        658,
        722,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        193,
        722,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [480, 722, [[0, 3]]],
      [483, 722, [[0, 79]]],
      [486, 722, [[0, 79]]],
      [588, 722, [[0, 3]]],
      [592, 722, [[0, 3]]],
      [594, 722, [[0, 3]]],
      [
        647,
        722,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [719, 722, [[0, 79]]],
      [116, 483, [[0, 79]]],
      [
        193,
        483,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [481, 483, [[0, 79]]],
      [483, 592, [[0, 3]]],
      [
        483,
        864,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [483, 919, [[0, 79]]],
      [483, 719, [[0, 79]]],
      [
        647,
        719,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        646,
        648,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [557, 659, [[0, 3]]],
      [588, 698, [[0, 3]]],
      [592, 698, [[0, 3]]],
      [
        646,
        698,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        696,
        698,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [698, 699, [[0, 79]]],
      [
        698,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        698,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [193, 723, [[0, 3]]],
      [594, 723, [[0, 3]]],
      [601, 723, [[0, 3]]],
      [594, 601, [[0, 3]]],
      [214, 727, [[0, 3]]],
      [
        721,
        727,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        116,
        626,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        187,
        626,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        207,
        626,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [588, 626, [[0, 3]]],
      [
        616,
        626,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        626,
        628,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [626, 629, [[0, 3]]],
      [
        626,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        626,
        901,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        616,
        628,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [616, 629, [[0, 3]]],
      [628, 629, [[0, 3]]],
      [628, 644, [[0, 3]]],
      [
        628,
        864,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        628,
        865,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        628,
        918,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [629, 644, [[0, 3]]],
      [
        116,
        998,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [588, 998, [[0, 3]]],
      [592, 998, [[0, 3]]],
      [594, 998, [[0, 3]]],
      [
        901,
        998,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        998,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        116,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        575,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        721,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        919,
        1009,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [214, 575, [[0, 3]]],
      [
        487,
        575,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        575,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        1003,
        1004,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [309, 1004, [[0, 3]]],
      [315, 1004, [[0, 3]]],
      [
        233,
        1003,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [344, 1003, [[0, 3]]],
      [353, 1003, [[0, 3]]],
      [309, 1003, [[0, 3]]],
      [314, 1003, [[0, 3]]],
      [315, 1003, [[0, 3]]],
      [372, 1003, [[0, 3]]],
      [389, 1003, [[0, 3]]],
      [391, 1003, [[0, 3]]],
      [592, 1003, [[0, 3]]],
      [951, 1003, [[0, 3]]],
      [969, 1003, [[0, 3]]],
      [975, 1003, [[0, 3]]],
      [
        613,
        1007,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        999,
        1008,
        [
          [0, 28],
          [78, 79]
        ]
      ],
      [
        1008,
        1013,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        1008,
        1015,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [1008, 1016, [[0, 3]]],
      [594, 1008, [[0, 3]]],
      [
        612,
        1008,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        999,
        1015,
        [
          [0, 28],
          [78, 79]
        ]
      ],
      [999, 1016, [[0, 3]]],
      [588, 999, [[0, 3]]],
      [
        1013,
        1015,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [1014, 1015, [[0, 3]]],
      [
        999,
        1013,
        [
          [0, 28],
          [78, 79]
        ]
      ],
      [1010, 1014, [[0, 3]]],
      [1005, 1010, [[0, 3]]],
      [1006, 1010, [[0, 3]]],
      [1000, 1005, [[0, 3]]],
      [1005, 1006, [[0, 3]]],
      [1000, 1002, [[0, 3]]],
      [592, 1000, [[0, 3]]],
      [592, 1002, [[0, 3]]],
      [592, 1006, [[0, 3]]],
      [594, 1016, [[0, 3]]],
      [
        245,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        245,
        883,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [246, 557, [[0, 3]]],
      [
        246,
        730,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        246,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        246,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        247,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        247,
        584,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        247,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        247,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        116,
        584,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [584, 588, [[0, 3]]],
      [
        116,
        248,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        121,
        248,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        248,
        556,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        248,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        249,
        483,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        249,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        250,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [250, 353, [[0, 3]]],
      [250, 355, [[0, 3]]],
      [
        251,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        252,
        304,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [252, 314, [[0, 3]]],
      [252, 355, [[0, 3]]],
      [252, 391, [[0, 3]]],
      [252, 402, [[0, 3]]],
      [
        252,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        252,
        905,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [252, 951, [[0, 3]]],
      [252, 967, [[0, 3]]],
      [304, 353, [[0, 3]]],
      [304, 314, [[0, 3]]],
      [304, 355, [[0, 3]]],
      [304, 386, [[0, 3]]],
      [
        304,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [304, 931, [[0, 3]]],
      [304, 967, [[0, 3]]],
      [253, 314, [[0, 3]]],
      [
        253,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        254,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        255,
        613,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        255,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        255,
        901,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        256,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        256,
        303,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [256, 353, [[0, 3]]],
      [256, 355, [[0, 3]]],
      [256, 363, [[0, 3]]],
      [256, 389, [[0, 3]]],
      [256, 398, [[0, 3]]],
      [256, 644, [[0, 3]]],
      [
        256,
        938,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        256,
        950,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        256,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [256, 996, [[0, 3]]],
      [
        303,
        304,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [303, 353, [[0, 3]]],
      [303, 314, [[0, 3]]],
      [303, 355, [[0, 3]]],
      [303, 360, [[0, 3]]],
      [303, 363, [[0, 3]]],
      [303, 391, [[0, 3]]],
      [
        303,
        466,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        303,
        472,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        303,
        860,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        303,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        303,
        897,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        303,
        905,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [303, 951, [[0, 3]]],
      [303, 967, [[0, 3]]],
      [303, 982, [[0, 3]]],
      [303, 990, [[0, 3]]],
      [355, 860, [[0, 3]]],
      [979, 982, [[0, 3]]],
      [355, 990, [[0, 3]]],
      [975, 990, [[0, 3]]],
      [355, 996, [[0, 3]]],
      [590, 996, [[0, 3]]],
      [
        257,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [257, 353, [[0, 3]]],
      [257, 355, [[0, 3]]],
      [
        257,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        257,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [258, 314, [[0, 3]]],
      [
        258,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [259, 314, [[0, 3]]],
      [
        259,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [259, 755, [[0, 3]]],
      [259, 758, [[0, 3]]],
      [
        259,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [260, 314, [[0, 3]]],
      [
        260,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        262,
        770,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        262,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [314, 770, [[0, 3]]],
      [
        769,
        770,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        770,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        241,
        284,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        243,
        284,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        284,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        283,
        284,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        284,
        285,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        284,
        293,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [284, 314, [[0, 3]]],
      [
        284,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        284,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        284,
        927,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        284,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        6,
        241,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [241, 314, [[0, 3]]],
      [
        241,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        241,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        7,
        243,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [243, 314, [[0, 3]]],
      [
        243,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        243,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        51,
        264,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        54,
        264,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        264,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        280,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        268,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        267,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        281,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        269,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [264, 353, [[0, 3]]],
      [264, 314, [[0, 3]]],
      [264, 391, [[0, 3]]],
      [
        264,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [264, 592, [[0, 3]]],
      [
        264,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        264,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        264,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        264,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [264, 975, [[0, 3]]],
      [
        264,
        978,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        268,
        280,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [280, 353, [[0, 3]]],
      [280, 355, [[0, 3]]],
      [
        267,
        268,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        267,
        269,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [267, 353, [[0, 3]]],
      [267, 314, [[0, 3]]],
      [267, 391, [[0, 3]]],
      [
        267,
        577,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        267,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        267,
        970,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        268,
        281,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [281, 314, [[0, 3]]],
      [
        52,
        283,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        283,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        280,
        283,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        267,
        283,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        281,
        283,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [283, 353, [[0, 3]]],
      [283, 314, [[0, 3]]],
      [283, 391, [[0, 3]]],
      [
        283,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        283,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        283,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        285,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        280,
        285,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        268,
        285,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        267,
        285,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [285, 353, [[0, 3]]],
      [285, 314, [[0, 3]]],
      [
        285,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        285,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        285,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        285,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        285,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [285, 975, [[0, 3]]],
      [
        51,
        293,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        195,
        293,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        280,
        293,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        267,
        293,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [293, 353, [[0, 3]]],
      [293, 314, [[0, 3]]],
      [
        293,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        293,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        293,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        293,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        293,
        906,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [293, 975, [[0, 3]]],
      [
        157,
        286,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [286, 355, [[0, 3]]],
      [
        286,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        287,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        287,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        287,
        883,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [287, 353, [[0, 3]]],
      [287, 355, [[0, 3]]],
      [287, 592, [[0, 3]]],
      [
        287,
        901,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        287,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [287, 996, [[0, 3]]],
      [
        288,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        288,
        897,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [288, 355, [[0, 3]]],
      [
        289,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        290,
        299,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [290, 314, [[0, 3]]],
      [
        290,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        290,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [290, 975, [[0, 3]]],
      [299, 314, [[0, 3]]],
      [299, 355, [[0, 3]]],
      [
        299,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        299,
        813,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        299,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        299,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        299,
        897,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [299, 951, [[0, 3]]],
      [
        291,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        291,
        303,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [291, 353, [[0, 3]]],
      [291, 355, [[0, 3]]],
      [291, 363, [[0, 3]]],
      [291, 398, [[0, 3]]],
      [
        292,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [292, 314, [[0, 3]]],
      [292, 990, [[0, 3]]],
      [
        294,
        299,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        294,
        903,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [295, 355, [[0, 3]]],
      [
        295,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [296, 355, [[0, 3]]],
      [
        296,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        298,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        297,
        298,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [298, 355, [[0, 3]]],
      [298, 317, [[0, 3]]],
      [
        298,
        960,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        297,
        897,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [297, 861, [[0, 3]]],
      [297, 863, [[0, 3]]],
      [
        300,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        300,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        165,
        300,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [167, 300, [[0, 3]]],
      [170, 300, [[0, 3]]],
      [300, 355, [[0, 3]]],
      [300, 391, [[0, 3]]],
      [
        300,
        553,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [300, 592, [[0, 3]]],
      [
        300,
        855,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        300,
        871,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        300,
        898,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [300, 951, [[0, 3]]],
      [
        300,
        962,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [300, 975, [[0, 3]]],
      [
        855,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        960,
        962,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        961,
        962,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [355, 962, [[0, 3]]],
      [
        553,
        962,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        864,
        962,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        865,
        962,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [
        871,
        962,
        [
          [0, 27],
          [78, 79]
        ]
      ],
      [
        301,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [301, 314, [[0, 3]]],
      [
        302,
        864,
        [
          [0, 65],
          [68, 68],
          [77, 79]
        ]
      ],
      [
        302,
        865,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [302, 314, [[0, 3]]],
      [
        302,
        939,
        [
          [0, 65],
          [68, 70],
          [77, 79]
        ]
      ],
      [341, 353, [[0, 3]]],
      [312, 341, [[0, 3]]],
      [588, 591, [[0, 3]]],
      [591, 594, [[0, 3]]],
      [
        457,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        522,
        523,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        522,
        524,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        524,
        525,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [355, 971, [[0, 3]]],
      [
        27,
        41,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        27,
        42,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        27,
        43,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        27,
        114,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [27, 214, [[0, 3]]],
      [
        27,
        484,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [27, 557, [[0, 3]]],
      [41, 214, [[0, 3]]],
      [41, 557, [[0, 3]]],
      [
        41,
        914,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        41,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        42,
        114,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        42,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [43, 44, [[0, 3]]],
      [
        43,
        117,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        43,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [44, 216, [[0, 3]]],
      [216, 557, [[0, 3]]],
      [
        117,
        193,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [117, 216, [[0, 3]]],
      [117, 558, [[0, 3]]],
      [
        114,
        484,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [484, 592, [[0, 3]]],
      [
        484,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        45,
        120,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        45,
        121,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        45,
        123,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        45,
        514,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [45, 588, [[0, 3]]],
      [
        45,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        45,
        698,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        45,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        510,
        514,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [514, 594, [[0, 3]]],
      [
        514,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [508, 510, [[0, 3]]],
      [
        510,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        646,
        717,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        717,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        123,
        717,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        193,
        717,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        698,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        28,
        114,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        28,
        127,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        28,
        574,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [28, 588, [[0, 3]]],
      [28, 594, [[0, 3]]],
      [
        28,
        595,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        29,
        114,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [490, 588, [[0, 3]]],
      [
        118,
        509,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        121,
        509,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [489, 509, [[0, 13]]],
      [509, 514, [[0, 13]]],
      [509, 588, [[0, 3]]],
      [509, 592, [[0, 3]]],
      [509, 711, [[0, 13]]],
      [
        509,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [193, 489, [[0, 13]]],
      [489, 592, [[0, 3]]],
      [489, 646, [[0, 13]]],
      [
        120,
        711,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        193,
        711,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        499,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        507,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [588, 711, [[0, 3]]],
      [592, 711, [[0, 3]]],
      [
        595,
        711,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        596,
        711,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        711,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        650,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        653,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        656,
        711,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        660,
        711,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        696,
        711,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        698,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        699,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        708,
        711,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        711,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        711,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        116,
        499,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [499, 592, [[0, 3]]],
      [
        499,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        499,
        696,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        499,
        699,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        499,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        650,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        193,
        650,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [588, 650, [[0, 3]]],
      [594, 650, [[0, 3]]],
      [649, 650, [[0, 3]]],
      [
        650,
        698,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        650,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [650, 723, [[0, 3]]],
      [213, 649, [[0, 3]]],
      [214, 649, [[0, 3]]],
      [
        646,
        660,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        193,
        708,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        708,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        656,
        708,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        708,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        193,
        718,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [508, 718, [[0, 3]]],
      [517, 718, [[0, 3]]],
      [
        574,
        718,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [588, 718, [[0, 3]]],
      [592, 718, [[0, 3]]],
      [594, 718, [[0, 3]]],
      [
        646,
        718,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        648,
        718,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [659, 718, [[0, 3]]],
      [
        698,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        718,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [718, 723, [[0, 3]]],
      [
        604,
        620,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        613,
        620,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        621,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        622,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        623,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        624,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        625,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        620,
        628,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        621,
        625,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        613,
        625,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [625, 629, [[0, 3]]],
      [
        618,
        622,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        619,
        622,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        193,
        622,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        617,
        622,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        622,
        623,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        622,
        625,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        618,
        627,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        627,
        864,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        619,
        628,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        617,
        623,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        116,
        623,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        623,
        627,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        613,
        624,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        623,
        624,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        624,
        627,
        [
          [0, 68],
          [77, 79]
        ]
      ],
      [
        624,
        628,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        646,
        672,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        672,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        673,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        674,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        675,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        677,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [676, 677, [[0, 3]]],
      [
        661,
        677,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        677,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [677, 725, [[0, 3]]],
      [676, 725, [[0, 3]]],
      [592, 725, [[0, 3]]],
      [
        121,
        661,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [588, 661, [[0, 3]]],
      [594, 661, [[0, 3]]],
      [
        661,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        678,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [507, 678, [[0, 79]]],
      [
        114,
        679,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        679,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        680,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        681,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        681,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        682,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        682,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        683,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        671,
        684,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        684,
        715,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        684,
        716,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        684,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        671,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        715,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        716,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        121,
        669,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        127,
        669,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        574,
        669,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [588, 669, [[0, 3]]],
      [592, 669, [[0, 3]]],
      [594, 669, [[0, 3]]],
      [
        595,
        669,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        669,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        648,
        669,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        657,
        669,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        669,
        698,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [669, 702, [[0, 14]]],
      [
        669,
        710,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        669,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [669, 723, [[0, 3]]],
      [669, 724, [[0, 3]]],
      [
        669,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        669,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [592, 702, [[0, 3]]],
      [646, 702, [[0, 14]]],
      [696, 702, [[0, 14]]],
      [699, 702, [[0, 14]]],
      [
        121,
        710,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        193,
        710,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [594, 710, [[0, 3]]],
      [
        646,
        710,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        653,
        710,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        710,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [588, 724, [[0, 3]]],
      [723, 724, [[0, 3]]],
      [
        116,
        701,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        701,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [214, 701, [[0, 3]]],
      [508, 701, [[0, 3]]],
      [517, 701, [[0, 3]]],
      [588, 701, [[0, 3]]],
      [594, 701, [[0, 3]]],
      [
        595,
        701,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        701,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        656,
        701,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        698,
        701,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        701,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        701,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        701,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        495,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [495, 588, [[0, 3]]],
      [
        663,
        665,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        665,
        667,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        665,
        668,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        665,
        670,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [594, 665, [[0, 3]]],
      [659, 665, [[0, 3]]],
      [665, 707, [[0, 79]]],
      [508, 663, [[0, 3]]],
      [517, 663, [[0, 3]]],
      [
        646,
        663,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [659, 663, [[0, 3]]],
      [663, 700, [[0, 3]]],
      [663, 723, [[0, 3]]],
      [663, 724, [[0, 3]]],
      [508, 700, [[0, 3]]],
      [
        661,
        667,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        667,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [508, 667, [[0, 3]]],
      [517, 667, [[0, 3]]],
      [
        646,
        667,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [667, 700, [[0, 3]]],
      [
        121,
        668,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [508, 668, [[0, 3]]],
      [
        646,
        668,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [668, 700, [[0, 3]]],
      [
        121,
        670,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [508, 670, [[0, 3]]],
      [517, 670, [[0, 3]]],
      [
        646,
        670,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        670,
        698,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        670,
        706,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        670,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        121,
        706,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [508, 706, [[0, 3]]],
      [
        695,
        706,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [508, 695, [[0, 3]]],
      [
        646,
        695,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        121,
        707,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        123,
        707,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [214, 707, [[0, 3]]],
      [508, 707, [[0, 3]]],
      [512, 707, [[0, 3]]],
      [517, 707, [[0, 3]]],
      [588, 707, [[0, 3]]],
      [592, 707, [[0, 3]]],
      [594, 707, [[0, 3]]],
      [
        595,
        707,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        596,
        707,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        646,
        707,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        650,
        707,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        656,
        707,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        696,
        707,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        698,
        707,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        699,
        707,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        707,
        708,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        707,
        717,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        707,
        718,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        707,
        721,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [707, 723, [[0, 3]]],
      [707, 724, [[0, 3]]],
      [
        707,
        726,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        707,
        728,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        707,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        707,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        707,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [214, 512, [[0, 3]]],
      [508, 726, [[0, 3]]],
      [517, 726, [[0, 3]]],
      [
        646,
        726,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [517, 728, [[0, 3]]],
      [588, 728, [[0, 3]]],
      [594, 728, [[0, 3]]],
      [
        728,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        662,
        666,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        663,
        666,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        666,
        667,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        666,
        668,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [594, 666, [[0, 3]]],
      [666, 707, [[0, 79]]],
      [
        121,
        662,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [508, 662, [[0, 3]]],
      [517, 662, [[0, 3]]],
      [
        646,
        662,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        662,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        120,
        124,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        114,
        124,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        124,
        503,
        [
          [0, 75],
          [77, 79]
        ]
      ],
      [
        124,
        507,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [
        124,
        646,
        [
          [0, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        124,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        193,
        501,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [501, 557, [[0, 3]]],
      [
        501,
        959,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        172,
        959,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [355, 959, [[0, 3]]],
      [366, 959, [[0, 3]]],
      [
        577,
        959,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [931, 959, [[0, 3]]],
      [
        938,
        959,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [951, 959, [[0, 3]]],
      [959, 975, [[0, 3]]],
      [172, 353, [[0, 3]]],
      [172, 355, [[0, 3]]],
      [172, 391, [[0, 3]]],
      [
        172,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        564,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        564,
        899,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        568,
        570,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        568,
        569,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        10,
        569,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        569,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        8,
        10,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        8,
        864,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        571,
        646,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        571,
        671,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        205,
        572,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        572,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        31,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        32,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        36,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        116,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        193,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        205,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        561,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        565,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        566,
        573,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        580,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        583,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        694,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        720,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        573,
        993,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        31,
        913,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        31,
        947,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        913,
        927,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        913,
        947,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        913,
        960,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        32,
        35,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        32,
        121,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        32,
        492,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [32, 588, [[0, 3]]],
      [
        32,
        921,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        123,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        127,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [35, 588, [[0, 3]]],
      [
        35,
        646,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        696,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        699,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        900,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        492,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        127,
        492,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        492,
        506,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        492,
        507,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [492, 508, [[0, 3]]],
      [492, 588, [[0, 3]]],
      [492, 601, [[0, 3]]],
      [
        492,
        698,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        492,
        900,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        492,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        506,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        39,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        40,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        191,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        526,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        527,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        34,
        921,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        39,
        921,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        40,
        527,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        526,
        527,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        527,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        527,
        864,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        527,
        894,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        527,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        526,
        577,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        526,
        921,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        37,
        191,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        38,
        191,
        [
          [0, 74],
          [77, 79]
        ]
      ],
      [
        191,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        38,
        526,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        36,
        116,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        36,
        482,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        36,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        114,
        482,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        481,
        482,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        561,
        563,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        560,
        561,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        559,
        563,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        559,
        864,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        560,
        562,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        559,
        562,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        565,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        565,
        927,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        10,
        566,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        566,
        577,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        580,
        582,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        579,
        580,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        578,
        582,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        582,
        583,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [582, 592, [[0, 3]]],
      [
        578,
        864,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        578,
        583,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [583, 592, [[0, 3]]],
      [
        579,
        581,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        578,
        581,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        581,
        583,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [581, 592, [[0, 3]]],
      [
        685,
        694,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        688,
        694,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        690,
        694,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        692,
        694,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        685,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        507,
        685,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 685, [[0, 3]]],
      [
        685,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        698,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        704,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        705,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        706,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        716,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        685,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        120,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        193,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 697, [[0, 3]]],
      [
        646,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        697,
        704,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        697,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        704,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 704, [[0, 3]]],
      [
        704,
        709,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        709,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        705,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        123,
        705,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [588, 705, [[0, 3]]],
      [
        595,
        705,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        705,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        688,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        688,
        720,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        688,
        938,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        193,
        720,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        645,
        720,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        720,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        645,
        864,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        32,
        690,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        35,
        690,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        496,
        690,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        690,
        691,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        690,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        690,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        496,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        496,
        504,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        496,
        727,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        504,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [504, 588, [[0, 3]]],
      [504, 592, [[0, 3]]],
      [504, 601, [[0, 3]]],
      [
        504,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        504,
        921,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        691,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        125,
        691,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        120,
        125,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        125,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        125,
        646,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        695,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        664,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        492,
        664,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        496,
        664,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        501,
        664,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        507,
        664,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 664, [[0, 3]]],
      [518, 664, [[0, 3]]],
      [
        664,
        697,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        698,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        705,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        706,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        708,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        713,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        714,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        664,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 518, [[0, 3]]],
      [
        121,
        713,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        123,
        713,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 713, [[0, 3]]],
      [
        695,
        713,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        698,
        713,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        713,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        713,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        714,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 714, [[0, 3]]],
      [
        687,
        692,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        692,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        692,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [508, 687, [[0, 3]]],
      [
        686,
        687,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        687,
        689,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        687,
        693,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        687,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        686,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        689,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [689, 725, [[0, 3]]],
      [
        693,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        693,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        693,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        116,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        121,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        193,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        507,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        646,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        698,
        703,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        703,
        704,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        703,
        709,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        703,
        717,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        703,
        721,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        703,
        901,
        [
          [0, 16],
          [78, 79]
        ]
      ],
      [
        864,
        948,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        948,
        968,
        [
          [0, 68],
          [71, 74],
          [77, 79]
        ]
      ],
      [
        948,
        992,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [
        948,
        993,
        [
          [0, 68],
          [71, 74],
          [77, 79]
        ]
      ],
      [
        864,
        992,
        [
          [0, 68],
          [71, 79]
        ]
      ],
      [608, 644, [[0, 3]]],
      [
        750,
        751,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [
        750,
        773,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [
        613,
        750,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [
        730,
        750,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [749, 750, [[0, 3]]],
      [
        772,
        773,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [773, 774, [[0, 3]]],
      [355, 773, [[0, 3]]],
      [772, 774, [[0, 3]]],
      [355, 772, [[0, 3]]],
      [749, 772, [[0, 3]]],
      [
        772,
        926,
        [
          [0, 20],
          [78, 79]
        ]
      ],
      [772, 931, [[0, 3]]],
      [355, 774, [[0, 3]]],
      [488, 774, [[0, 3]]],
      [488, 592, [[0, 3]]],
      [749, 985, [[0, 3]]],
      [389, 609, [[0, 3]]],
      [
        883,
        891,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [885, 891, [[0, 79]]],
      [886, 891, [[0, 79]]],
      [887, 891, [[0, 79]]],
      [888, 891, [[0, 79]]],
      [
        884,
        891,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [891, 894, [[0, 79]]],
      [
        883,
        885,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [885, 894, [[0, 79]]],
      [885, 887, [[0, 79]]],
      [
        865,
        885,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        883,
        887,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [887, 894, [[0, 79]]],
      [
        883,
        886,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [886, 894, [[0, 79]]],
      [885, 886, [[0, 79]]],
      [
        883,
        888,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [888, 894, [[0, 79]]],
      [885, 888, [[0, 79]]],
      [887, 888, [[0, 79]]],
      [
        883,
        884,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [
        884,
        889,
        [
          [0, 23],
          [78, 79]
        ]
      ],
      [
        116,
        126,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        126,
        174,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        126,
        193,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [126, 480, [[0, 3]]],
      [126, 592, [[0, 3]]],
      [
        126,
        914,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        126,
        919,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        174,
        613,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        174,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        174,
        865,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        174,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [174, 975, [[0, 3]]],
      [198, 355, [[0, 3]]],
      [198, 644, [[0, 3]]],
      [
        198,
        730,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        198,
        958,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        198,
        978,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        198,
        997,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        730,
        997,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        121,
        498,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [498, 594, [[0, 3]]],
      [
        498,
        901,
        [
          [0, 70],
          [77, 79]
        ]
      ],
      [355, 530, [[0, 3]]],
      [
        530,
        531,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        530,
        532,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [530, 533, [[0, 3]]],
      [
        530,
        606,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        530,
        612,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        530,
        925,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        530,
        958,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [355, 538, [[0, 3]]],
      [
        466,
        538,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        537,
        538,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        538,
        539,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [538, 541, [[0, 3]]],
      [538, 592, [[0, 3]]],
      [
        538,
        606,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        538,
        612,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [538, 644, [[0, 3]]],
      [
        538,
        864,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        538,
        925,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        538,
        935,
        [
          [0, 68],
          [71, 72],
          [77, 79]
        ]
      ],
      [
        538,
        958,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [
        538,
        960,
        [
          [0, 12],
          [72, 72]
        ]
      ],
      [538, 975, [[0, 3]]],
      [
        535,
        537,
        [
          [0, 72],
          [77, 79]
        ]
      ],
      [355, 543, [[0, 3]]],
      [542, 543, [[0, 3]]],
      [
        543,
        544,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [
        543,
        546,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        543,
        925,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [543, 960, [[0, 12]]],
      [543, 975, [[0, 3]]],
      [
        545,
        546,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [193, 546, [[0, 3]]],
      [
        546,
        577,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        546,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        545,
        864,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [588, 589, [[0, 3]]],
      [589, 590, [[0, 3]]],
      [355, 589, [[0, 3]]],
      [
        589,
        868,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [594, 600, [[0, 3]]],
      [600, 960, [[0, 12]]],
      [594, 602, [[0, 3]]],
      [314, 607, [[0, 3]]],
      [391, 607, [[0, 3]]],
      [607, 644, [[0, 3]]],
      [
        607,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [389, 643, [[0, 3]]],
      [643, 644, [[0, 3]]],
      [643, 977, [[0, 3]]],
      [353, 977, [[0, 3]]],
      [355, 977, [[0, 3]]],
      [315, 977, [[0, 3]]],
      [358, 977, [[0, 3]]],
      [359, 977, [[0, 3]]],
      [363, 977, [[0, 3]]],
      [389, 977, [[0, 3]]],
      [308, 729, [[0, 3]]],
      [355, 731, [[0, 3]]],
      [
        730,
        731,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [353, 788, [[0, 3]]],
      [309, 788, [[0, 3]]],
      [355, 788, [[0, 3]]],
      [357, 788, [[0, 3]]],
      [375, 788, [[0, 3]]],
      [378, 788, [[0, 3]]],
      [746, 788, [[0, 3]]],
      [309, 746, [[0, 3]]],
      [357, 746, [[0, 3]]],
      [
        905,
        911,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [355, 911, [[0, 3]]],
      [381, 911, [[0, 3]]],
      [644, 911, [[0, 3]]],
      [
        911,
        938,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        465,
        973,
        [
          [0, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        974,
        978,
        [
          [0, 71],
          [77, 79]
        ]
      ],
      [355, 974, [[0, 3]]],
      [644, 974, [[0, 3]]],
      [644, 980, [[0, 3]]],
      [480, 991, [[0, 3]]],
      [1001, 1003, [[3, 3]]],
      [389, 1001, [[3, 3]]],
      [
        531,
        864,
        [
          [10, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        531,
        918,
        [
          [10, 71],
          [77, 79]
        ]
      ],
      [
        531,
        970,
        [
          [10, 68],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        491,
        901,
        [
          [14, 70],
          [77, 79]
        ]
      ],
      [
        45,
        500,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        121,
        500,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        500,
        513,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        500,
        716,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        513,
        646,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        45,
        491,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        121,
        491,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        491,
        494,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        491,
        509,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        491,
        514,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        494,
        500,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        494,
        502,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        121,
        502,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        502,
        509,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        502,
        646,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        502,
        718,
        [
          [14, 75],
          [77, 79]
        ]
      ],
      [
        509,
        646,
        [
          [14, 69],
          [71, 71],
          [77, 79]
        ]
      ],
      [
        1008,
        1012,
        [
          [29, 65],
          [68, 68],
          [77, 77]
        ]
      ],
      [
        465,
        1012,
        [
          [29, 65],
          [68, 68],
          [77, 77]
        ]
      ],
      [
        1012,
        1013,
        [
          [29, 65],
          [68, 68],
          [77, 77]
        ]
      ],
      [420, 433, [[30, 77]]],
      [391, 420, [[30, 77]]],
      [402, 420, [[30, 77]]],
      [
        842,
        897,
        [
          [30, 66],
          [68, 70],
          [77, 77]
        ]
      ],
      [
        263,
        284,
        [
          [30, 65],
          [68, 70],
          [77, 77]
        ]
      ],
      [
        263,
        903,
        [
          [30, 65],
          [68, 70],
          [77, 77]
        ]
      ],
      [
        286,
        978,
        [
          [37, 65],
          [68, 70],
          [77, 77]
        ]
      ],
      [355, 385, [[43, 77]]],
      [355, 387, [[43, 77]]],
      [355, 390, [[43, 77]]],
      [321, 387, [[43, 77]]],
      [321, 390, [[43, 77]]],
      [319, 387, [[43, 77]]],
      [319, 390, [[43, 77]]],
      [325, 387, [[43, 77]]],
      [322, 387, [[43, 77]]],
      [322, 390, [[43, 77]]],
      [323, 387, [[43, 77]]],
      [323, 390, [[43, 77]]],
      [314, 385, [[43, 77]]],
      [314, 388, [[43, 77]]],
      [314, 390, [[43, 77]]],
      [338, 390, [[43, 77]]],
      [315, 390, [[43, 77]]],
      [374, 390, [[43, 77]]],
      [390, 391, [[43, 77]]],
      [315, 387, [[43, 77]]],
      [309, 387, [[43, 77]]],
      [309, 390, [[43, 77]]],
      [389, 390, [[43, 77]]],
      [313, 385, [[43, 77]]],
      [317, 390, [[43, 77]]],
      [312, 385, [[43, 77]]],
      [312, 388, [[43, 77]]],
      [312, 390, [[43, 77]]],
      [318, 387, [[43, 77]]],
      [318, 390, [[43, 77]]],
      [314, 387, [[43, 77]]],
      [375, 387, [[43, 77]]],
      [378, 387, [[43, 77]]],
      [375, 390, [[43, 77]]],
      [369, 390, [[43, 77]]],
      [377, 390, [[43, 77]]],
      [378, 390, [[43, 77]]],
      [370, 390, [[43, 77]]],
      [373, 386, [[43, 77]]],
      [373, 390, [[43, 77]]],
      [384, 390, [[43, 77]]],
      [379, 390, [[43, 77]]],
      [382, 390, [[43, 77]]],
      [376, 390, [[43, 77]]],
      [363, 390, [[43, 77]]],
      [227, 390, [[43, 77]]],
      [358, 390, [[43, 77]]],
      [360, 390, [[43, 77]]],
      [359, 390, [[43, 77]]],
      [385, 410, [[43, 77]]],
      [306, 385, [[43, 77]]],
      [385, 390, [[43, 77]]],
      [390, 966, [[43, 77]]],
      [390, 738, [[43, 77]]],
      [364, 390, [[43, 77]]],
      [337, 385, [[43, 77]]],
      [347, 390, [[43, 77]]],
      [385, 388, [[43, 77]]],
      [388, 391, [[43, 77]]],
      [365, 390, [[43, 77]]],
      [383, 390, [[43, 77]]],
      [218, 390, [[43, 77]]],
      [219, 390, [[43, 77]]],
      [362, 390, [[43, 77]]],
      [324, 387, [[43, 77]]],
      [324, 390, [[43, 77]]],
      [327, 387, [[43, 77]]],
      [327, 390, [[43, 77]]],
      [328, 387, [[43, 77]]],
      [328, 390, [[43, 77]]],
      [329, 387, [[43, 77]]],
      [329, 390, [[43, 77]]],
      [331, 387, [[43, 77]]],
      [331, 390, [[43, 77]]],
      [
        701,
        708,
        [
          [52, 75],
          [77, 77]
        ]
      ],
      [
        190,
        198,
        [
          [54, 67],
          [69, 70],
          [77, 77]
        ]
      ],
      [
        190,
        730,
        [
          [54, 67],
          [69, 70],
          [77, 77]
        ]
      ],
      [
        190,
        997,
        [
          [54, 67],
          [69, 70],
          [77, 77]
        ]
      ],
      [235, 835, [[67, 67]]],
      [235, 577, [[67, 67]]],
      [235, 831, [[67, 67]]],
      [235, 841, [[67, 67]]],
      [835, 896, [[71, 72]]],
      [577, 896, [[71, 72]]],
      [831, 896, [[71, 72]]],
      [120, 901, [[71, 72]]],
      [120, 656, [[71, 76]]],
      [841, 896, [[71, 72]]],
      [115, 498, [[71, 71]]],
      [122, 498, [[71, 71]]],
      [24, 115, [[71, 71]]],
      [27, 115, [[71, 74]]],
      [29, 115, [[71, 74]]],
      [114, 115, [[71, 74]]],
      [120, 503, [[71, 71]]],
      [122, 503, [[71, 75]]],
      [25, 122, [[71, 71]]],
      [45, 122, [[71, 75]]],
      [28, 122, [[71, 75]]],
      [120, 122, [[71, 71]]],
      [121, 122, [[71, 75]]],
      [122, 491, [[71, 75]]],
      [122, 507, [[71, 76]]],
      [122, 509, [[71, 75]]],
      [122, 556, [[71, 71]]],
      [122, 669, [[71, 75]]],
      [122, 698, [[71, 75]]],
      [122, 701, [[71, 75]]],
      [122, 721, [[71, 71]]],
      [507, 712, [[71, 76]]],
      [120, 665, [[71, 71]]],
      [120, 707, [[71, 71]]],
      [122, 707, [[71, 76]]],
      [120, 666, [[71, 71]]],
      [646, 712, [[71, 71]]],
      [672, 712, [[71, 71]]],
      [673, 712, [[71, 71]]],
      [674, 712, [[71, 71]]],
      [675, 712, [[71, 71]]],
      [677, 712, [[71, 75]]],
      [678, 712, [[71, 76]]],
      [679, 712, [[71, 75]]],
      [680, 712, [[71, 71]]],
      [681, 712, [[71, 75]]],
      [682, 712, [[71, 75]]],
      [683, 712, [[71, 71]]],
      [684, 712, [[71, 71]]],
      [120, 701, [[71, 71]]],
      [26, 866, [[72, 76]]],
      [941, 960, [[72, 72]]],
      [866, 903, [[72, 72]]],
      [866, 867, [[72, 76]]],
      [867, 960, [[72, 76]]],
      [613, 960, [[72, 72]]],
      [864, 960, [[72, 76]]],
      [883, 960, [[72, 76]]],
      [891, 960, [[72, 76]]],
      [613, 866, [[72, 72]]],
      [615, 866, [[72, 72]]],
      [866, 868, [[72, 72]]],
      [868, 869, [[72, 76]]],
      [553, 869, [[72, 72]]],
      [866, 869, [[72, 72]]],
      [869, 939, [[72, 76]]],
      [866, 939, [[72, 72]]],
      [894, 960, [[72, 74]]],
      [866, 978, [[72, 72]]],
      [866, 905, [[72, 72]]],
      [869, 905, [[72, 76]]],
      [604, 866, [[72, 72]]],
      [532, 866, [[72, 72]]],
      [540, 866, [[72, 72]]],
      [544, 866, [[72, 72]]],
      [866, 915, [[72, 72]]],
      [915, 960, [[72, 72]]],
      [866, 925, [[72, 72]]],
      [146, 866, [[72, 72]]],
      [866, 945, [[72, 72]]],
      [945, 960, [[72, 72]]],
      [866, 899, [[72, 72]]],
      [839, 866, [[72, 72]]],
      [866, 890, [[72, 72]]],
      [233, 866, [[72, 72]]],
      [233, 960, [[72, 72]]],
      [857, 866, [[72, 72]]],
      [856, 866, [[72, 72]]],
      [866, 926, [[72, 72]]],
      [173, 866, [[72, 72]]],
      [845, 866, [[72, 72]]],
      [849, 866, [[72, 72]]],
      [843, 866, [[72, 72]]],
      [866, 954, [[72, 72]]],
      [866, 883, [[72, 72]]],
      [892, 960, [[72, 74]]],
      [599, 866, [[72, 72]]],
      [885, 960, [[72, 74]]],
      [901, 902, [[73, 76]]],
      [553, 612, [[73, 76]]],
      [614, 961, [[73, 76]]],
      [902, 961, [[73, 76]]],
      [612, 614, [[73, 76]]],
      [120, 902, [[73, 76]]],
      [646, 902, [[73, 76]]],
      [885, 892, [[75, 76]]],
      [128, 495, [[76, 76]]],
      [122, 128, [[76, 76]]],
      [128, 507, [[76, 76]]]
    ]
  }
}
