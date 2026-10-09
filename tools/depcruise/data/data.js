window.GORDIAN = {
  timeline: {
    repo: 'Comfy-Org/ComfyUI_frontend',
    issue: 'FE-3037',
    tool: 'dependency-cruiser, repo .dependency-cruiser.json, `depcruise src`',
    base: '7475c964f67419ead544bcdab2b98bc0da14e607',
    head: '70c0a86139dfa96b51eadeafed43f60c49e7096d',
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
        bornAt: 81,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 16,
        parent: 0,
        bornAt: 81,
        peak: 5,
        role: 'other',
        fromMain: true,
        label: 'types'
      },
      {
        id: 17,
        parent: 0,
        bornAt: 84,
        peak: 48,
        role: 'other',
        fromMain: true,
        label: 'platform'
      },
      {
        id: 18,
        parent: 0,
        bornAt: 85,
        peak: 49,
        role: 'other',
        fromMain: true,
        label: 'stores'
      },
      {
        id: 19,
        parent: 17,
        bornAt: 88,
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
      }
    ],
    openPrs: {
      label: 'refactor-gordian-knot',
      fetchedAt: '2026-10-09T14:40:11.391Z',
      main: '70c0a86139dfa96b51eadeafed43f60c49e7096d',
      states: [
        {
          index: 79,
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
          index: 80,
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
          index: 81,
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
          index: 82,
          kind: 'pr',
          parent: 81,
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
          index: 83,
          kind: 'pr',
          parent: 79,
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
          index: 84,
          kind: 'pr',
          parent: 83,
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
          index: 85,
          kind: 'pr',
          parent: 84,
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
          index: 86,
          kind: 'pr',
          parent: 85,
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
          index: 87,
          kind: 'pr',
          parent: 86,
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
          index: 88,
          kind: 'pr',
          parent: 87,
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
          index: 89,
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
          index: 90,
          kind: 'pr',
          parent: 89,
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
          index: 91,
          kind: 'pr',
          parent: 90,
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
          behindMain: 7,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 79,
          baseState: 71
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
          head: 'dd32a979ac2ff2e894972ee88cff4267bfceeed9',
          mergeBase: '18a9c4210382fab896a7e00c7db5b141cefadef6',
          behindMain: 7,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 80,
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
          behindMain: 7,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 81,
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
          behindMain: 7,
          parentPr: 19118,
          containsParentHead: true,
          depth: 1,
          state: 82,
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
          behindMain: 7,
          parentPr: 19093,
          containsParentHead: true,
          depth: 1,
          state: 83,
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
          behindMain: 7,
          parentPr: 19131,
          containsParentHead: true,
          depth: 2,
          state: 84,
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
          behindMain: 7,
          parentPr: 19189,
          containsParentHead: true,
          depth: 6,
          state: 88,
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
          behindMain: 7,
          parentPr: 19143,
          containsParentHead: true,
          depth: 3,
          state: 85,
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
          behindMain: 7,
          parentPr: 19153,
          containsParentHead: true,
          depth: 4,
          state: 86,
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
          behindMain: 7,
          parentPr: 19186,
          containsParentHead: true,
          depth: 5,
          state: 87,
          baseState: 71
        },
        {
          number: 19768,
          title: 'tool: add domain architecture census and ratchet',
          url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19768',
          author: 'christian-byrne',
          isDraft: false,
          mergeable: 'MERGEABLE',
          reviewDecision: 'CHANGES_REQUESTED',
          additions: 2732,
          deletions: 5,
          changedFiles: 18,
          baseRefName: 'main',
          headRefName: 'feat/ddd-architecture-ratchet',
          head: 'b1060fb11d6ad5d8123e65c8f023932408172aa2',
          mergeBase: 'e3e1b1513fe0663cffaf0d60b964ef4ece93bd1e',
          behindMain: 6,
          parentPr: null,
          containsParentHead: true,
          depth: 0,
          state: 89,
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
          behindMain: 6,
          parentPr: 19768,
          containsParentHead: true,
          depth: 1,
          state: 90,
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
          behindMain: 6,
          parentPr: 19855,
          containsParentHead: true,
          depth: 2,
          state: 91,
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
    aspect: 0.8932,
    nodes: [
      {
        path: 'base/common/downloadUtil.ts',
        x: 0.518,
        y: 0.4609,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue',
        x: 0.2551,
        y: 0.5818,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ShortcutsList.vue',
        x: 0.2357,
        y: 0.5713,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue',
        x: 0.2543,
        y: 0.594,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/bottomPanel/tabs/terminal/LogsTerminal.vue',
        x: 0.3172,
        y: 0.784,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'components/boundingBoxes/WidgetBoundingBoxes.vue',
        x: 0.878,
        y: 0.7063,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/builder/useEmptyWorkflowDialog.ts',
        x: 0.4756,
        y: 0.4711,
        states: [
          [0, 0],
          [25, -1]
        ]
      },
      {
        path: 'components/cameraAngle/CameraAngle.vue',
        x: 0.7506,
        y: 0.5407,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/cameraInfo/CameraInfo.vue',
        x: 0.8324,
        y: 0.5764,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/common/BackgroundImageUpload.vue',
        x: 0.3459,
        y: 0.7553,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/common/CustomizationDialog.vue',
        x: 0.5225,
        y: 0.8553,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/FormItem.vue',
        x: 0.2589,
        y: 0.7955,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorer.vue',
        x: 0.4453,
        y: 0.7226,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerTreeNode.vue',
        x: 0.4508,
        y: 0.7452,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2.vue',
        x: 0.5437,
        y: 0.724,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/TreeExplorerV2Node.vue',
        x: 0.5697,
        y: 0.7257,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/common/WaveAudioPlayer.vue',
        x: 0.3908,
        y: 1,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/curve/WidgetCurve.vue',
        x: 0.7947,
        y: 0.6714,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/custom/widget/TemplateFilterControls.vue',
        x: 0.2237,
        y: 0.6782,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetail.vue',
        x: 0.1494,
        y: 0.7835,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDetailGroup.vue',
        x: 0.0496,
        y: 0.8773,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadFailure.vue',
        x: 0.0872,
        y: 0.9565,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateDownloadStatus.vue',
        x: 0.0826,
        y: 0.9159,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateModelStatus.vue',
        x: 0.0266,
        y: 0.9207,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/custom/widget/WorkflowTemplateSelectorDialog.vue',
        x: 0.3233,
        y: 0.6311,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/dialog/content/ApiNodesSignInContent.vue',
        x: 0.445,
        y: 0.4987,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/ConfirmationDialogContent.vue',
        x: 0.374,
        y: 0.4928,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/ErrorDialogContent.vue',
        x: 0.4412,
        y: 0.5581,
        states: [[0, 0]]
      },
      {
        path: 'components/dialog/content/SignInContent.vue',
        x: 0.3183,
        y: 0.3463,
        states: [
          [0, 0],
          [84, 17],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/TopUpCreditsDialogContentLegacy.vue',
        x: 0.3272,
        y: 0.4109,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/UpdatePasswordContent.vue',
        x: 0.3266,
        y: 0.3026,
        states: [
          [0, 0],
          [84, 17],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/error/FindIssueButton.vue',
        x: 0.3197,
        y: 0.5362,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/AboutPanel.vue',
        x: 0.2865,
        y: 0.6633,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/CreditsPanel.vue',
        x: 0.264,
        y: 0.4686,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/CurrentUserMessage.vue',
        x: 0.1908,
        y: 0.679,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/KeybindingPanel.vue',
        x: 0.3872,
        y: 0.4284,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/UsageLogsTable.vue',
        x: 0.2508,
        y: 0.4127,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/UserPanel.vue',
        x: 0.2633,
        y: 0.4925,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingContent.vue',
        x: 0.2199,
        y: 0.1019,
        states: [
          [0, 0],
          [17, 11],
          [87, -1],
          [89, 11]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/EditKeybindingFooter.vue',
        x: 0.3759,
        y: 0.234,
        states: [
          [0, 0],
          [17, 11],
          [87, -1],
          [89, 11]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingCommandRows.vue',
        x: 0.3512,
        y: 0.381,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/setting/keybinding/KeybindingPresetToolbar.vue',
        x: 0.3892,
        y: 0.3135,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'components/dialog/content/signin/ApiKeyForm.vue',
        x: 0.3099,
        y: 0.3421,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignInForm.vue',
        x: 0.297,
        y: 0.2873,
        states: [
          [0, 0],
          [84, 17],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/SignUpForm.vue',
        x: 0.2256,
        y: 0.2646,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/dialog/content/signin/TurnstileWidget.vue',
        x: 0.1149,
        y: 0.1648,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
        x: 0.2828,
        y: 0.3915,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/gradientslider/GradientSlider.vue',
        x: 0.9577,
        y: 0.4162,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/gradientslider/gradients.ts',
        x: 0.965,
        y: 0.3344,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/graph/widgets/MultiSelectWidget.vue',
        x: 0.7759,
        y: 0.6798,
        states: [
          [0, 0],
          [28, -1]
        ]
      },
      {
        path: 'components/graph/widgets/TextPreviewWidget.vue',
        x: 0.641,
        y: 0.6684,
        states: [
          [0, 0],
          [80, -1],
          [81, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'components/imagecrop/WidgetImageCrop.vue',
        x: 0.8899,
        y: 0.6666,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/load3d/Load3D.vue',
        x: 0.7311,
        y: 0.5816,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3DAdvanced.vue',
        x: 0.8179,
        y: 0.6143,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3DMenuBar.vue',
        x: 0.8021,
        y: 0.625,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/Load3dViewerContent.vue',
        x: 0.6612,
        y: 0.6679,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/controls/ViewerControls.vue',
        x: 0.7922,
        y: 0.6304,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/controls/viewer/ViewerLightControls.vue',
        x: 0.5941,
        y: 0.7272,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/load3d/menubar/LightMenuGroup.vue',
        x: 0.6813,
        y: 0.6874,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/ImageLayerSettingsPanel.vue',
        x: 0.9178,
        y: 0.9141,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/MaskEditorContent.vue',
        x: 0.8342,
        y: 0.7114,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/PointerZone.vue',
        x: 0.9125,
        y: 0.8399,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/SidePanel.vue',
        x: 0.9016,
        y: 0.8591,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/ToolPanel.vue',
        x: 0.9044,
        y: 0.8451,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/maskeditor/dialog/TopBarHeader.vue',
        x: 0.8009,
        y: 0.7133,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'components/node/NodeHelpContent.vue',
        x: 0.5991,
        y: 0.8296,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreview.vue',
        x: 0.6136,
        y: 0.66,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePreviewCard.vue',
        x: 0.6663,
        y: 0.7463,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodePricingBadge.vue',
        x: 0.6584,
        y: 0.8273,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/node/NodeProviderBadge.vue',
        x: 0.6486,
        y: 0.8327,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/painter/WidgetPainter.vue',
        x: 0.8379,
        y: 0.7293,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/palette/WidgetColors.vue',
        x: 0.9345,
        y: 0.7237,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/JobHistoryActionsMenu.vue',
        x: 0.4364,
        y: 0.6961,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/dialogs/QueueClearHistoryDialog.vue',
        x: 0.4339,
        y: 0.8729,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobAssetsList.vue',
        x: 0.4236,
        y: 0.8507,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsHoverPopover.vue',
        x: 0.3564,
        y: 0.831,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobDetailsPopover.vue',
        x: 0.4265,
        y: 0.6522,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/JobFilterActions.vue',
        x: 0.4163,
        y: 0.8741,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/buildVirtualJobRows.ts',
        x: 0.3917,
        y: 0.9128,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useJobErrorReporting.ts',
        x: 0.375,
        y: 0.6162,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/queue/job/useQueueEstimates.ts',
        x: 0.4567,
        y: 0.7101,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/RangeEditor.vue',
        x: 0.9055,
        y: 0.5588,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/WidgetRange.vue',
        x: 0.8475,
        y: 0.6033,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/range/rangeUtils.ts',
        x: 0.9581,
        y: 0.5897,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/searchbox/NodeSearchFilter.vue',
        x: 0.539,
        y: 0.785,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AppsSidebarTab.vue',
        x: 0.4129,
        y: 0.5918,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarGridView.vue',
        x: 0.5201,
        y: 0.9726,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarListView.vue',
        x: 0.5147,
        y: 0.8811,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/AssetsSidebarTab.vue',
        x: 0.55,
        y: 0.8175,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/BaseWorkflowsSidebarTab.vue',
        x: 0.4574,
        y: 0.6343,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/JobHistorySidebarTab.vue',
        x: 0.4716,
        y: 0.7386,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/ModelLibrarySidebarTab.vue',
        x: 0.3817,
        y: 0.6936,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTab.vue',
        x: 0.4917,
        y: 0.6591,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/NodeLibrarySidebarTabV2.vue',
        x: 0.4699,
        y: 0.6887,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabCloseButton.vue',
        x: 0.4066,
        y: 0.7872,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/SidebarTabTemplate.vue',
        x: 0.4467,
        y: 0.7674,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/WorkflowsSidebarTab.vue',
        x: 0.3749,
        y: 0.7507,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/DownloadItem.vue',
        x: 0.1421,
        y: 0.7328,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue',
        x: 0.2183,
        y: 0.7398,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/modelLibrary/ModelPreview.vue',
        x: 0.2891,
        y: 0.783,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/AllNodesPanel.vue',
        x: 0.5199,
        y: 0.7765,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodeCard.vue',
        x: 0.5854,
        y: 0.7598,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/EssentialNodesPanel.vue',
        x: 0.5501,
        y: 0.8017,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeBookmarkTreeExplorer.vue',
        x: 0.5266,
        y: 0.6858,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue',
        x: 0.5127,
        y: 0.7969,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/MediaLightbox.vue',
        x: 0.4695,
        y: 0.8687,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultAudio.vue',
        x: 0.433,
        y: 0.932,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultText.vue',
        x: 0.4462,
        y: 0.9245,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/queue/ResultVideo.vue',
        x: 0.4926,
        y: 0.7375,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue',
        x: 0.4719,
        y: 0.6757,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/topbar/CloudBadge.vue',
        x: 0.4579,
        y: 0.3393,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/topbar/TopbarBadge.vue',
        x: 0.5168,
        y: 0.3089,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'components/ui/toast/toastStore.ts',
        x: 0.4321,
        y: 0.4535,
        states: [
          [0, -2],
          [71, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'components/videoEdit/VideoEditPanel.vue',
        x: 0.8947,
        y: 0.6585,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/VideoFilmstripTrim.vue',
        x: 0.9755,
        y: 0.6365,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'components/videoEdit/WidgetVideoEdit.vue',
        x: 0.7777,
        y: 0.6067,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/auth/useAuthActions.ts',
        x: 0.354,
        y: 0.3947,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/auth/useAuthDialogs.ts',
        x: 0.3695,
        y: 0.3513,
        states: [
          [0, -2],
          [83, 0],
          [84, 17],
          [87, -1],
          [89, -2]
        ]
      },
      {
        path: 'composables/auth/useCurrentUser.ts',
        x: 0.3653,
        y: 0.4444,
        states: [[0, 0]]
      },
      {
        path: 'composables/auth/useTurnstile.ts',
        x: 0.2269,
        y: 0.3502,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/billingRail.ts',
        x: 0.1622,
        y: 0.3633,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/topupBalanceRefresh.ts',
        x: 0.2931,
        y: 0.2761,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/types.ts',
        x: 0.2362,
        y: 0.3971,
        states: [[0, 0]]
      },
      {
        path: 'composables/billing/useBillingContext.ts',
        x: 0.2554,
        y: 0.3967,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/useBillingDialogs.ts',
        x: 0.3118,
        y: 0.3935,
        states: [
          [0, -2],
          [83, 0],
          [84, 17],
          [89, -2]
        ]
      },
      {
        path: 'composables/billing/useBillingRouting.ts',
        x: 0.231,
        y: 0.4297,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/useLegacyBilling.ts',
        x: 0.2601,
        y: 0.3484,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/useNextInvoice.ts',
        x: 0.1324,
        y: 0.3648,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'composables/billing/usePartnerNodesRunGate.ts',
        x: 0.4258,
        y: 0.4748,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/usePendingTopup.ts',
        x: 0.2729,
        y: 0.3637,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/billing/useSubscriptionPaywall.ts',
        x: 0.2129,
        y: 0.2891,
        states: [
          [0, -2],
          [88, 17],
          [89, -2]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useCommandSubcategories.ts',
        x: 0.2372,
        y: 0.5842,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useLogsTerminal.ts',
        x: 0.4465,
        y: 0.6858,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useShortcutsTab.ts',
        x: 0.3096,
        y: 0.6062,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/bottomPanelTabs/useTerminalTabs.ts',
        x: 0.3388,
        y: 0.6728,
        states: [
          [0, 0],
          [33, -1]
        ]
      },
      {
        path: 'composables/boundingBoxes/useBoundingBoxes.ts',
        x: 0.7463,
        y: 0.5907,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/canvas/useSelectedLiteGraphItems.ts',
        x: 0.6531,
        y: 0.4374,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/canvas/visibleCanvasViewport.ts',
        x: 0.6419,
        y: 0.4121,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/element/useAbsolutePosition.ts',
        x: 0.621,
        y: 0.437,
        states: [
          [0, 0],
          [28, -1]
        ]
      },
      {
        path: 'composables/element/useCanvasPositionConversion.ts',
        x: 0.6788,
        y: 0.3791,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/graph/contextMenuConverter.ts',
        x: 0.8009,
        y: 0.4699,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useCanvasRefresh.ts',
        x: 0.608,
        y: 0.3812,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useFrameNodes.ts',
        x: 0.6187,
        y: 0.4688,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useGroupMenuOptions.ts',
        x: 0.6152,
        y: 0.4535,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useImageMenuOptions.ts',
        x: 0.5941,
        y: 0.461,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useMoreOptionsMenu.ts',
        x: 0.6822,
        y: 0.5106,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useNodeArrangement.ts',
        x: 0.7063,
        y: 0.3731,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeCustomization.ts',
        x: 0.659,
        y: 0.356,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useNodeErrorFlagSync.ts',
        x: 0.6117,
        y: 0.5259,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/graph/useNodeMenuOptions.ts',
        x: 0.6637,
        y: 0.4118,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectedNodeActions.ts',
        x: 0.5848,
        y: 0.4416,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionMenuOptions.ts',
        x: 0.6506,
        y: 0.4078,
        states: [
          [0, 0],
          [1, 8],
          [87, -1],
          [89, 8]
        ]
      },
      {
        path: 'composables/graph/useSelectionOperations.ts',
        x: 0.5743,
        y: 0.4409,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSelectionState.ts',
        x: 0.6303,
        y: 0.511,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/graph/useSubgraphOperations.ts',
        x: 0.5904,
        y: 0.4735,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/maskeditor/imageWidgetAdapter.ts',
        x: 0.7761,
        y: 0.6204,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushDrawing.ts',
        x: 0.7852,
        y: 0.8632,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useBrushPersistence.ts',
        x: 0.6801,
        y: 0.7182,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useImageLoader.ts',
        x: 0.9036,
        y: 0.7851,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditor.ts',
        x: 0.7797,
        y: 0.596,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorLoader.ts',
        x: 0.6985,
        y: 0.6118,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useMaskEditorSaver.ts',
        x: 0.6834,
        y: 0.605,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/maskeditor/useToolManager.ts',
        x: 0.8135,
        y: 0.7709,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/node/canvasImagePreviewTypes.ts',
        x: 0.8105,
        y: 0.4498,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/startModelNodeDragFromAsset.ts',
        x: 0.3973,
        y: 0.59,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'composables/node/useNodeAnimatedImage.ts',
        x: 0.6663,
        y: 0.4592,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodeCanvasImagePreview.ts',
        x: 0.7667,
        y: 0.4886,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragAndDrop.ts',
        x: 0.61,
        y: 0.6324,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodeDragToCanvas.ts',
        x: 0.5409,
        y: 0.5714,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'composables/node/useNodeFileInput.ts',
        x: 0.66,
        y: 0.5814,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodeImage.ts',
        x: 0.5425,
        y: 0.4515,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodeImageUpload.ts',
        x: 0.5543,
        y: 0.5587,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodePaste.ts',
        x: 0.665,
        y: 0.5745,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'composables/node/useNodePreviewAndDrag.ts',
        x: 0.5538,
        y: 0.695,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/node/useNodePricing.ts',
        x: 0.7256,
        y: 0.5302,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/useNodeProgressText.ts',
        x: 0.6584,
        y: 0.5244,
        states: [
          [0, 0],
          [80, -1],
          [81, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/node/usePartnerNodesInGraph.ts',
        x: 0.535,
        y: 0.5412,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/painter/usePainter.ts',
        x: 0.7088,
        y: 0.6081,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobList.ts',
        x: 0.467,
        y: 0.7437,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useJobMenu.ts',
        x: 0.5144,
        y: 0.62,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueClearHistoryDialog.ts',
        x: 0.4067,
        y: 0.9209,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueFeatureFlags.ts',
        x: 0.4322,
        y: 0.734,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useQueueProgress.ts',
        x: 0.4738,
        y: 0.7588,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/queue/useResultGallery.ts',
        x: 0.4672,
        y: 0.8117,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useAssetsSidebarTab.ts',
        x: 0.4654,
        y: 0.7034,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useJobHistorySidebarTab.ts',
        x: 0.4056,
        y: 0.705,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useModelLibrarySidebarTab.ts',
        x: 0.3294,
        y: 0.6614,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/sidebarTabs/useNodeLibrarySidebarTab.ts',
        x: 0.443,
        y: 0.6592,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/tree/useTreeFolderOperations.ts',
        x: 0.3991,
        y: 0.8458,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useAppMode.ts',
        x: 0.5083,
        y: 0.4784,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'composables/useCameraAngle.ts',
        x: 0.8389,
        y: 0.616,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useCameraInfo.ts',
        x: 0.9293,
        y: 0.5806,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useCopy.ts',
        x: 0.6044,
        y: 0.2944,
        states: [
          [0, -1],
          [54, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/useCopyToClipboard.ts',
        x: 0.3426,
        y: 0.5286,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'composables/useEditKeybindingDialog.ts',
        x: 0.3104,
        y: 0.261,
        states: [
          [0, 0],
          [17, 11],
          [87, -1],
          [89, 11]
        ]
      },
      {
        path: 'composables/useErrorHandling.ts',
        x: 0.3859,
        y: 0.4419,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'composables/useEssentialTileNodeDef.ts',
        x: 0.589,
        y: 0.8374,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useFeatureFlags.ts',
        x: 0.3675,
        y: 0.5439,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'composables/useImageCrop.ts',
        x: 0.8195,
        y: 0.5929,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useLoad3d.ts',
        x: 0.6605,
        y: 0.5993,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'composables/useLoad3dViewer.ts',
        x: 0.6672,
        y: 0.6579,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'composables/useNodeHelpContent.ts',
        x: 0.6017,
        y: 0.8466,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/usePaste.ts',
        x: 0.561,
        y: 0.4351,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/useRangeEditor.ts',
        x: 0.9481,
        y: 0.6195,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useRunButtonTelemetry.ts',
        x: 0.4324,
        y: 0.3821,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'composables/useTemplateFiltering.ts',
        x: 0.3457,
        y: 0.5985,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useTreeExpansion.ts',
        x: 0.4351,
        y: 0.7459,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useUpstreamValue.ts',
        x: 0.805,
        y: 0.5781,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useViewportNodeWiring.ts',
        x: 0.9103,
        y: 0.6088,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/useVueFeatureFlags.ts',
        x: 0.51,
        y: 0.5675,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'composables/useWaveAudioPlayer.ts',
        x: 0.4145,
        y: 0.8388,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/useWorkflowTemplateSelectorDialog.ts',
        x: 0.3637,
        y: 0.5046,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'composables/video/useCropRatioLock.ts',
        x: 0.9722,
        y: 0.6809,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useTimelineScrub.ts',
        x: 0.9972,
        y: 0.7248,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoEditModel.ts',
        x: 0.9171,
        y: 0.6211,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoFilmstrip.ts',
        x: 0.8091,
        y: 0.7498,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'composables/video/useVideoSourceUrl.ts',
        x: 0.6482,
        y: 0.5572,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'config/billingWeb.ts',
        x: 0.2135,
        y: 0.493,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/comfyApi.ts',
        x: 0.2638,
        y: 0.442,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/firebase.ts',
        x: 0.1718,
        y: 0.4051,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'config/turnstile.ts',
        x: 0.1723,
        y: 0.251,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellLifecycle.ts',
        x: 0.7327,
        y: 0.4252,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/nodeShell/nodeShellState.ts',
        x: 0.7996,
        y: 0.3343,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/adoptPromotedWidgetValue.ts',
        x: 0.828,
        y: 0.4348,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/liftNodeErrorsToBoundary.ts',
        x: 0.6501,
        y: 0.5369,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/preview/previewExposureChain.ts',
        x: 0.9571,
        y: 0.3234,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedInputWidget.ts',
        x: 0.7159,
        y: 0.5266,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedWidgetControl.ts',
        x: 0.5036,
        y: 0.536,
        states: [
          [0, -2],
          [79, 0],
          [80, -2],
          [83, 0],
          [84, -1],
          [89, -2]
        ]
      },
      {
        path: 'core/graph/subgraph/promotedWidgetTypes.ts',
        x: 0.6962,
        y: 0.5501,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/promotionUtils.ts',
        x: 0.7008,
        y: 0.4434,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveConcretePromotedWidget.ts',
        x: 0.7082,
        y: 0.5132,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolvePromotedWidgetSource.ts',
        x: 0.7356,
        y: 0.5055,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputLink.ts',
        x: 0.8494,
        y: 0.4239,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/subgraph/resolveSubgraphInputTarget.ts',
        x: 0.7523,
        y: 0.4515,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/graph/transferLinkPresentation.ts',
        x: 0.832,
        y: 0.2844,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/comboWidgetInventory.ts',
        x: 0.7191,
        y: 0.5802,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicGroupWidget.ts',
        x: 0.7528,
        y: 0.5062,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicInputSpec.ts',
        x: 0.6991,
        y: 0.6586,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/dynamicWidgets.ts',
        x: 0.7316,
        y: 0.4697,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'core/graph/widgets/nodeWidgetValues.ts',
        x: 0.7871,
        y: 0.5819,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'core/graph/widgets/valueControlWidgets.ts',
        x: 0.6799,
        y: 0.6291,
        states: [
          [0, -2],
          [79, 0],
          [80, -2],
          [83, 0],
          [85, -1],
          [89, -2]
        ]
      },
      {
        path: 'core/schemas/parseNodePropertyArray.ts',
        x: 0.9548,
        y: 0.3675,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/previewExposureSchema.ts',
        x: 0.9094,
        y: 0.3751,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/promotionSchema.ts',
        x: 0.9643,
        y: 0.3785,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'core/schemas/proxyWidgetQuarantineSchema.ts',
        x: 0.9166,
        y: 0.4179,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'extensions/core/agentPanel.ts',
        x: 0.471,
        y: 0.4179,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraAngle.ts',
        x: 0.7115,
        y: 0.4567,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraAngle/CameraAngleViewport.ts',
        x: 0.9653,
        y: 0.754,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraInfo.ts',
        x: 0.7314,
        y: 0.4838,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cameraInfo/CameraInfoViewport.ts',
        x: 0.9602,
        y: 0.7006,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/clipspace.ts',
        x: 0.5619,
        y: 0.3629,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudBadges.ts',
        x: 0.5035,
        y: 0.3946,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudFeedbackTopbarButton.ts',
        x: 0.5142,
        y: 0.4156,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudRemoteConfig.ts',
        x: 0.4348,
        y: 0.3963,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/cloudSessionCookie.ts',
        x: 0.4893,
        y: 0.374,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/contextMenuFilter.ts',
        x: 0.6951,
        y: 0.3959,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/createBoundingBoxes.ts',
        x: 0.5809,
        y: 0.2868,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/customWidgets.ts',
        x: 0.7502,
        y: 0.4937,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/dynamicPrompts.ts',
        x: 0.675,
        y: 0.356,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/editAttention.ts',
        x: 0.5855,
        y: 0.335,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/electronAdapter.ts',
        x: 0.5081,
        y: 0.4344,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/groupNode.ts',
        x: 0.6795,
        y: 0.4843,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/groupOptions.ts',
        x: 0.6448,
        y: 0.4606,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCompare.ts',
        x: 0.6748,
        y: 0.348,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCompositor.ts',
        x: 0.6892,
        y: 0.4999,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/imageCrop.ts',
        x: 0.6678,
        y: 0.3436,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/index.ts',
        x: 0.6174,
        y: 0.4119,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/layerEditor.ts',
        x: 0.6925,
        y: 0.4255,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/lightInfo.ts',
        x: 0.6097,
        y: 0.3219,
        states: [
          [0, -2],
          [30, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d.ts',
        x: 0.6662,
        y: 0.5433,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/GizmoManager.ts',
        x: 0.8243,
        y: 0.8504,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/HDRIManager.ts',
        x: 0.7165,
        y: 0.7918,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3DConfiguration.ts',
        x: 0.6848,
        y: 0.5618,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3d.ts',
        x: 0.7509,
        y: 0.7111,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Load3dUtils.ts',
        x: 0.6166,
        y: 0.6336,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'extensions/core/load3d/LoaderManager.ts',
        x: 0.7419,
        y: 0.8867,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/MeshModelAdapter.ts',
        x: 0.7408,
        y: 0.986,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/ModelAdapter.ts',
        x: 0.6814,
        y: 0.8323,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/PointCloudModelAdapter.ts',
        x: 0.6594,
        y: 0.7946,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneManager.ts',
        x: 0.8056,
        y: 0.7814,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SceneModelManager.ts',
        x: 0.7459,
        y: 0.859,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/SplatModelAdapter.ts',
        x: 0.752,
        y: 0.9799,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/Viewport3d.ts',
        x: 0.8959,
        y: 0.7498,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/createLoad3d.ts',
        x: 0.7401,
        y: 0.7863,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/createViewport3d.ts',
        x: 0.9507,
        y: 0.8122,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/exportMenuHelper.ts',
        x: 0.7635,
        y: 0.5558,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dSerialize.ts',
        x: 0.7892,
        y: 0.5945,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3d/load3dViewport.ts',
        x: 0.865,
        y: 0.7967,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'extensions/core/load3dAdvanced.ts',
        x: 0.7389,
        y: 0.5249,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3dLazy.ts',
        x: 0.6523,
        y: 0.4708,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/load3dPreviewExtensions.ts',
        x: 0.6866,
        y: 0.5379,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/maskeditor.ts',
        x: 0.7053,
        y: 0.4852,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/nodeTemplates.ts',
        x: 0.5763,
        y: 0.4523,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/noteNode.ts',
        x: 0.6932,
        y: 0.4421,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/painter.ts',
        x: 0.5722,
        y: 0.2913,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/previewAny.ts',
        x: 0.6694,
        y: 0.4258,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/rerouteNode.ts',
        x: 0.7213,
        y: 0.4248,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveImageExtraOutput.ts',
        x: 0.6877,
        y: 0.3989,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveMesh.ts',
        x: 0.6919,
        y: 0.5219,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/saveText.ts',
        x: 0.6202,
        y: 0.3533,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/selectionBorder.ts',
        x: 0.652,
        y: 0.373,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/simpleTouchSupport.ts',
        x: 0.6444,
        y: 0.3728,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/slotDefaultTypes.ts',
        x: 0.7391,
        y: 0.6348,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/slotDefaults.ts',
        x: 0.6993,
        y: 0.47,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/textPreviewWidgets.ts',
        x: 0.6866,
        y: 0.4884,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/uploadAudio.ts',
        x: 0.6375,
        y: 0.5444,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/uploadImage.ts',
        x: 0.6878,
        y: 0.3852,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/webcamCapture.ts',
        x: 0.6344,
        y: 0.5021,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'extensions/core/widgetInputs.ts',
        x: 0.7271,
        y: 0.5105,
        states: [
          [0, 0],
          [66, 14],
          [87, -1],
          [89, 14]
        ]
      },
      {
        path: 'extensions/core/widgetValuePropagation.ts',
        x: 0.7669,
        y: 0.4707,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/CanvasPointer.ts',
        x: 0.8636,
        y: 0.3651,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/ContextMenu.ts',
        x: 0.8679,
        y: 0.3807,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/CurveEditor.ts',
        x: 0.8693,
        y: 0.3538,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/DragAndScale.ts',
        x: 0.7394,
        y: 0.3423,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraph.ts',
        x: 0.7621,
        y: 0.3658,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphBadge.ts',
        x: 0.8661,
        y: 0.3733,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphButton.ts',
        x: 0.8724,
        y: 0.4108,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphCanvas.ts',
        x: 0.7875,
        y: 0.3688,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphGroup.ts',
        x: 0.8068,
        y: 0.355,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LGraphNode.ts',
        x: 0.7878,
        y: 0.445,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LLink.ts',
        x: 0.7886,
        y: 0.3494,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LinkMap.ts',
        x: 0.8491,
        y: 0.2254,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/LiteGraphGlobal.ts',
        x: 0.8209,
        y: 0.3704,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/Reroute.ts',
        x: 0.8069,
        y: 0.3392,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/FloatingRenderLink.ts',
        x: 0.864,
        y: 0.3414,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/InputIndicators.ts',
        x: 0.903,
        y: 0.2576,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/LinkConnector.ts',
        x: 0.8174,
        y: 0.3659,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingInputLink.ts',
        x: 0.8275,
        y: 0.3568,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingLinkBase.ts',
        x: 0.8381,
        y: 0.3267,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/MovingOutputLink.ts',
        x: 0.8227,
        y: 0.3551,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/RenderLink.ts',
        x: 0.8101,
        y: 0.3495,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/SelectedItemsView.ts',
        x: 0.832,
        y: 0.2727,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputFromIoNodeLink.ts',
        x: 0.8138,
        y: 0.3374,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToInputRenderLink.ts',
        x: 0.839,
        y: 0.3595,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromIoNodeLink.ts',
        x: 0.8232,
        y: 0.3235,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputFromRerouteLink.ts',
        x: 0.8067,
        y: 0.3224,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/ToOutputRenderLink.ts',
        x: 0.8327,
        y: 0.3719,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/getCanvasContextMenuTarget.ts',
        x: 0.8197,
        y: 0.2764,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/hitTesting.ts',
        x: 0.8028,
        y: 0.2781,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadgeRenderer.ts',
        x: 0.8221,
        y: 0.2875,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkBadges.ts',
        x: 0.8629,
        y: 0.3141,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkGeometry.ts',
        x: 0.7887,
        y: 0.3186,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/linkVisibility.ts',
        x: 0.8314,
        y: 0.3019,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/measureSlots.ts',
        x: 0.8479,
        y: 0.3944,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/reduceGesture.ts',
        x: 0.932,
        y: 0.2618,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/canvas/resolvePointerTarget.ts',
        x: 0.8321,
        y: 0.3179,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/contextMenuCompat.ts',
        x: 0.7,
        y: 0.3179,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/draw.ts',
        x: 0.8774,
        y: 0.3803,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/extensionPersistence.ts',
        x: 0.8514,
        y: 0.3028,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/graphIntents.ts',
        x: 0.6751,
        y: 0.4337,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/idAllocation.ts',
        x: 0.8233,
        y: 0.3051,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/ConstrainedSize.ts',
        x: 0.9235,
        y: 0.2944,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphCanvasEventMap.ts',
        x: 0.8543,
        y: 0.3703,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LGraphEventMap.ts',
        x: 0.8507,
        y: 0.3572,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/LinkConnectorEventMap.ts',
        x: 0.8606,
        y: 0.3581,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/Rectangle.ts',
        x: 0.8462,
        y: 0.3816,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphEventMap.ts',
        x: 0.8468,
        y: 0.4094,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/infrastructure/SubgraphInputEventMap.ts',
        x: 0.8666,
        y: 0.4305,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/interfaces.ts',
        x: 0.785,
        y: 0.4082,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/linkDeduplication.ts',
        x: 0.6646,
        y: 0.3691,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraph.ts',
        x: 0.7267,
        y: 0.4648,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/litegraphInstance.ts',
        x: 0.898,
        y: 0.3931,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/measure.ts',
        x: 0.7963,
        y: 0.3609,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeInputSlot.ts',
        x: 0.8289,
        y: 0.404,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeOutputSlot.ts',
        x: 0.8334,
        y: 0.392,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/NodeSlot.ts',
        x: 0.8372,
        y: 0.4109,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/SlotBase.ts',
        x: 0.9094,
        y: 0.3321,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotDescriptorView.ts',
        x: 0.8868,
        y: 0.3716,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotLinks.ts',
        x: 0.7755,
        y: 0.4053,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/slotUtils.ts',
        x: 0.803,
        y: 0.3699,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/node/widgetsView.ts',
        x: 0.8249,
        y: 0.4516,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/nodeBadgeDraw.ts',
        x: 0.7654,
        y: 0.3513,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/remintLinkRemap.ts',
        x: 0.7898,
        y: 0.2598,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/strings.ts',
        x: 0.8065,
        y: 0.3609,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphInput.ts',
        x: 0.8587,
        y: 0.3375,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/EmptySubgraphOutput.ts',
        x: 0.8589,
        y: 0.3294,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/ExecutableNodeDTO.ts',
        x: 0.8074,
        y: 0.41,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/Subgraph.ts',
        x: 0.804,
        y: 0.3863,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphIONodeBase.ts',
        x: 0.8181,
        y: 0.349,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInput.ts',
        x: 0.8167,
        y: 0.3928,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphInputNode.ts',
        x: 0.83,
        y: 0.3384,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphNode.ts',
        x: 0.8008,
        y: 0.4351,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutput.ts',
        x: 0.8299,
        y: 0.3634,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphOutputNode.ts',
        x: 0.8221,
        y: 0.3406,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/SubgraphSlotBase.ts',
        x: 0.8445,
        y: 0.3634,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/promotedWidgetStoreProjection.ts',
        x: 0.8552,
        y: 0.4635,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphDeduplication.ts',
        x: 0.7336,
        y: 0.3517,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/subgraphUtils.ts',
        x: 0.7967,
        y: 0.3825,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/subgraph/unpackSubgraph.ts',
        x: 0.8133,
        y: 0.3829,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/NodeLike.ts',
        x: 0.8501,
        y: 0.3376,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/contextMenu.ts',
        x: 0.8591,
        y: 0.3825,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/events.ts',
        x: 0.8232,
        y: 0.3885,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/linkNetwork.ts',
        x: 0.8355,
        y: 0.347,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/panel.ts',
        x: 0.9013,
        y: 0.4057,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/serialisation.ts',
        x: 0.7551,
        y: 0.3936,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/slots.ts',
        x: 0.8245,
        y: 0.3814,
        states: [
          [0, -2],
          [43, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/types/widgets.ts',
        x: 0.8253,
        y: 0.5115,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/arrange.ts',
        x: 0.7924,
        y: 0.3011,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/collections.ts',
        x: 0.8489,
        y: 0.32,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/feedback.ts',
        x: 0.8242,
        y: 0.4226,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/linkColors.ts',
        x: 0.802,
        y: 0.3031,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiff.ts',
        x: 0.7723,
        y: 0.39,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/namedValuesShadowDiffTelemetry.ts',
        x: 0.6302,
        y: 0.378,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/type.ts',
        x: 0.8081,
        y: 0.4167,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/utils/widget.ts',
        x: 0.8428,
        y: 0.496,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/AssetWidget.ts',
        x: 0.9289,
        y: 0.4523,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseSteppedWidget.ts',
        x: 0.9636,
        y: 0.4481,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BaseWidget.ts',
        x: 0.8904,
        y: 0.4641,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BooleanWidget.ts',
        x: 0.9871,
        y: 0.4876,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxWidget.ts',
        x: 0.9776,
        y: 0.4688,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/BoundingBoxesWidget.ts',
        x: 0.972,
        y: 0.5134,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ButtonWidget.ts',
        x: 0.9295,
        y: 0.4432,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ChartWidget.ts',
        x: 0.9841,
        y: 0.549,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorWidget.ts',
        x: 0.9757,
        y: 0.4919,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ColorsWidget.ts',
        x: 0.9885,
        y: 0.4755,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ComboWidget.ts',
        x: 0.8737,
        y: 0.4455,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CompositorWidget.ts',
        x: 0.9823,
        y: 0.5362,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/CurveWidget.ts',
        x: 0.9805,
        y: 0.4796,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/FileUploadWidget.ts',
        x: 0.9882,
        y: 0.5277,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GalleriaWidget.ts',
        x: 0.9912,
        y: 0.5394,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/GradientSliderWidget.ts',
        x: 0.9478,
        y: 0.5129,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCompareWidget.ts',
        x: 0.9975,
        y: 0.5304,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/ImageCropWidget.ts',
        x: 0.9864,
        y: 0.4648,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/KnobWidget.ts',
        x: 0.9474,
        y: 0.5025,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LegacyWidget.ts',
        x: 0.849,
        y: 0.4843,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/LightInfoWidget.ts',
        x: 0.9775,
        y: 0.4486,
        states: [
          [0, -2],
          [30, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MarkdownWidget.ts',
        x: 0.9995,
        y: 0.5131,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/MultiSelectWidget.ts',
        x: 1,
        y: 0.5024,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/NumberWidget.ts',
        x: 0.9491,
        y: 0.4775,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/PainterWidget.ts',
        x: 0.981,
        y: 0.4566,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/RangeWidget.ts',
        x: 0.9697,
        y: 0.4672,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SelectButtonWidget.ts',
        x: 0.9934,
        y: 0.5175,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/SliderWidget.ts',
        x: 0.9473,
        y: 0.4922,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextWidget.ts',
        x: 0.9293,
        y: 0.4628,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TextareaWidget.ts',
        x: 0.9717,
        y: 0.5031,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/TreeSelectWidget.ts',
        x: 0.9708,
        y: 0.4823,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VideoEditWidget.ts',
        x: 0.9831,
        y: 0.4994,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/VueOnlyWidget.ts',
        x: 0.9408,
        y: 0.5235,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'lib/litegraph/src/widgets/widgetMap.ts',
        x: 0.9053,
        y: 0.4821,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/assets/components/AssetBrowserModal.vue',
        x: 0.3644,
        y: 0.696,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/AssetCard.vue',
        x: 0.4152,
        y: 0.7272,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/AssetGrid.vue',
        x: 0.3203,
        y: 0.8011,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/Media3DTop.vue',
        x: 0.4923,
        y: 0.8901,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAssetCard.vue',
        x: 0.4935,
        y: 0.8512,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaAudioTop.vue',
        x: 0.452,
        y: 0.9507,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaImageTop.vue',
        x: 0.4827,
        y: 0.9477,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaTextTop.vue',
        x: 0.4734,
        y: 0.9457,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/MediaVideoTop.vue',
        x: 0.4916,
        y: 0.9433,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelConfirmation.vue',
        x: 0.2504,
        y: 0.8351,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelDialog.vue',
        x: 0.2366,
        y: 0.7825,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelProgress.vue',
        x: 0.2297,
        y: 0.8582,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUpgradeModal.vue',
        x: 0.1719,
        y: 0.5809,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/UploadModelUrlInput.vue',
        x: 0.2426,
        y: 0.6359,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/components/modelInfo/ModelInfoPanel.vue',
        x: 0.3579,
        y: 0.7098,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/media/assetMappers.ts',
        x: 0.4921,
        y: 0.7799,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/composables/openModelLibraryBrowser.ts',
        x: 0.3849,
        y: 0.5324,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowser.ts',
        x: 0.3738,
        y: 0.7127,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetBrowserDialog.ts',
        x: 0.4352,
        y: 0.5622,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetDownload.ts',
        x: 0.4619,
        y: 0.5378,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetGridSelection.ts',
        x: 0.7553,
        y: 0.8327,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetSelection.ts',
        x: 0.552,
        y: 0.98,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetZipExport.ts',
        x: 0.4727,
        y: 0.5859,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useAssetsQuery.ts',
        x: 0.4363,
        y: 0.7652,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/composables/useMediaAssetActions.ts',
        x: 0.5297,
        y: 0.6393,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useModelTypes.ts',
        x: 0.3251,
        y: 0.7501,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useModelUpload.ts',
        x: 0.2648,
        y: 0.7286,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useNodeOutputsExport.ts',
        x: 0.5386,
        y: 0.5239,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useOutputStacks.ts',
        x: 0.5348,
        y: 0.9217,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/composables/useUploadModelWizard.ts',
        x: 0.3513,
        y: 0.7369,
        states: [
          [0, 0],
          [32, -1]
        ]
      },
      {
        path: 'platform/assets/schemas/assetMetadataSchema.ts',
        x: 0.5333,
        y: 0.7983,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/schemas/mediaAssetSchema.ts',
        x: 0.5068,
        y: 0.7697,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/services/assetService.ts',
        x: 0.5132,
        y: 0.6514,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/utils/assetDragUtil.ts',
        x: 0.4863,
        y: 0.848,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/assetPreviewUtil.ts',
        x: 0.5121,
        y: 0.7323,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/assets/utils/assetUrlUtil.ts',
        x: 0.4779,
        y: 0.735,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/assets/utils/clearDeletedAssetWidgetValues.ts',
        x: 0.6614,
        y: 0.6281,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/clearNodePreviewCacheForValues.ts',
        x: 0.6485,
        y: 0.5937,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/createAssetWidget.ts',
        x: 0.614,
        y: 0.5146,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/assets/utils/markDeletedAssetsAsMissingMedia.ts',
        x: 0.6314,
        y: 0.5796,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/marqueeSelectionUtil.ts',
        x: 0.8707,
        y: 0.836,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/mediaIconUtil.ts',
        x: 0.5023,
        y: 0.9583,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetCountUtil.ts',
        x: 0.5404,
        y: 0.8662,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputAssetUtil.ts',
        x: 0.5249,
        y: 0.8114,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/outputExportUtil.ts',
        x: 0.5023,
        y: 0.6407,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/assets/utils/resolveModelNodeFromAsset.ts',
        x: 0.3847,
        y: 0.6644,
        states: [
          [0, 0],
          [53, -1]
        ]
      },
      {
        path: 'platform/auth/firebaseIdentity.ts',
        x: 0.2869,
        y: 0.4659,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/auth/session/cloudWebSessionStore.ts',
        x: 0.3429,
        y: 0.4798,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/session/components/SignOutEverywhereButton.vue',
        x: 0.2266,
        y: 0.4532,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/auth/session/useSessionCookie.ts',
        x: 0.3735,
        y: 0.4725,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/social/useSocialSignIn.ts',
        x: 0.3625,
        y: 0.3153,
        states: [
          [0, 0],
          [84, 17],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/auth/sso/SsoRequiredDialogContent.vue',
        x: 0.3297,
        y: 0.3241,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/sso/ssoRequired.ts',
        x: 0.3526,
        y: 0.4308,
        states: [[0, 0]]
      },
      {
        path: 'platform/auth/unified/remintRetry.ts',
        x: 0.3556,
        y: 0.4718,
        states: [[0, 0]]
      },
      {
        path: 'platform/canvas/minimapDecorationRegistry.ts',
        x: 0.5243,
        y: 0.2421,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/churnkey/churnkeyClient.ts',
        x: 0.3117,
        y: 0.4491,
        states: [
          [0, 0],
          [14, -2]
        ]
      },
      {
        path: 'platform/cloud/notification/components/CloudNotificationContent.vue',
        x: 0.281,
        y: 0.4556,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CancellationFlowDialogContent.vue',
        x: 0.3107,
        y: 0.361,
        states: [
          [0, -2],
          [14, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/CreditsTile.vue',
        x: 0.2623,
        y: 0.3839,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/PricingTable.vue',
        x: 0.2948,
        y: 0.3647,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/RetentionOfferStep.vue',
        x: 0.291,
        y: 0.3074,
        states: [
          [0, -2],
          [14, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscribeButton.vue',
        x: 0.2689,
        y: 0.3178,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionFooterLinks.vue',
        x: 0.1644,
        y: 0.3823,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue',
        x: 0.3366,
        y: 0.3784,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useAccountPreconditionDialog.ts',
        x: 0.403,
        y: 0.4067,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useBillingPlans.ts',
        x: 0.2937,
        y: 0.4012,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useCancellationPlan.ts',
        x: 0.1753,
        y: 0.302,
        states: [
          [0, -2],
          [14, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useFreeTierQuota.ts',
        x: 0.4071,
        y: 0.433,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useRetentionOffer.ts',
        x: 0.2821,
        y: 0.3561,
        states: [
          [0, -2],
          [14, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscription.ts',
        x: 0.2984,
        y: 0.3861,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionActions.ts',
        x: 0.3096,
        y: 0.4184,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCancellationWatcher.ts',
        x: 0.2383,
        y: 0.3111,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionCredits.ts',
        x: 0.1503,
        y: 0.302,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/composables/useSubscriptionDialog.ts',
        x: 0.2688,
        y: 0.3933,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/constants/tierPricing.ts',
        x: 0.2073,
        y: 0.3602,
        states: [
          [0, 0],
          [4, 10],
          [87, -1],
          [89, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/launchCancellationFlow.ts',
        x: 0.3079,
        y: 0.4006,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/billingPlanTelemetry.ts',
        x: 0.1639,
        y: 0.3131,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/checkoutAttributionLoader.ts',
        x: 0.1967,
        y: 0.2103,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/paymentReturnUrl.ts',
        x: 0.1473,
        y: 0.4422,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/planCreditGrant.ts',
        x: 0.0864,
        y: 0.2938,
        states: [
          [0, -2],
          [14, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCancellationTelemetry.ts',
        x: 0.2413,
        y: 0.3311,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutTracker.ts',
        x: 0.2516,
        y: 0.3139,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionCheckoutUtil.ts',
        x: 0.2974,
        y: 0.3505,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/subscriptionTierRank.ts',
        x: 0.2389,
        y: 0.3584,
        states: [
          [0, 0],
          [4, 10],
          [87, -1],
          [89, 10]
        ]
      },
      {
        path: 'platform/cloud/subscription/utils/tierBenefits.ts',
        x: 0.0855,
        y: 0.3149,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/errorCatalog/errorMessageResolver.ts',
        x: 0.3665,
        y: 0.7696,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/executionErrorResolver.ts',
        x: 0.3272,
        y: 0.8389,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/missingErrorResolver.ts',
        x: 0.446,
        y: 0.822,
        states: [[0, 0]]
      },
      {
        path: 'platform/errorCatalog/promptErrorResolver.ts',
        x: 0.3366,
        y: 0.845,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/runtimeErrorCopy.ts',
        x: 0.3241,
        y: 0.8596,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/types.ts',
        x: 0.4282,
        y: 0.6898,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/errorCatalog/validationErrorResolver.ts',
        x: 0.3193,
        y: 0.8287,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/keybindings/keybindingService.ts',
        x: 0.4552,
        y: 0.4148,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/keybindings/presetService.ts',
        x: 0.4461,
        y: 0.4599,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaAssetResolver.ts',
        x: 0.5057,
        y: 0.5941,
        states: [
          [0, 0],
          [10, -2]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaGrouping.ts',
        x: 0.5196,
        y: 0.8267,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaPipeline.ts',
        x: 0.5625,
        y: 0.5094,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaScan.ts',
        x: 0.6203,
        y: 0.5397,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingMedia/missingMediaStore.ts',
        x: 0.6088,
        y: 0.5643,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingMedia/types.ts',
        x: 0.5661,
        y: 0.6223,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/missingModel/folderPathCache.ts',
        x: 0.3437,
        y: 0.7047,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/missingModel/missingModelDownload.ts',
        x: 0.3414,
        y: 0.6193,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelGrouping.ts',
        x: 0.5608,
        y: 0.7312,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelMetadata.ts',
        x: 0.3963,
        y: 0.632,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelPipeline.ts',
        x: 0.537,
        y: 0.5458,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelScan.ts',
        x: 0.6451,
        y: 0.5684,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/missingModelStore.ts',
        x: 0.5806,
        y: 0.4948,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/missingModel/types.ts',
        x: 0.5663,
        y: 0.6029,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/nodeReplacement/cnrIdUtil.ts',
        x: 0.6369,
        y: 0.3931,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodeScan.ts',
        x: 0.5973,
        y: 0.4697,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/missingNodesErrorStore.ts',
        x: 0.5926,
        y: 0.5073,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementService.ts',
        x: 0.3956,
        y: 0.6455,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/nodeReplacement/nodeReplacementStore.ts',
        x: 0.4774,
        y: 0.5489,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/onboarding/coachmarkRegistry.ts',
        x: 0.5277,
        y: 0.2583,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingReplay.ts',
        x: 0.39,
        y: 0.3384,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTourStore.ts',
        x: 0.4503,
        y: 0.3951,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/onboarding/onboardingTours.ts',
        x: 0.4629,
        y: 0.3056,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/tourState.ts',
        x: 0.425,
        y: 0.2193,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/onboarding/useTourTriggers.ts',
        x: 0.5127,
        y: 0.3632,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/remote/comfyui/execution/types.ts',
        x: 0.567,
        y: 0.613,
        states: [
          [0, 0],
          [81, 15],
          [83, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/fetchJobs.ts',
        x: 0.5146,
        y: 0.6271,
        states: [
          [0, 0],
          [81, 15],
          [83, 0]
        ]
      },
      {
        path: 'platform/remote/comfyui/jobs/jobTypes.ts',
        x: 0.5147,
        y: 0.7043,
        states: [
          [0, 0],
          [81, 15],
          [83, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/refreshRemoteConfig.ts',
        x: 0.3706,
        y: 0.4609,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/remoteConfig/remoteConfig.ts',
        x: 0.3053,
        y: 0.3902,
        states: [
          [0, 0],
          [4, 10],
          [87, -1],
          [89, 10]
        ]
      },
      {
        path: 'platform/remoteConfig/types.ts',
        x: 0.2516,
        y: 0.2931,
        states: [
          [0, 0],
          [4, 10],
          [87, -1],
          [89, 10]
        ]
      },
      {
        path: 'platform/secrets/api/secretsApi.ts',
        x: 0.2357,
        y: 0.7482,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/components/SecretFormDialog.vue',
        x: 0,
        y: 0.8085,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/components/SecretsPanel.vue',
        x: 0.116,
        y: 0.7142,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecretForm.ts',
        x: 0.0758,
        y: 0.8293,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/secrets/composables/useSecrets.ts',
        x: 0.093,
        y: 0.8022,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ColorPaletteMessage.vue',
        x: 0.4126,
        y: 0.554,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ExtensionPanel.vue',
        x: 0.4067,
        y: 0.6108,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/ServerConfigPanel.vue',
        x: 0.3436,
        y: 0.6847,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingDialog.vue',
        x: 0.2974,
        y: 0.566,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingGroup.vue',
        x: 0.1547,
        y: 0.772,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingItem.vue',
        x: 0.3091,
        y: 0.721,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingsPanel.vue',
        x: 0.1457,
        y: 0.6795,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/components/SettingsWorkspaceHeader.vue',
        x: 0.1392,
        y: 0.487,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingSearch.ts',
        x: 0.3954,
        y: 0.6024,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingUI.ts',
        x: 0.3124,
        y: 0.5704,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/settings/composables/useSettingsDialog.ts',
        x: 0.3219,
        y: 0.4931,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/settings/globalSettingsApi.ts',
        x: 0.3394,
        y: 0.5114,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/settings/missingWarningVisibility.ts',
        x: 0.5664,
        y: 0.577,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/settings/settingStore.ts',
        x: 0.527,
        y: 0.5721,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/skills/api/skillsApi.ts',
        x: 0.308,
        y: 0.5872,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/components/SkillPackFormDialog.vue',
        x: 0.0865,
        y: 0.5599,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/components/SkillPacksPanel.vue',
        x: 0.1593,
        y: 0.5771,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPackForm.ts',
        x: 0.246,
        y: 0.5226,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/composables/useSkillPacks.ts',
        x: 0.2732,
        y: 0.5249,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/skills/stores/skillPacksStore.ts',
        x: 0.3049,
        y: 0.5154,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/support/feedbackDialog.ts',
        x: 0.404,
        y: 0.3509,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/tasks/services/taskService.ts',
        x: 0.494,
        y: 0.715,
        states: [
          [0, 0],
          [81, 15],
          [83, 0]
        ]
      },
      {
        path: 'platform/telemetry/hostTelemetryEnabled.ts',
        x: 0.3592,
        y: 0.29,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/imageFailureDiagnostics.ts',
        x: 0.4371,
        y: 0.3174,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/index.ts',
        x: 0.3866,
        y: 0.4474,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/installNodeAddedTelemetry.ts',
        x: 0.5476,
        y: 0.4712,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/telemetry/nodeAdded/nodeAddSource.ts',
        x: 0.4899,
        y: 0.5544,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/perf/bootstrapTracer.ts',
        x: 0.4759,
        y: 0.4112,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/reportError.ts',
        x: 0.46,
        y: 0.4341,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/searchQuery/useSearchQueryTracking.ts',
        x: 0.386,
        y: 0.5758,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/types.ts',
        x: 0.3674,
        y: 0.4122,
        states: [
          [0, 0],
          [4, 10],
          [87, -1],
          [89, 10]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingFailureCategory.ts',
        x: 0.27,
        y: 0.3786,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/billingPortalTelemetry.ts',
        x: 0.2497,
        y: 0.3527,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/checkoutAttribution.ts',
        x: 0.2556,
        y: 0.2796,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getActionbarDockState.ts',
        x: 0.3588,
        y: 0.2644,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/getExecutionContext.ts',
        x: 0.5069,
        y: 0.5017,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/telemetry/utils/groupMissingNodesByPack.ts',
        x: 0.4917,
        y: 0.4144,
        states: [
          [0, 0],
          [13, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/paymentIntentSource.ts',
        x: 0.2412,
        y: 0.3424,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/telemetry/utils/workflowExecutionContext.ts',
        x: 0.4758,
        y: 0.3728,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowActionsService.ts',
        x: 0.4903,
        y: 0.5402,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/core/services/workflowService.ts',
        x: 0.5261,
        y: 0.4965,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/modelRequirements.ts',
        x: 0.4226,
        y: 0.704,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/pendingWarnings.ts',
        x: 0.535,
        y: 0.4864,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/restoreDynamicGroupInputs.ts',
        x: 0.6999,
        y: 0.5708,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowId.ts',
        x: 0.519,
        y: 0.5993,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/core/utils/workflowToClipboardItems.ts',
        x: 0.623,
        y: 0.3372,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useAppsSidebarTab.ts',
        x: 0.3492,
        y: 0.6495,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/composables/useWorkflowsSidebarTab.ts',
        x: 0.4451,
        y: 0.6418,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/management/stores/comfyWorkflow.ts',
        x: 0.5079,
        y: 0.5121,
        states: [[0, 0]]
      },
      {
        path: 'platform/workflow/management/stores/workflowStore.ts',
        x: 0.5444,
        y: 0.5272,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/management/stores/workflowStoreTypes.ts',
        x: 0.3906,
        y: 0.5563,
        states: [
          [0, -2],
          [85, 0],
          [89, -2]
        ]
      },
      {
        path: 'platform/workflow/persistence/stores/workflowDraftStoreV2.ts',
        x: 0.5291,
        y: 0.4629,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue',
        x: 0.3512,
        y: 0.6203,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/profile/ComfyHubCreateProfileForm.vue',
        x: 0.2614,
        y: 0.5156,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubDescribeStep.vue',
        x: 0.1567,
        y: 0.6486,
        states: [
          [0, 0],
          [81, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubExamplesStep.vue',
        x: 0.107,
        y: 0.5896,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubFinishStep.vue',
        x: 0.2686,
        y: 0.6603,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue',
        x: 0.3767,
        y: 0.5432,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue',
        x: 0.2485,
        y: 0.6175,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue',
        x: 0.2446,
        y: 0.5666,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/components/publish/ComfyHubThumbnailStep.vue',
        x: 0.1041,
        y: 0.5769,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubProfileGate.ts',
        x: 0.2981,
        y: 0.5357,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishSubmission.ts',
        x: 0.3741,
        y: 0.5827,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useComfyHubPublishWizard.ts',
        x: 0.3539,
        y: 0.5857,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/composables/useSharedWorkflowUrlLoader.ts',
        x: 0.4251,
        y: 0.5198,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/comfyHubService.ts',
        x: 0.2958,
        y: 0.6288,
        states: [
          [0, 0],
          [81, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/services/workflowShareService.ts',
        x: 0.4395,
        y: 0.6066,
        states: [
          [0, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/sharing/types/shareTypes.ts',
        x: 0.4248,
        y: 0.6218,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/sharing/utils/validateFileSize.ts',
        x: 0.21,
        y: 0.535,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelAvailability.ts',
        x: 0.427,
        y: 0.5989,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateModelRowDownloads.ts',
        x: 0.2315,
        y: 0.7196,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/composables/useTemplateWorkflows.ts',
        x: 0.476,
        y: 0.5666,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/repositories/workflowTemplatesStore.ts',
        x: 0.4067,
        y: 0.5834,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/templates/services/templateInputService.ts',
        x: 0.6261,
        y: 0.5901,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/stores/partnerNodesEducationStore.ts',
        x: 0.4383,
        y: 0.5193,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/types/templateDetail.ts',
        x: 0.1363,
        y: 0.8212,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelAvailability.ts',
        x: 0.4271,
        y: 0.6719,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelDownloadState.ts',
        x: 0.1999,
        y: 0.8418,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelMetadata.ts',
        x: 0.4066,
        y: 0.6679,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelRequirements.ts',
        x: 0.4179,
        y: 0.6954,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workflow/templates/utils/templateModelSetup.ts',
        x: 0.4087,
        y: 0.678,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'platform/workflow/utils/workflowExtractionUtil.ts',
        x: 0.5563,
        y: 0.7548,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'platform/workflow/validation/composables/useWorkflowValidation.ts',
        x: 0.612,
        y: 0.4319,
        states: [
          [0, 0],
          [4, -1],
          [71, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workflow/validation/schemas/workflowSchema.ts',
        x: 0.5828,
        y: 0.608,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/api/partnerNodePolicyApi.ts',
        x: 0.3187,
        y: 0.6469,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApi.ts',
        x: 0.2215,
        y: 0.3968,
        states: [
          [0, 0],
          [82, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/workspace/api/workspaceApiUrl.ts',
        x: 0.2946,
        y: 0.5066,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/customerAttention.ts',
        x: 0.1832,
        y: 0.4304,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/hostedBillingRoutes.ts',
        x: 0.1472,
        y: 0.4712,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/openHostedBillingTab.ts',
        x: 0.2687,
        y: 0.455,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingCapabilitiesView.ts',
        x: 0.0947,
        y: 0.3884,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingPlansView.ts',
        x: 0.0934,
        y: 0.4018,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingSdkStore.ts',
        x: 0.234,
        y: 0.4384,
        states: [
          [0, 0],
          [84, 17],
          [88, 19],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/billingStatusView.ts',
        x: 0.0945,
        y: 0.4165,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/operationRecordView.ts',
        x: 0.1121,
        y: 0.4167,
        states: [
          [0, 0],
          [82, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/subscriptionOperationView.ts',
        x: 0.1844,
        y: 0.4158,
        states: [
          [0, 0],
          [82, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/topupOperationView.ts',
        x: 0.159,
        y: 0.4234,
        states: [
          [0, 0],
          [82, -1],
          [83, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/sdk/webSessionBillingSession.ts',
        x: 0.2049,
        y: 0.4813,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/billing/stripePublishableKey.ts',
        x: 0.1898,
        y: 0.3575,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/billing/subscribeInput.ts',
        x: 0.1269,
        y: 0.3928,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/InviteMembersForm.vue',
        x: 0.302,
        y: 0.3593,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/PricingTableWorkspace.vue',
        x: 0.242,
        y: 0.4132,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue',
        x: 0.165,
        y: 0.3381,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
        x: 0.2043,
        y: 0.3844,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue',
        x: 0.2124,
        y: 0.3443,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue',
        x: 0.2162,
        y: 0.3532,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionSuccessWorkspace.vue',
        x: 0.1812,
        y: 0.3191,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/SubscriptionTransitionPreviewWorkspace.vue',
        x: 0.1504,
        y: 0.3219,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue',
        x: 0.3125,
        y: 0.4388,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/UnifiedPricingTable.vue',
        x: 0.1755,
        y: 0.3718,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/WorkspaceProfilePic.vue',
        x: 0.109,
        y: 0.3922,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/ChangeMemberRoleDialogContent.vue',
        x: 0.3078,
        y: 0.3741,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/CreateWorkspaceDialogContent.vue',
        x: 0.3441,
        y: 0.3435,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue',
        x: 0.336,
        y: 0.3598,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue',
        x: 0.3582,
        y: 0.3442,
        states: [
          [0, -1],
          [71, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue',
        x: 0.3441,
        y: 0.3552,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteLinkList.vue',
        x: 0.2055,
        y: 0.1655,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberDialogContent.vue',
        x: 0.2659,
        y: 0.2972,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteMemberUpsellDialogContent.vue',
        x: 0.2555,
        y: 0.3311,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/InviteWrongAccountDialogContent.vue',
        x: 0.3144,
        y: 0.3216,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue',
        x: 0.3362,
        y: 0.3483,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RemoveMemberDialogContent.vue',
        x: 0.3245,
        y: 0.3663,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/RevokeInviteDialogContent.vue',
        x: 0.3219,
        y: 0.3749,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue',
        x: 0.2819,
        y: 0.3092,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/TeamWorkspacesDialogContent.vue',
        x: 0.2466,
        y: 0.3732,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
        x: 0.2005,
        y: 0.4077,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MemberListItem.vue',
        x: 0.1543,
        y: 0.2802,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
        x: 0.1397,
        y: 0.3278,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PartnerNodeAccessPanel.vue',
        x: 0.3362,
        y: 0.571,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PendingInvitesList.vue',
        x: 0.1966,
        y: 0.2639,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue',
        x: 0.1499,
        y: 0.4318,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue',
        x: 0.0895,
        y: 0.364,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMembersPanelContent.vue',
        x: 0.1495,
        y: 0.4157,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue',
        x: 0.2197,
        y: 0.3837,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/dialogs/settings/WorkspaceSettingsPanelContent.vue',
        x: 0.189,
        y: 0.5111,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/components/subscriptionPanelWorkspace.logic.ts',
        x: 0.1211,
        y: 0.3487,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/readOnRail.ts',
        x: 0.2265,
        y: 0.3724,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingBanner.ts',
        x: 0.2033,
        y: 0.441,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingCapabilities.ts',
        x: 0.2804,
        y: 0.4123,
        states: [
          [0, 0],
          [84, 17],
          [88, 19],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useBillingReadRail.ts',
        x: 0.2519,
        y: 0.4409,
        states: [
          [0, 0],
          [84, 17],
          [88, 19],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useCheckoutCopy.ts',
        x: 0.1014,
        y: 0.2808,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useDowngradeToPersonal.ts',
        x: 0.2715,
        y: 0.4133,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useHasSavedPaymentMethod.ts',
        x: 0.288,
        y: 0.3805,
        states: [
          [0, 0],
          [15, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useMembersPanel.ts',
        x: 0.2388,
        y: 0.4213,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/usePlanEnded.ts',
        x: 0.1436,
        y: 0.3874,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useResubscribe.ts',
        x: 0.2213,
        y: 0.4121,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useScheduledPlanChange.ts',
        x: 0.1353,
        y: 0.3523,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionCheckout.ts',
        x: 0.2895,
        y: 0.4228,
        states: [
          [0, 0],
          [84, 17],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useSubscriptionRail.ts',
        x: 0.2301,
        y: 0.4624,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useTeamPlan.ts',
        x: 0.1186,
        y: 0.3738,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useTopupOperation.ts',
        x: 0.2593,
        y: 0.4554,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceBilling.ts',
        x: 0.2807,
        y: 0.427,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceDialogs.ts',
        x: 0.2761,
        y: 0.3243,
        states: [
          [0, -2],
          [83, 0],
          [84, 17],
          [89, -2]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceMenuItems.ts',
        x: 0.2085,
        y: 0.3992,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspacePlanPricing.ts',
        x: 0.1273,
        y: 0.3203,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceSwitch.ts',
        x: 0.1856,
        y: 0.2906,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceTierLabel.ts',
        x: 0.1298,
        y: 0.3347,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/composables/useWorkspaceUI.ts',
        x: 0.2389,
        y: 0.4507,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/billingOperationStore.ts',
        x: 0.2949,
        y: 0.4245,
        states: [
          [0, 0],
          [84, 17],
          [88, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/stores/legacyWorkspaceTokenRail.ts',
        x: 0.2348,
        y: 0.4991,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/partnerNodeGovernanceStore.ts',
        x: 0.2664,
        y: 0.5534,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'platform/workspace/stores/teamWorkspaceStore.ts',
        x: 0.3033,
        y: 0.4088,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/stores/workspaceAuthStore.ts',
        x: 0.3224,
        y: 0.4611,
        states: [[0, 0]]
      },
      {
        path: 'platform/workspace/utils/checkoutJourney.ts',
        x: 0.254,
        y: 0.4236,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/checkoutJourneyTelemetry.ts',
        x: 0.2403,
        y: 0.383,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/inviteLinks.ts',
        x: 0.2942,
        y: 0.2523,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'platform/workspace/utils/pendingSubscriptionCheckout.ts',
        x: 0.1809,
        y: 0.3454,
        states: [
          [0, 0],
          [82, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/platformLink.ts',
        x: 0.1915,
        y: 0.3729,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'platform/workspace/utils/workspaceCheckoutTelemetry.ts',
        x: 0.2941,
        y: 0.3575,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/cameraState.ts',
        x: 0.6498,
        y: 0.3074,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/canvasStore.ts',
        x: 0.643,
        y: 0.445,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasInteractionMode.ts',
        x: 0.6572,
        y: 0.3861,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/interaction/canvasPointerEvent.ts',
        x: 0.7273,
        y: 0.306,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkConnectorAdapter.ts',
        x: 0.7404,
        y: 0.364,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/links/linkDropOrchestrator.ts',
        x: 0.7618,
        y: 0.2635,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/arrangeForLegacyRender.ts',
        x: 0.7665,
        y: 0.2952,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/litegraphLinkAdapter.ts',
        x: 0.7782,
        y: 0.3096,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/selectionAdapter.ts',
        x: 0.7673,
        y: 0.3361,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/litegraph/slotCalculations.ts',
        x: 0.7791,
        y: 0.336,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useAutoPan.ts',
        x: 0.7844,
        y: 0.2404,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasInteractions.ts',
        x: 0.5741,
        y: 0.4282,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/core/canvas/useCanvasScheduler.ts',
        x: 0.5599,
        y: 0.3917,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/core/layout/operations/graphLayoutAttachment.ts',
        x: 0.8131,
        y: 0.3116,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/operations/layoutMutations.ts',
        x: 0.7159,
        y: 0.3214,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/slots/syncSlotOffsets.ts',
        x: 0.7703,
        y: 0.3735,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/core/layout/store/layoutStore.ts',
        x: 0.7194,
        y: 0.3368,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/layout/transform/graphRenderTransform.ts',
        x: 0.8265,
        y: 0.2439,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/transform/useTransformState.ts',
        x: 0.6692,
        y: 0.4768,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/layout/utils/nodeSizeUtil.ts',
        x: 0.7475,
        y: 0.278,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'renderer/core/spatial/boundsCalculator.ts',
        x: 0.6483,
        y: 0.2073,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/core/thumbnail/graphThumbnailRenderer.ts',
        x: 0.5971,
        y: 0.3299,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/core/thumbnail/useWorkflowThumbnail.ts',
        x: 0.5284,
        y: 0.3808,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/compositor/components/WidgetCompositor.vue',
        x: 0.7627,
        y: 0.5888,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSave.ts',
        x: 0.8647,
        y: 0.5525,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorSession.ts',
        x: 0.705,
        y: 0.5562,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/compositorWidgets.ts',
        x: 0.8037,
        y: 0.5403,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorAutoSave.ts',
        x: 0.8939,
        y: 0.5356,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorEditor.ts',
        x: 0.8502,
        y: 0.5766,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorLayers.ts',
        x: 0.7756,
        y: 0.5347,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/compositor/composables/useCompositorPsdDownload.ts',
        x: 0.832,
        y: 0.5643,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/gettingStarted/firstRunEntry.ts',
        x: 0.4103,
        y: 0.4503,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/heuristicRoles.ts',
        x: 0.7291,
        y: 0.3843,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/resolveTourRoles.ts',
        x: 0.6889,
        y: 0.3422,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/roles/tourSequence.ts',
        x: 0.6472,
        y: 0.1855,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/cameraFraming.ts',
        x: 0.6863,
        y: 0.2916,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/canvasCoachTarget.ts',
        x: 0.6453,
        y: 0.3349,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/firstRunTourDefinition.ts',
        x: 0.5822,
        y: 0.3125,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/firstRunTour/tour/useFirstRunTourController.ts',
        x: 0.4815,
        y: 0.446,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/components/LayerEditorContent.vue',
        x: 0.7523,
        y: 0.5498,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/layerEditorDialog.ts',
        x: 0.7668,
        y: 0.6054,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/layerEditor/composables/useLayerEditor.ts',
        x: 0.7702,
        y: 0.5189,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/linearMode/AppInput.vue',
        x: 0.6337,
        y: 0.4385,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/data/MinimapDataSource.ts',
        x: 0.6403,
        y: 0.3505,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/minimapCanvasRenderer.ts',
        x: 0.6761,
        y: 0.2804,
        states: [
          [0, 0],
          [21, -1]
        ]
      },
      {
        path: 'renderer/extensions/minimap/types.ts',
        x: 0.649,
        y: 0.2679,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/InputSlot.vue',
        x: 0.7423,
        y: 0.4017,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
        x: 0.7552,
        y: 0.5635,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeBadge.vue',
        x: 0.9793,
        y: 0.3656,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeHeader.vue',
        x: 0.8351,
        y: 0.46,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/NodeSlots.vue',
        x: 0.7088,
        y: 0.4266,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/OutputSlot.vue',
        x: 0.7498,
        y: 0.3798,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/SlotConnectionDot.vue',
        x: 0.8266,
        y: 0.3302,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/components/WidgetGrid.vue',
        x: 0.7738,
        y: 0.483,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeTooltips.ts',
        x: 0.6912,
        y: 0.5086,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useNodeZIndex.ts',
        x: 0.6747,
        y: 0.325,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkInteraction.ts',
        x: 0.7258,
        y: 0.3777,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useSlotLinkReveal.ts',
        x: 0.6952,
        y: 0.3408,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/composables/useVueNodeResizeTracking.ts',
        x: 0.7292,
        y: 0.3616,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale.ts',
        x: 0.7513,
        y: 0.3529,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/types/widgetGrid.ts',
        x: 0.8693,
        y: 0.5958,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/eventUtils.ts',
        x: 0.8618,
        y: 0.393,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/linkedCoreMediaUtils.ts',
        x: 0.6843,
        y: 0.6178,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/utils/nodeDataUtils.ts',
        x: 0.7033,
        y: 0.3572,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlButton.vue',
        x: 0.9274,
        y: 0.7718,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/ValueControlPopover.vue',
        x: 0.7211,
        y: 0.7022,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetButton.vue',
        x: 0.9418,
        y: 0.7068,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.types.ts',
        x: 0.9934,
        y: 0.604,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetChart.vue',
        x: 0.9545,
        y: 0.6775,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue',
        x: 0.9076,
        y: 0.6522,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetDynamicGroupRow.vue',
        x: 0.9258,
        y: 0.7291,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetImageCompare.vue',
        x: 0.7404,
        y: 0.6045,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue',
        x: 0.9208,
        y: 0.6895,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberGradientSlider.vue',
        x: 0.8999,
        y: 0.5638,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue',
        x: 0.9248,
        y: 0.6444,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputNumberSlider.vue',
        x: 0.9379,
        y: 0.7431,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue',
        x: 0.9129,
        y: 0.7264,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue',
        x: 0.8159,
        y: 0.4881,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetMarkdown.vue',
        x: 0.9317,
        y: 0.7129,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetRecordAudio.vue',
        x: 0.7585,
        y: 0.6132,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetResolutionPreview.vue',
        x: 0.8134,
        y: 0.5722,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue',
        x: 0.7323,
        y: 0.7191,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue',
        x: 0.7305,
        y: 0.6714,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue',
        x: 0.6764,
        y: 0.7517,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue',
        x: 0.6749,
        y: 0.5767,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue',
        x: 0.8181,
        y: 0.6505,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue',
        x: 0.9071,
        y: 0.6445,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue',
        x: 0.8488,
        y: 0.7512,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue',
        x: 0.5858,
        y: 0.8726,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.vue',
        x: 0.4347,
        y: 0.9912,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuFilter.vue',
        x: 0.2934,
        y: 0.9325,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenuItem.vue',
        x: 0.4644,
        y: 0.9349,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/components/layout/WidgetLayoutField.vue',
        x: 0.8566,
        y: 0.7014,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/audio/useAudioRecorder.ts',
        x: 0.7583,
        y: 0.7707,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData.ts',
        x: 0.5597,
        y: 0.8013,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBooleanWidget.ts',
        x: 0.8511,
        y: 0.5529,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget.ts',
        x: 0.872,
        y: 0.5259,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesSources.ts',
        x: 0.7104,
        y: 0.5908,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useBoundingBoxesWidget.ts',
        x: 0.865,
        y: 0.4842,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useChartWidget.ts',
        x: 0.8734,
        y: 0.5158,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorWidget.ts',
        x: 0.866,
        y: 0.5069,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useColorsWidget.ts',
        x: 0.8664,
        y: 0.5385,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts',
        x: 0.6711,
        y: 0.5966,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCompositorWidget.ts',
        x: 0.8692,
        y: 0.4933,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useCurveWidget.ts',
        x: 0.8604,
        y: 0.4965,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useDismissOnCanvasGesture.ts',
        x: 0.6396,
        y: 0.6571,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useFloatWidget.ts',
        x: 0.7225,
        y: 0.566,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget.ts',
        x: 0.8613,
        y: 0.5302,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareImages.ts',
        x: 0.7038,
        y: 0.5905,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageCompareWidget.ts',
        x: 0.8569,
        y: 0.5398,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget.ts',
        x: 0.7039,
        y: 0.5019,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget.ts',
        x: 0.6279,
        y: 0.5192,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useIntWidget.ts',
        x: 0.7092,
        y: 0.5686,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useLightInfoWidget.ts',
        x: 0.9413,
        y: 0.605,
        states: [
          [0, -2],
          [30, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget.ts',
        x: 0.724,
        y: 0.5001,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/usePainterWidget.ts',
        x: 0.8606,
        y: 0.5177,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget.ts',
        x: 0.713,
        y: 0.5469,
        states: [
          [0, 0],
          [80, -1],
          [81, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRangeWidget.ts',
        x: 0.8743,
        y: 0.5021,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts',
        x: 0.5712,
        y: 0.5146,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useResolutionPreviewWidget.ts',
        x: 0.8561,
        y: 0.5083,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useStringWidget.ts',
        x: 0.7436,
        y: 0.4938,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useTextareaWidget.ts',
        x: 0.8499,
        y: 0.5398,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useVideoEditWidget.ts',
        x: 0.8513,
        y: 0.5243,
        states: [
          [0, 0],
          [79, -1],
          [80, 0],
          [83, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions.ts',
        x: 0.5798,
        y: 0.6408,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems.ts',
        x: 0.6002,
        y: 0.77,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts',
        x: 0.8374,
        y: 0.639,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/audioUtils.ts',
        x: 0.6497,
        y: 0.6431,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas.ts',
        x: 0.6749,
        y: 0.5373,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/multilineTextarea.ts',
        x: 0.6842,
        y: 0.5194,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget.ts',
        x: 0.8859,
        y: 0.4743,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/extensions/vueNodes/widgets/utils/savedImageUrls.ts',
        x: 0.6144,
        y: 0.6208,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'renderer/utils/nodeTypeGuards.ts',
        x: 0.8417,
        y: 0.4769,
        states: [
          [0, 0],
          [66, 14],
          [87, -2],
          [89, 14]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecTree.ts',
        x: 0.638,
        y: 0.6124,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/inputSpecUtil.ts',
        x: 0.6566,
        y: 0.7736,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'schemas/nodeDef/searchableSlotTypes.ts',
        x: 0.6922,
        y: 0.7296,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/api.ts',
        x: 0.4926,
        y: 0.6004,
        states: [
          [0, 0],
          [81, 15],
          [83, 0]
        ]
      },
      {
        path: 'scripts/app.ts',
        x: 0.6041,
        y: 0.5067,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'scripts/appInstance.ts',
        x: 0.6088,
        y: 0.5042,
        states: [
          [0, -2],
          [84, 0],
          [89, -2]
        ]
      },
      {
        path: 'scripts/appRegistry.ts',
        x: 0.5721,
        y: 0.3735,
        states: [
          [0, -2],
          [84, 0],
          [89, -2]
        ]
      },
      {
        path: 'scripts/changeTracker.ts',
        x: 0.6063,
        y: 0.5433,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'scripts/clipspace.ts',
        x: 0.6152,
        y: 0.5984,
        states: [
          [0, -2],
          [84, 0],
          [85, 18],
          [89, -2]
        ]
      },
      {
        path: 'scripts/defaultGraph.ts',
        x: 0.5498,
        y: 0.5808,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/domWidget.ts',
        x: 0.7322,
        y: 0.5372,
        states: [
          [0, 0],
          [28, 12],
          [87, -1],
          [89, 12]
        ]
      },
      {
        path: 'scripts/errorNodeWidgets.ts',
        x: 0.8135,
        y: 0.5336,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'scripts/metadata/avif.ts',
        x: 0.6584,
        y: 0.7316,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ebml.ts',
        x: 0.6281,
        y: 0.7869,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/gltf.ts',
        x: 0.6344,
        y: 0.7988,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/isobmff.ts',
        x: 0.6233,
        y: 0.7995,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/mp3.ts',
        x: 0.6407,
        y: 0.7875,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/ogg.ts',
        x: 0.6123,
        y: 0.7936,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/metadata/parser.ts',
        x: 0.639,
        y: 0.7428,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'scripts/metadata/svg.ts',
        x: 0.6787,
        y: 0.9089,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'scripts/pnginfo.ts',
        x: 0.6697,
        y: 0.5914,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'scripts/promotedWidgetControl.ts',
        x: 0.7049,
        y: 0.5419,
        states: [
          [0, 0],
          [79, -2],
          [80, 0],
          [81, -1],
          [83, -2],
          [89, 0]
        ]
      },
      { path: 'scripts/ui.ts', x: 0.5146, y: 0.4498, states: [[0, 0]] },
      {
        path: 'scripts/ui/components/asyncDialog.ts',
        x: 0.5018,
        y: 0.2817,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      {
        path: 'scripts/ui/components/button.ts',
        x: 0.5396,
        y: 0.4012,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/buttonGroup.ts',
        x: 0.5145,
        y: 0.3496,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/popup.ts',
        x: 0.5253,
        y: 0.3503,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/components/splitButton.ts',
        x: 0.5211,
        y: 0.3424,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/dialog.ts',
        x: 0.4891,
        y: 0.3011,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      {
        path: 'scripts/ui/imagePreview.ts',
        x: 0.6477,
        y: 0.4312,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'scripts/ui/menu/index.ts',
        x: 0.5396,
        y: 0.3853,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/settings.ts',
        x: 0.5144,
        y: 0.4289,
        states: [[0, 0]]
      },
      {
        path: 'scripts/ui/toggleSwitch.ts',
        x: 0.4749,
        y: 0.249,
        states: [
          [0, 0],
          [24, -1]
        ]
      },
      { path: 'scripts/utils.ts', x: 0.5542, y: 0.4918, states: [[0, 0]] },
      {
        path: 'scripts/valueControl.ts',
        x: 0.8176,
        y: 0.5528,
        states: [
          [0, 0],
          [4, -1],
          [79, -2],
          [80, -1],
          [83, -2],
          [89, -1]
        ]
      },
      {
        path: 'scripts/widgets.ts',
        x: 0.7664,
        y: 0.5346,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'services/audioService.ts',
        x: 0.6351,
        y: 0.7006,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'services/colorPaletteService.ts',
        x: 0.536,
        y: 0.511,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'services/customerEventsService.ts',
        x: 0.3704,
        y: 0.4244,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'services/dialogService.ts',
        x: 0.3821,
        y: 0.4523,
        states: [[0, 0]]
      },
      {
        path: 'services/dialogServiceTypes.ts',
        x: 0.2881,
        y: 0.4846,
        states: [
          [0, -2],
          [85, 0],
          [89, -2]
        ]
      },
      {
        path: 'services/extensionService.ts',
        x: 0.5709,
        y: 0.455,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'services/jobOutputCache.ts',
        x: 0.5168,
        y: 0.7192,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'services/litegraphService.ts',
        x: 0.6337,
        y: 0.5221,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'services/load3dService.ts',
        x: 0.7261,
        y: 0.6105,
        states: [
          [0, 0],
          [66, 13]
        ]
      },
      {
        path: 'services/nodeHelpService.ts',
        x: 0.5655,
        y: 0.7728,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeOrganizationService.ts',
        x: 0.4859,
        y: 0.7473,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'services/nodeSearchService.ts',
        x: 0.6304,
        y: 0.8571,
        states: [
          [0, 0],
          [81, 16],
          [83, 0],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'services/subgraphPseudoWidgetCache.ts',
        x: 0.7281,
        y: 0.6527,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'services/subgraphService.ts',
        x: 0.6549,
        y: 0.5116,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'services/uploadTempFile.ts',
        x: 0.4882,
        y: 0.5829,
        states: [
          [0, -2],
          [71, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'services/useNewUserService.ts',
        x: 0.4189,
        y: 0.4965,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'stores/aboutPanelStore.ts',
        x: 0.4173,
        y: 0.6031,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'stores/apiKeyAuthStore.ts',
        x: 0.4285,
        y: 0.4238,
        states: [[0, 0]]
      },
      {
        path: 'stores/appModeStore.ts',
        x: 0.6121,
        y: 0.4866,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/assetDownloadStore.ts',
        x: 0.4412,
        y: 0.7106,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/assetExportStore.ts',
        x: 0.4903,
        y: 0.6815,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/assetsStore.ts',
        x: 0.5077,
        y: 0.6891,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      { path: 'stores/authStore.ts', x: 0.3611, y: 0.4147, states: [[0, 0]] },
      {
        path: 'stores/clearNodeOwnedStoreState.ts',
        x: 0.8614,
        y: 0.4191,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      { path: 'stores/commandStore.ts', x: 0.41, y: 0.5107, states: [[0, 0]] },
      {
        path: 'stores/domWidgetStore.ts',
        x: 0.6347,
        y: 0.4867,
        states: [
          [0, 0],
          [28, 12],
          [87, -1],
          [89, 12]
        ]
      },
      {
        path: 'stores/electronDownloadStore.ts',
        x: 0.2722,
        y: 0.6327,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/entityIdStore.ts',
        x: 0.8688,
        y: 0.2126,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/executionErrorStore.ts',
        x: 0.5754,
        y: 0.5229,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/executionStore.ts',
        x: 0.5302,
        y: 0.5688,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/extensionStore.ts',
        x: 0.5205,
        y: 0.5708,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/graphMetadataStore.ts',
        x: 0.8555,
        y: 0.1788,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/jobPreviewStore.ts',
        x: 0.5372,
        y: 0.6478,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/linkPresentationStore.ts',
        x: 0.7373,
        y: 0.3199,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/linkStore.ts',
        x: 0.7394,
        y: 0.3454,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'stores/maskEditorDataStore.ts',
        x: 0.801,
        y: 0.6591,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'stores/menuItemStore.ts',
        x: 0.5022,
        y: 0.4904,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/modelStore.ts',
        x: 0.3828,
        y: 0.6766,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'stores/modelToNodeStore.ts',
        x: 0.4592,
        y: 0.6906,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/nodeBookmarkStore.ts',
        x: 0.5291,
        y: 0.7377,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/nodeDataStore.ts',
        x: 0.8465,
        y: 0.2784,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/nodeDefStore.ts',
        x: 0.5879,
        y: 0.6504,
        states: [
          [0, 0],
          [81, 16],
          [83, 0],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/nodeOutputStore.ts',
        x: 0.6491,
        y: 0.5674,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/previewExposureStore.ts',
        x: 0.7968,
        y: 0.4261,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/queueStore.ts',
        x: 0.4998,
        y: 0.6733,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/rekeyGraphId.ts',
        x: 0.8704,
        y: 0.1886,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/rerouteStore.ts',
        x: 0.8114,
        y: 0.2327,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'stores/resultItemParsing.ts',
        x: 0.5279,
        y: 0.7659,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/subgraphNavigationStore.ts',
        x: 0.61,
        y: 0.4479,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/subgraphStore.ts',
        x: 0.5469,
        y: 0.5617,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/systemStatsStore.ts',
        x: 0.3648,
        y: 0.6405,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'stores/userFileStore.ts',
        x: 0.4731,
        y: 0.6352,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'stores/userStore.ts',
        x: 0.303,
        y: 0.6944,
        states: [
          [0, 0],
          [17, -1]
        ]
      },
      {
        path: 'stores/widgetStore.ts',
        x: 0.6677,
        y: 0.5527,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/widgetValueStore.ts',
        x: 0.7562,
        y: 0.4959,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'stores/workspace/assetsSidebarBadgeStore.ts',
        x: 0.4063,
        y: 0.7453,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/bottomPanelStore.ts',
        x: 0.4313,
        y: 0.5481,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/workspace/favoritedWidgetsStore.ts',
        x: 0.6768,
        y: 0.4956,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'stores/workspace/nodeHelpStore.ts',
        x: 0.5505,
        y: 0.7858,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'stores/workspace/rightSidePanelStore.ts',
        x: 0.5917,
        y: 0.5984,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/workspace/sidebarTabStore.ts',
        x: 0.4337,
        y: 0.6013,
        states: [
          [0, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'stores/workspaceStore.ts',
        x: 0.4773,
        y: 0.5055,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'systems/badgeSystem.ts',
        x: 0.6326,
        y: 0.4665,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      { path: 'types/comfy.ts', x: 0.5671, y: 0.496, states: [[0, 0]] },
      {
        path: 'types/extensionTypes.ts',
        x: 0.4384,
        y: 0.5762,
        states: [[0, 0]]
      },
      {
        path: 'types/index.ts',
        x: 0.5928,
        y: 0.5526,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'types/linkTopology.ts',
        x: 0.8083,
        y: 0.2633,
        states: [
          [0, 0],
          [4, 9],
          [43, -1]
        ]
      },
      {
        path: 'types/metadataTypes.ts',
        x: 0.6476,
        y: 0.8051,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'types/nodeOrganizationTypes.ts',
        x: 0.5096,
        y: 0.76,
        states: [
          [0, 0],
          [81, 16],
          [83, 0],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'types/nodeState.ts',
        x: 0.7529,
        y: 0.4367,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/simplifiedWidget.ts',
        x: 0.8172,
        y: 0.6325,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'types/treeExplorerTypes.ts',
        x: 0.4801,
        y: 0.7172,
        states: [
          [0, 0],
          [81, 16],
          [83, 0],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'types/widgetState.ts',
        x: 0.8364,
        y: 0.5175,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/createAnnotatedPath.ts',
        x: 0.6006,
        y: 0.6081,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/errorReportUtil.ts',
        x: 0.5666,
        y: 0.473,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/errorSeverityClassification.ts',
        x: 0.5775,
        y: 0.6597,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/eventUtils.ts',
        x: 0.5798,
        y: 0.6993,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/executionUtil.ts',
        x: 0.6652,
        y: 0.5616,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/graphTraversalUtil.ts',
        x: 0.6571,
        y: 0.4943,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/imageUtil.ts',
        x: 0.6175,
        y: 0.5564,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/linkFixer.ts',
        x: 0.756,
        y: 0.3726,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/litegraphUtil.ts',
        x: 0.671,
        y: 0.4973,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'utils/mathUtil.ts',
        x: 0.838,
        y: 0.6616,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/migration/migrateReroute.ts',
        x: 0.6141,
        y: 0.6736,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/missingResourceAbsorption.ts',
        x: 0.6222,
        y: 0.6195,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeDefUtil.ts',
        x: 0.8739,
        y: 0.6255,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeFilterUtil.ts',
        x: 0.6681,
        y: 0.3921,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/nodeOutputUtil.ts',
        x: 0.6573,
        y: 0.6955,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/positionBounds.ts',
        x: 0.708,
        y: 0.275,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/queueDisplay.ts',
        x: 0.4534,
        y: 0.8361,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/queueUtil.ts',
        x: 0.4195,
        y: 0.7909,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/resultItem.ts',
        x: 0.4884,
        y: 0.7949,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/resultItemUrl.ts',
        x: 0.4695,
        y: 0.7989,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/searchAndReplace.ts',
        x: 0.6679,
        y: 0.4388,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/sessionFeatureFlagOverride.ts',
        x: 0.3281,
        y: 0.5796,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'utils/syncUtil.ts',
        x: 0.4655,
        y: 0.6211,
        states: [
          [0, 0],
          [81, -1],
          [83, 0]
        ]
      },
      {
        path: 'utils/treeUtil.ts',
        x: 0.4174,
        y: 0.6673,
        states: [
          [0, 0],
          [81, 16],
          [83, 0],
          [87, -1],
          [89, 0]
        ]
      },
      {
        path: 'utils/typeGuardUtil.ts',
        x: 0.6136,
        y: 0.4976,
        states: [
          [0, 0],
          [4, 9]
        ]
      },
      {
        path: 'utils/videoMetadataUtil.ts',
        x: 0.6532,
        y: 0.7528,
        states: [
          [0, 0],
          [1, -1]
        ]
      },
      {
        path: 'utils/vintageClipboard.ts',
        x: 0.6045,
        y: 0.4793,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/eventHelpers.ts',
        x: 0.5942,
        y: 0.297,
        states: [
          [0, 0],
          [84, -1],
          [89, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useAgentConsent.ts',
        x: 0.3885,
        y: 0.3835,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/composables/agent/useComposer.ts',
        x: 0.3281,
        y: 0.2518,
        states: [
          [0, 0],
          [29, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentCrdtDocLifecycle.ts',
        x: 0.3845,
        y: 0.1971,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/agentSubgraphDefinitions.ts',
        x: 0.7662,
        y: 0.247,
        states: [
          [0, -1],
          [3, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/devPanelLog.ts',
        x: 0.407,
        y: 0.2376,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/docOpMinter.ts',
        x: 0.7176,
        y: 0.4078,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/crdt/restoreOpMinter.ts',
        x: 0.6556,
        y: 0.3218,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/agentEventTransport.ts',
        x: 0.3231,
        y: 0.0535,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/undeliverableAskReporter.ts',
        x: 0.3603,
        y: 0.1649,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/services/agent/workflowTabActivityTracker.ts',
        x: 0.4867,
        y: 0.356,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentComposerStore.ts',
        x: 0.3799,
        y: 0.3318,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConsentStore.ts',
        x: 0.3503,
        y: 0.4065,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentConversationStore.ts',
        x: 0.2857,
        y: 0.009,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/stores/agent/agentPanelStore.ts',
        x: 0.4815,
        y: 0.4581,
        states: [
          [0, 0],
          [85, 18],
          [89, 0]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerAttachment.ts',
        x: 0.393,
        y: 0.5012,
        states: [
          [0, -2],
          [29, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/types/composerPrompt.ts',
        x: 0.3267,
        y: 0.2822,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/agentMessageText.ts',
        x: 0.229,
        y: 0,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/composerPrompt.ts',
        x: 0.2912,
        y: 0.1574,
        states: [
          [0, 0],
          [66, -1]
        ]
      },
      {
        path: 'workbench/extensions/agent/utils/starterPrompts.ts',
        x: 0.3201,
        y: 0.2409,
        states: [
          [0, 0],
          [4, -1]
        ]
      },
      {
        path: 'workbench/utils/nodeDefOrderingUtil.ts',
        x: 0.6957,
        y: 0.6221,
        states: [
          [0, 0],
          [81, -1],
          [83, 0],
          [85, -1],
          [89, 0]
        ]
      },
      {
        path: 'workbench/utils/nodeHelpUtil.ts',
        x: 0.6128,
        y: 0.84,
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
          [0, 80],
          [83, 91]
        ]
      ],
      [485, 486, [[0, 3]]],
      [486, 491, [[0, 91]]],
      [486, 593, [[0, 3]]],
      [486, 597, [[0, 3]]],
      [486, 730, [[0, 91]]],
      [486, 731, [[0, 91]]],
      [
        486,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [197, 217, [[0, 3]]],
      [197, 562, [[0, 3]]],
      [197, 593, [[0, 3]]],
      [
        197,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [197, 1000, [[0, 3]]],
      [217, 562, [[0, 3]]],
      [
        562,
        563,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        563,
        599,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        513,
        599,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        522,
        599,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        513,
        562,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        513,
        522,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [593, 599, [[0, 3]]],
      [
        492,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [558, 873, [[0, 91]]],
      [559, 873, [[0, 91]]],
      [560, 873, [[0, 91]]],
      [593, 873, [[0, 3]]],
      [652, 873, [[0, 3]]],
      [
        873,
        928,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [873, 1000, [[0, 3]]],
      [
        197,
        492,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [491, 492, [[0, 91]]],
      [492, 593, [[0, 3]]],
      [492, 597, [[0, 3]]],
      [492, 599, [[0, 3]]],
      [492, 731, [[0, 91]]],
      [
        197,
        491,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [490, 491, [[0, 91]]],
      [491, 597, [[0, 3]]],
      [490, 928, [[0, 91]]],
      [
        197,
        928,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [218, 928, [[0, 3]]],
      [485, 928, [[0, 3]]],
      [486, 928, [[0, 91]]],
      [492, 928, [[0, 91]]],
      [553, 928, [[0, 3]]],
      [
        561,
        928,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [593, 928, [[0, 3]]],
      [597, 928, [[0, 3]]],
      [730, 928, [[0, 91]]],
      [731, 928, [[0, 91]]],
      [909, 928, [[0, 91]]],
      [923, 928, [[0, 91]]],
      [218, 562, [[0, 3]]],
      [219, 485, [[0, 3]]],
      [485, 562, [[0, 3]]],
      [219, 562, [[0, 3]]],
      [553, 597, [[0, 3]]],
      [591, 597, [[0, 3]]],
      [562, 591, [[0, 3]]],
      [561, 562, [[0, 3]]],
      [
        561,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        654,
        730,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [118, 730, [[0, 91]]],
      [
        197,
        730,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [488, 730, [[0, 91]]],
      [597, 730, [[0, 3]]],
      [730, 731, [[0, 91]]],
      [
        654,
        655,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        492,
        654,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [593, 654, [[0, 3]]],
      [
        654,
        928,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [218, 655, [[0, 3]]],
      [
        655,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [118, 923, [[0, 91]]],
      [118, 928, [[0, 91]]],
      [118, 930, [[0, 91]]],
      [930, 969, [[0, 91]]],
      [358, 969, [[0, 3]]],
      [360, 969, [[0, 3]]],
      [
        558,
        969,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [652, 969, [[0, 3]]],
      [
        874,
        969,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        905,
        969,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [969, 970, [[0, 91]]],
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
      [311, 360, [[0, 91]]],
      [326, 360, [[0, 91]]],
      [343, 360, [[0, 91]]],
      [327, 360, [[0, 91]]],
      [329, 360, [[0, 91]]],
      [332, 360, [[0, 91]]],
      [333, 360, [[0, 91]]],
      [336, 360, [[0, 91]]],
      [310, 360, [[0, 91]]],
      [313, 360, [[0, 91]]],
      [355, 360, [[0, 42]]],
      [356, 360, [[0, 91]]],
      [358, 360, [[0, 42]]],
      [314, 360, [[0, 91]]],
      [315, 360, [[0, 42]]],
      [316, 360, [[0, 42]]],
      [317, 360, [[0, 91]]],
      [318, 360, [[0, 91]]],
      [319, 360, [[0, 91]]],
      [322, 360, [[0, 91]]],
      [360, 361, [[0, 91]]],
      [320, 360, [[0, 91]]],
      [360, 362, [[0, 42]]],
      [360, 363, [[0, 91]]],
      [360, 364, [[0, 91]]],
      [360, 369, [[0, 91]]],
      [323, 360, [[0, 91]]],
      [360, 376, [[0, 91]]],
      [360, 377, [[0, 91]]],
      [360, 381, [[0, 91]]],
      [360, 387, [[0, 91]]],
      [360, 391, [[0, 91]]],
      [360, 394, [[0, 91]]],
      [360, 396, [[0, 91]]],
      [360, 403, [[0, 91]]],
      [360, 404, [[0, 91]]],
      [360, 407, [[0, 91]]],
      [360, 424, [[0, 91]]],
      [360, 438, [[0, 91]]],
      [324, 326, [[0, 91]]],
      [326, 327, [[0, 91]]],
      [326, 328, [[0, 91]]],
      [326, 329, [[0, 91]]],
      [326, 330, [[0, 91]]],
      [326, 332, [[0, 91]]],
      [326, 333, [[0, 91]]],
      [326, 334, [[0, 91]]],
      [326, 335, [[0, 91]]],
      [326, 336, [[0, 91]]],
      [234, 326, [[0, 3]]],
      [326, 354, [[0, 91]]],
      [326, 358, [[0, 42]]],
      [319, 326, [[0, 91]]],
      [320, 326, [[0, 91]]],
      [326, 368, [[0, 91]]],
      [323, 326, [[0, 91]]],
      [326, 374, [[0, 91]]],
      [326, 375, [[0, 91]]],
      [326, 377, [[0, 91]]],
      [326, 379, [[0, 91]]],
      [326, 380, [[0, 91]]],
      [326, 382, [[0, 91]]],
      [326, 383, [[0, 91]]],
      [326, 391, [[0, 91]]],
      [326, 396, [[0, 91]]],
      [326, 939, [[0, 3]]],
      [324, 330, [[0, 91]]],
      [324, 354, [[0, 91]]],
      [324, 358, [[0, 42]]],
      [319, 324, [[0, 91]]],
      [320, 324, [[0, 91]]],
      [323, 324, [[0, 91]]],
      [324, 379, [[0, 91]]],
      [324, 382, [[0, 91]]],
      [330, 354, [[0, 91]]],
      [330, 358, [[0, 42]]],
      [319, 330, [[0, 91]]],
      [330, 360, [[0, 91]]],
      [330, 379, [[0, 91]]],
      [330, 378, [[0, 91]]],
      [330, 382, [[0, 91]]],
      [330, 389, [[0, 91]]],
      [327, 354, [[0, 91]]],
      [329, 354, [[0, 91]]],
      [332, 354, [[0, 91]]],
      [333, 354, [[0, 91]]],
      [319, 354, [[0, 91]]],
      [320, 354, [[0, 91]]],
      [323, 354, [[0, 91]]],
      [354, 380, [[0, 91]]],
      [354, 383, [[0, 91]]],
      [354, 391, [[0, 91]]],
      [354, 396, [[0, 91]]],
      [327, 328, [[0, 91]]],
      [234, 327, [[0, 3]]],
      [327, 358, [[0, 42]]],
      [319, 327, [[0, 91]]],
      [320, 327, [[0, 91]]],
      [323, 327, [[0, 91]]],
      [327, 382, [[0, 91]]],
      [327, 389, [[0, 91]]],
      [327, 394, [[0, 91]]],
      [328, 330, [[0, 91]]],
      [328, 354, [[0, 91]]],
      [328, 358, [[0, 42]]],
      [319, 328, [[0, 91]]],
      [320, 328, [[0, 91]]],
      [323, 328, [[0, 91]]],
      [328, 379, [[0, 91]]],
      [328, 382, [[0, 91]]],
      [328, 389, [[0, 91]]],
      [328, 939, [[0, 3]]],
      [319, 343, [[0, 91]]],
      [313, 319, [[0, 91]]],
      [319, 347, [[0, 91]]],
      [319, 348, [[0, 91]]],
      [319, 349, [[0, 91]]],
      [319, 350, [[0, 91]]],
      [319, 355, [[0, 42]]],
      [314, 319, [[0, 91]]],
      [315, 319, [[0, 42]]],
      [316, 319, [[0, 42]]],
      [317, 319, [[0, 91]]],
      [319, 359, [[0, 91]]],
      [319, 320, [[0, 91]]],
      [319, 362, [[0, 42]]],
      [319, 363, [[0, 91]]],
      [319, 364, [[0, 91]]],
      [319, 367, [[0, 91]]],
      [319, 368, [[0, 91]]],
      [319, 369, [[0, 91]]],
      [319, 370, [[0, 91]]],
      [319, 371, [[0, 91]]],
      [319, 323, [[0, 91]]],
      [319, 380, [[0, 91]]],
      [319, 383, [[0, 91]]],
      [319, 391, [[0, 91]]],
      [319, 389, [[0, 91]]],
      [319, 394, [[0, 91]]],
      [319, 396, [[0, 91]]],
      [319, 398, [[0, 91]]],
      [319, 399, [[0, 91]]],
      [319, 401, [[0, 91]]],
      [319, 402, [[0, 91]]],
      [319, 407, [[0, 91]]],
      [319, 438, [[0, 91]]],
      [222, 319, [[0, 91]]],
      [319, 403, [[0, 91]]],
      [319, 747, [[0, 91]]],
      [319, 751, [[0, 91]]],
      [319, 754, [[0, 91]]],
      [319, 960, [[0, 91]]],
      [319, 975, [[0, 91]]],
      [343, 358, [[0, 42]]],
      [343, 362, [[0, 42]]],
      [358, 362, [[0, 42]]],
      [313, 358, [[0, 42]]],
      [347, 355, [[0, 42]]],
      [347, 358, [[0, 42]]],
      [347, 361, [[0, 91]]],
      [355, 362, [[0, 42]]],
      [322, 361, [[0, 91]]],
      [322, 325, [[0, 91]]],
      [311, 322, [[0, 91]]],
      [312, 322, [[0, 91]]],
      [313, 322, [[0, 91]]],
      [322, 347, [[0, 91]]],
      [322, 355, [[0, 42]]],
      [322, 358, [[0, 42]]],
      [314, 322, [[0, 91]]],
      [317, 322, [[0, 91]]],
      [318, 322, [[0, 91]]],
      [319, 322, [[0, 91]]],
      [320, 322, [[0, 91]]],
      [322, 362, [[0, 42]]],
      [322, 323, [[0, 91]]],
      [322, 378, [[0, 91]]],
      [322, 384, [[0, 91]]],
      [317, 325, [[0, 91]]],
      [317, 337, [[0, 91]]],
      [317, 338, [[0, 91]]],
      [317, 339, [[0, 91]]],
      [317, 340, [[0, 91]]],
      [317, 326, [[0, 91]]],
      [317, 342, [[0, 91]]],
      [317, 343, [[0, 91]]],
      [317, 345, [[0, 91]]],
      [317, 331, [[0, 91]]],
      [310, 317, [[0, 91]]],
      [311, 317, [[0, 91]]],
      [313, 317, [[0, 91]]],
      [317, 347, [[0, 91]]],
      [317, 352, [[0, 91]]],
      [317, 355, [[0, 42]]],
      [317, 358, [[0, 42]]],
      [314, 317, [[0, 91]]],
      [317, 318, [[0, 91]]],
      [317, 359, [[0, 91]]],
      [317, 320, [[0, 91]]],
      [317, 362, [[0, 42]]],
      [317, 363, [[0, 91]]],
      [317, 368, [[0, 91]]],
      [317, 323, [[0, 91]]],
      [317, 377, [[0, 91]]],
      [317, 380, [[0, 91]]],
      [317, 378, [[0, 91]]],
      [317, 381, [[0, 91]]],
      [317, 383, [[0, 91]]],
      [317, 387, [[0, 91]]],
      [317, 391, [[0, 91]]],
      [317, 394, [[0, 91]]],
      [317, 396, [[0, 91]]],
      [317, 397, [[0, 91]]],
      [317, 398, [[0, 91]]],
      [317, 399, [[0, 91]]],
      [317, 400, [[0, 91]]],
      [317, 403, [[0, 91]]],
      [317, 407, [[0, 91]]],
      [317, 438, [[0, 91]]],
      [234, 317, [[0, 3]]],
      [317, 327, [[0, 91]]],
      [317, 330, [[0, 91]]],
      [317, 597, [[0, 3]]],
      [317, 744, [[0, 91]]],
      [317, 745, [[0, 91]]],
      [317, 746, [[0, 91]]],
      [317, 747, [[0, 91]]],
      [317, 748, [[0, 91]]],
      [317, 752, [[0, 91]]],
      [317, 754, [[0, 91]]],
      [317, 939, [[0, 3]]],
      [317, 940, [[0, 42]]],
      [317, 984, [[0, 91]]],
      [337, 358, [[0, 42]]],
      [318, 337, [[0, 91]]],
      [320, 337, [[0, 91]]],
      [323, 337, [[0, 91]]],
      [337, 338, [[0, 91]]],
      [337, 339, [[0, 91]]],
      [337, 342, [[0, 91]]],
      [337, 939, [[0, 3]]],
      [318, 347, [[0, 91]]],
      [318, 358, [[0, 42]]],
      [314, 318, [[0, 91]]],
      [318, 319, [[0, 91]]],
      [318, 362, [[0, 42]]],
      [318, 394, [[0, 91]]],
      [318, 751, [[0, 91]]],
      [318, 754, [[0, 91]]],
      [313, 314, [[0, 91]]],
      [314, 348, [[0, 91]]],
      [314, 349, [[0, 91]]],
      [314, 350, [[0, 91]]],
      [314, 353, [[0, 91]]],
      [314, 355, [[0, 42]]],
      [314, 356, [[0, 91]]],
      [314, 358, [[0, 42]]],
      [314, 359, [[0, 91]]],
      [314, 321, [[0, 91]]],
      [314, 320, [[0, 91]]],
      [314, 362, [[0, 42]]],
      [314, 368, [[0, 91]]],
      [314, 370, [[0, 91]]],
      [314, 372, [[0, 91]]],
      [314, 323, [[0, 91]]],
      [314, 386, [[0, 91]]],
      [314, 379, [[0, 91]]],
      [314, 380, [[0, 91]]],
      [314, 382, [[0, 91]]],
      [314, 383, [[0, 91]]],
      [314, 387, [[0, 91]]],
      [314, 388, [[0, 91]]],
      [314, 394, [[0, 91]]],
      [314, 398, [[0, 91]]],
      [314, 399, [[0, 91]]],
      [314, 402, [[0, 91]]],
      [221, 314, [[0, 91]]],
      [223, 314, [[0, 91]]],
      [234, 314, [[0, 3]]],
      [314, 597, [[0, 3]]],
      [314, 744, [[0, 91]]],
      [314, 751, [[0, 91]]],
      [314, 754, [[0, 91]]],
      [314, 929, [[0, 91]]],
      [314, 933, [[0, 91]]],
      [314, 937, [[0, 91]]],
      [314, 939, [[0, 3]]],
      [314, 940, [[0, 42]]],
      [314, 946, [[0, 91]]],
      [314, 949, [[0, 91]]],
      [314, 951, [[0, 91]]],
      [314, 952, [[0, 42]]],
      [314, 960, [[0, 91]]],
      [314, 972, [[0, 42]]],
      [314, 984, [[0, 91]]],
      [348, 394, [[0, 91]]],
      [358, 394, [[0, 42]]],
      [320, 394, [[0, 91]]],
      [323, 394, [[0, 91]]],
      [394, 396, [[0, 91]]],
      [394, 975, [[0, 91]]],
      [320, 323, [[0, 91]]],
      [320, 379, [[0, 91]]],
      [320, 382, [[0, 91]]],
      [320, 754, [[0, 91]]],
      [320, 939, [[0, 3]]],
      [320, 940, [[0, 42]]],
      [320, 972, [[0, 42]]],
      [315, 323, [[0, 42]]],
      [323, 362, [[0, 42]]],
      [323, 751, [[0, 91]]],
      [323, 754, [[0, 91]]],
      [323, 952, [[0, 42]]],
      [315, 358, [[0, 42]]],
      [355, 751, [[0, 42]]],
      [358, 751, [[0, 42]]],
      [751, 754, [[0, 91]]],
      [597, 754, [[0, 3]]],
      [754, 757, [[0, 91]]],
      [360, 757, [[0, 91]]],
      [940, 952, [[0, 42]]],
      [952, 972, [[0, 42]]],
      [940, 972, [[0, 42]]],
      [358, 972, [[0, 42]]],
      [350, 379, [[0, 91]]],
      [379, 380, [[0, 91]]],
      [379, 382, [[0, 91]]],
      [379, 384, [[0, 91]]],
      [379, 387, [[0, 91]]],
      [357, 379, [[0, 91]]],
      [319, 379, [[0, 91]]],
      [360, 379, [[0, 91]]],
      [368, 379, [[0, 91]]],
      [323, 379, [[0, 91]]],
      [379, 396, [[0, 91]]],
      [350, 394, [[0, 91]]],
      [350, 380, [[0, 91]]],
      [374, 380, [[0, 91]]],
      [378, 380, [[0, 91]]],
      [380, 382, [[0, 91]]],
      [310, 380, [[0, 91]]],
      [320, 380, [[0, 91]]],
      [323, 380, [[0, 91]]],
      [373, 380, [[0, 91]]],
      [380, 391, [[0, 91]]],
      [380, 389, [[0, 91]]],
      [380, 398, [[0, 91]]],
      [374, 379, [[0, 91]]],
      [358, 374, [[0, 42]]],
      [319, 374, [[0, 91]]],
      [320, 374, [[0, 91]]],
      [323, 374, [[0, 91]]],
      [373, 374, [[0, 91]]],
      [360, 373, [[0, 91]]],
      [374, 378, [[0, 91]]],
      [375, 378, [[0, 91]]],
      [377, 378, [[0, 91]]],
      [378, 379, [[0, 91]]],
      [378, 382, [[0, 91]]],
      [326, 378, [[0, 91]]],
      [355, 378, [[0, 42]]],
      [358, 378, [[0, 42]]],
      [360, 378, [[0, 91]]],
      [362, 378, [[0, 42]]],
      [378, 394, [[0, 91]]],
      [375, 382, [[0, 91]]],
      [375, 383, [[0, 91]]],
      [358, 375, [[0, 42]]],
      [319, 375, [[0, 91]]],
      [320, 375, [[0, 91]]],
      [323, 375, [[0, 91]]],
      [373, 375, [[0, 91]]],
      [350, 382, [[0, 91]]],
      [382, 383, [[0, 91]]],
      [382, 384, [[0, 91]]],
      [382, 387, [[0, 91]]],
      [358, 382, [[0, 42]]],
      [319, 382, [[0, 91]]],
      [360, 382, [[0, 91]]],
      [323, 382, [[0, 91]]],
      [379, 383, [[0, 91]]],
      [378, 383, [[0, 91]]],
      [310, 383, [[0, 91]]],
      [320, 383, [[0, 91]]],
      [323, 383, [[0, 91]]],
      [383, 391, [[0, 91]]],
      [383, 389, [[0, 91]]],
      [383, 394, [[0, 91]]],
      [383, 398, [[0, 91]]],
      [310, 344, [[0, 42]]],
      [310, 358, [[0, 42]]],
      [310, 391, [[0, 91]]],
      [344, 362, [[0, 42]]],
      [318, 391, [[0, 91]]],
      [358, 389, [[0, 42]]],
      [389, 394, [[0, 91]]],
      [358, 398, [[0, 42]]],
      [373, 398, [[0, 91]]],
      [380, 384, [[0, 91]]],
      [383, 384, [[0, 91]]],
      [347, 384, [[0, 91]]],
      [351, 384, [[0, 42]]],
      [355, 384, [[0, 42]]],
      [358, 384, [[0, 42]]],
      [317, 384, [[0, 91]]],
      [319, 384, [[0, 91]]],
      [360, 384, [[0, 91]]],
      [320, 384, [[0, 91]]],
      [366, 384, [[0, 42]]],
      [323, 384, [[0, 91]]],
      [384, 391, [[0, 91]]],
      [384, 394, [[0, 91]]],
      [351, 358, [[0, 42]]],
      [355, 366, [[0, 42]]],
      [358, 366, [[0, 42]]],
      [377, 387, [[0, 91]]],
      [380, 387, [[0, 91]]],
      [381, 387, [[0, 91]]],
      [383, 387, [[0, 91]]],
      [358, 387, [[0, 42]]],
      [318, 387, [[0, 91]]],
      [319, 387, [[0, 91]]],
      [320, 387, [[0, 91]]],
      [368, 387, [[0, 91]]],
      [323, 387, [[0, 91]]],
      [373, 387, [[0, 91]]],
      [387, 394, [[0, 91]]],
      [314, 377, [[0, 91]]],
      [376, 381, [[0, 91]]],
      [381, 385, [[0, 91]]],
      [379, 381, [[0, 91]]],
      [230, 381, [[0, 91]]],
      [233, 381, [[0, 91]]],
      [242, 381, [[0, 91]]],
      [244, 381, [[0, 91]]],
      [358, 381, [[0, 42]]],
      [314, 381, [[0, 91]]],
      [316, 381, [[0, 42]]],
      [319, 381, [[0, 91]]],
      [320, 381, [[0, 91]]],
      [363, 381, [[0, 91]]],
      [364, 381, [[0, 91]]],
      [377, 381, [[0, 91]]],
      [381, 394, [[0, 91]]],
      [381, 396, [[0, 91]]],
      [381, 403, [[0, 91]]],
      [381, 404, [[0, 91]]],
      [381, 438, [[0, 91]]],
      [381, 949, [[0, 91]]],
      [381, 960, [[0, 91]]],
      [381, 975, [[0, 91]]],
      [376, 377, [[0, 91]]],
      [358, 376, [[0, 42]]],
      [314, 376, [[0, 91]]],
      [319, 376, [[0, 91]]],
      [320, 376, [[0, 91]]],
      [368, 376, [[0, 91]]],
      [376, 960, [[0, 91]]],
      [358, 368, [[0, 42]]],
      [320, 368, [[0, 91]]],
      [368, 940, [[0, 42]]],
      [349, 960, [[0, 91]]],
      [396, 960, [[0, 91]]],
      [960, 976, [[0, 91]]],
      [960, 978, [[0, 91]]],
      [320, 349, [[0, 91]]],
      [349, 597, [[0, 3]]],
      [391, 396, [[0, 91]]],
      [396, 976, [[0, 91]]],
      [396, 978, [[0, 91]]],
      [976, 978, [[0, 91]]],
      [360, 385, [[0, 91]]],
      [385, 396, [[0, 91]]],
      [385, 960, [[0, 91]]],
      [228, 230, [[0, 91]]],
      [230, 233, [[0, 91]]],
      [230, 360, [[0, 91]]],
      [230, 379, [[0, 91]]],
      [228, 360, [[0, 91]]],
      [228, 396, [[0, 91]]],
      [232, 233, [[0, 91]]],
      [233, 360, [[0, 91]]],
      [232, 358, [[0, 42]]],
      [232, 360, [[0, 91]]],
      [241, 242, [[0, 91]]],
      [242, 319, [[0, 91]]],
      [241, 319, [[0, 91]]],
      [241, 244, [[0, 91]]],
      [243, 244, [[0, 91]]],
      [244, 319, [[0, 91]]],
      [244, 396, [[0, 91]]],
      [241, 243, [[0, 91]]],
      [243, 319, [[0, 91]]],
      [316, 355, [[0, 42]]],
      [315, 316, [[0, 42]]],
      [347, 363, [[0, 91]]],
      [358, 363, [[0, 42]]],
      [320, 363, [[0, 91]]],
      [363, 365, [[0, 91]]],
      [363, 368, [[0, 91]]],
      [363, 379, [[0, 91]]],
      [363, 382, [[0, 91]]],
      [363, 387, [[0, 91]]],
      [363, 396, [[0, 91]]],
      [363, 399, [[0, 91]]],
      [365, 366, [[0, 42]]],
      [347, 365, [[0, 91]]],
      [358, 365, [[0, 42]]],
      [319, 365, [[0, 91]]],
      [360, 365, [[0, 91]]],
      [362, 365, [[0, 42]]],
      [365, 379, [[0, 91]]],
      [365, 382, [[0, 91]]],
      [360, 399, [[0, 91]]],
      [347, 364, [[0, 91]]],
      [358, 364, [[0, 42]]],
      [320, 364, [[0, 91]]],
      [364, 365, [[0, 91]]],
      [364, 368, [[0, 91]]],
      [364, 379, [[0, 91]]],
      [364, 382, [[0, 91]]],
      [364, 387, [[0, 91]]],
      [364, 399, [[0, 91]]],
      [358, 403, [[0, 42]]],
      [396, 403, [[0, 91]]],
      [319, 404, [[0, 91]]],
      [396, 404, [[0, 91]]],
      [404, 960, [[0, 91]]],
      [405, 438, [[0, 91]]],
      [407, 438, [[0, 91]]],
      [408, 438, [[0, 91]]],
      [410, 438, [[0, 91]]],
      [409, 438, [[0, 91]]],
      [411, 438, [[0, 91]]],
      [412, 438, [[0, 91]]],
      [414, 438, [[0, 91]]],
      [413, 438, [[0, 91]]],
      [415, 438, [[0, 91]]],
      [416, 438, [[0, 91]]],
      [417, 438, [[0, 91]]],
      [418, 438, [[0, 91]]],
      [419, 438, [[0, 91]]],
      [420, 438, [[0, 91]]],
      [421, 438, [[0, 91]]],
      [422, 438, [[0, 91]]],
      [423, 438, [[0, 91]]],
      [424, 438, [[0, 91]]],
      [426, 438, [[0, 91]]],
      [427, 438, [[0, 91]]],
      [428, 438, [[0, 91]]],
      [429, 438, [[0, 91]]],
      [430, 438, [[0, 91]]],
      [431, 438, [[0, 91]]],
      [432, 438, [[0, 91]]],
      [434, 438, [[0, 91]]],
      [433, 438, [[0, 91]]],
      [435, 438, [[0, 91]]],
      [436, 438, [[0, 91]]],
      [396, 438, [[0, 91]]],
      [403, 438, [[0, 91]]],
      [405, 407, [[0, 91]]],
      [319, 405, [[0, 91]]],
      [396, 405, [[0, 91]]],
      [347, 407, [[0, 91]]],
      [355, 407, [[0, 42]]],
      [358, 407, [[0, 42]]],
      [361, 407, [[0, 91]]],
      [391, 407, [[0, 91]]],
      [396, 407, [[0, 91]]],
      [404, 407, [[0, 91]]],
      [407, 960, [[0, 91]]],
      [407, 978, [[0, 91]]],
      [407, 408, [[0, 91]]],
      [396, 408, [[0, 91]]],
      [396, 410, [[0, 91]]],
      [407, 410, [[0, 91]]],
      [396, 409, [[0, 91]]],
      [407, 409, [[0, 91]]],
      [407, 411, [[0, 91]]],
      [319, 411, [[0, 91]]],
      [396, 411, [[0, 91]]],
      [396, 412, [[0, 91]]],
      [412, 437, [[0, 91]]],
      [396, 437, [[0, 91]]],
      [407, 437, [[0, 91]]],
      [396, 414, [[0, 91]]],
      [407, 414, [[0, 91]]],
      [396, 413, [[0, 91]]],
      [407, 413, [[0, 91]]],
      [406, 415, [[0, 91]]],
      [407, 415, [[0, 91]]],
      [358, 415, [[0, 42]]],
      [319, 415, [[0, 91]]],
      [360, 415, [[0, 91]]],
      [396, 415, [[0, 91]]],
      [399, 415, [[0, 91]]],
      [404, 415, [[0, 91]]],
      [406, 407, [[0, 91]]],
      [396, 406, [[0, 91]]],
      [396, 416, [[0, 91]]],
      [416, 437, [[0, 91]]],
      [396, 417, [[0, 91]]],
      [407, 417, [[0, 91]]],
      [396, 418, [[0, 91]]],
      [418, 437, [[0, 91]]],
      [396, 419, [[0, 91]]],
      [419, 437, [[0, 91]]],
      [407, 420, [[0, 91]]],
      [396, 420, [[0, 91]]],
      [404, 420, [[0, 91]]],
      [396, 421, [[0, 91]]],
      [421, 437, [[0, 91]]],
      [396, 422, [[0, 91]]],
      [407, 422, [[0, 91]]],
      [407, 423, [[0, 91]]],
      [396, 423, [[0, 91]]],
      [404, 423, [[0, 91]]],
      [407, 424, [[0, 91]]],
      [319, 424, [[0, 91]]],
      [396, 424, [[0, 91]]],
      [396, 426, [[0, 91]]],
      [426, 437, [[0, 91]]],
      [396, 427, [[0, 91]]],
      [427, 437, [[0, 91]]],
      [406, 428, [[0, 91]]],
      [407, 428, [[0, 91]]],
      [396, 428, [[0, 91]]],
      [404, 428, [[0, 91]]],
      [396, 429, [[0, 91]]],
      [407, 429, [[0, 91]]],
      [396, 430, [[0, 91]]],
      [407, 430, [[0, 91]]],
      [396, 431, [[0, 91]]],
      [431, 437, [[0, 91]]],
      [407, 432, [[0, 91]]],
      [396, 432, [[0, 91]]],
      [404, 432, [[0, 91]]],
      [396, 434, [[0, 91]]],
      [407, 434, [[0, 91]]],
      [407, 433, [[0, 91]]],
      [319, 433, [[0, 91]]],
      [396, 433, [[0, 91]]],
      [396, 435, [[0, 91]]],
      [407, 435, [[0, 91]]],
      [396, 436, [[0, 91]]],
      [407, 436, [[0, 91]]],
      [225, 949, [[0, 91]]],
      [228, 949, [[0, 91]]],
      [242, 949, [[0, 91]]],
      [360, 949, [[0, 91]]],
      [373, 949, [[0, 91]]],
      [225, 242, [[0, 91]]],
      [358, 975, [[0, 42]]],
      [353, 357, [[0, 91]]],
      [319, 357, [[0, 91]]],
      [357, 360, [[0, 91]]],
      [357, 396, [[0, 91]]],
      [353, 358, [[0, 42]]],
      [319, 353, [[0, 91]]],
      [320, 353, [[0, 91]]],
      [353, 377, [[0, 91]]],
      [353, 394, [[0, 91]]],
      [597, 939, [[0, 3]]],
      [353, 356, [[0, 91]]],
      [356, 377, [[0, 91]]],
      [356, 379, [[0, 91]]],
      [356, 381, [[0, 91]]],
      [356, 382, [[0, 91]]],
      [356, 396, [[0, 91]]],
      [320, 359, [[0, 91]]],
      [359, 394, [[0, 91]]],
      [359, 593, [[0, 3]]],
      [359, 940, [[0, 42]]],
      [320, 321, [[0, 91]]],
      [358, 370, [[0, 42]]],
      [370, 403, [[0, 91]]],
      [370, 404, [[0, 91]]],
      [370, 407, [[0, 91]]],
      [370, 396, [[0, 91]]],
      [370, 438, [[0, 91]]],
      [370, 960, [[0, 91]]],
      [320, 372, [[0, 91]]],
      [372, 394, [[0, 91]]],
      [372, 940, [[0, 42]]],
      [350, 386, [[0, 91]]],
      [359, 386, [[0, 91]]],
      [386, 394, [[0, 91]]],
      [386, 975, [[0, 91]]],
      [358, 388, [[0, 42]]],
      [319, 388, [[0, 91]]],
      [360, 388, [[0, 91]]],
      [388, 394, [[0, 91]]],
      [401, 402, [[0, 91]]],
      [402, 547, [[0, 91]]],
      [402, 593, [[0, 3]]],
      [396, 401, [[0, 91]]],
      [360, 547, [[0, 91]]],
      [221, 222, [[0, 91]]],
      [221, 319, [[0, 91]]],
      [221, 370, [[0, 91]]],
      [221, 377, [[0, 91]]],
      [221, 396, [[0, 91]]],
      [221, 403, [[0, 91]]],
      [221, 404, [[0, 91]]],
      [221, 597, [[0, 3]]],
      [221, 949, [[0, 91]]],
      [221, 960, [[0, 91]]],
      [222, 358, [[0, 42]]],
      [222, 314, [[0, 91]]],
      [222, 751, [[0, 91]]],
      [222, 946, [[0, 91]]],
      [222, 975, [[0, 91]]],
      [946, 975, [[0, 91]]],
      [223, 358, [[0, 42]]],
      [223, 360, [[0, 91]]],
      [223, 396, [[0, 91]]],
      [223, 960, [[0, 91]]],
      [234, 939, [[0, 3]]],
      [360, 744, [[0, 91]]],
      [744, 754, [[0, 91]]],
      [929, 949, [[0, 91]]],
      [929, 960, [[0, 91]]],
      [319, 929, [[0, 91]]],
      [350, 933, [[0, 91]]],
      [933, 951, [[0, 91]]],
      [937, 951, [[0, 91]]],
      [984, 1003, [[0, 91]]],
      [228, 984, [[0, 91]]],
      [360, 984, [[0, 91]]],
      [975, 984, [[0, 91]]],
      [360, 1003, [[0, 91]]],
      [338, 358, [[0, 42]]],
      [314, 338, [[0, 91]]],
      [323, 338, [[0, 91]]],
      [338, 754, [[0, 91]]],
      [314, 339, [[0, 91]]],
      [320, 339, [[0, 91]]],
      [339, 403, [[0, 91]]],
      [339, 340, [[0, 91]]],
      [339, 341, [[0, 91]]],
      [339, 939, [[0, 3]]],
      [340, 358, [[0, 42]]],
      [315, 340, [[0, 42]]],
      [320, 340, [[0, 91]]],
      [340, 362, [[0, 42]]],
      [340, 403, [[0, 91]]],
      [341, 358, [[0, 42]]],
      [314, 341, [[0, 91]]],
      [341, 360, [[0, 91]]],
      [320, 341, [[0, 91]]],
      [341, 368, [[0, 91]]],
      [341, 747, [[0, 91]]],
      [358, 747, [[0, 42]]],
      [314, 747, [[0, 91]]],
      [360, 747, [[0, 91]]],
      [369, 747, [[0, 91]]],
      [744, 747, [[0, 91]]],
      [747, 754, [[0, 91]]],
      [358, 369, [[0, 42]]],
      [320, 369, [[0, 91]]],
      [368, 369, [[0, 91]]],
      [369, 394, [[0, 91]]],
      [342, 358, [[0, 42]]],
      [314, 342, [[0, 91]]],
      [320, 342, [[0, 91]]],
      [323, 342, [[0, 91]]],
      [342, 391, [[0, 91]]],
      [342, 939, [[0, 3]]],
      [345, 358, [[0, 42]]],
      [314, 345, [[0, 91]]],
      [318, 345, [[0, 91]]],
      [319, 345, [[0, 91]]],
      [320, 345, [[0, 91]]],
      [345, 362, [[0, 42]]],
      [323, 345, [[0, 91]]],
      [345, 380, [[0, 91]]],
      [345, 383, [[0, 91]]],
      [345, 391, [[0, 91]]],
      [338, 345, [[0, 91]]],
      [339, 345, [[0, 91]]],
      [331, 358, [[0, 42]]],
      [314, 331, [[0, 91]]],
      [331, 746, [[0, 91]]],
      [358, 746, [[0, 42]]],
      [314, 746, [[0, 91]]],
      [360, 746, [[0, 91]]],
      [380, 746, [[0, 91]]],
      [378, 746, [[0, 91]]],
      [383, 746, [[0, 91]]],
      [352, 358, [[0, 42]]],
      [314, 352, [[0, 91]]],
      [316, 352, [[0, 42]]],
      [318, 352, [[0, 91]]],
      [319, 352, [[0, 91]]],
      [352, 377, [[0, 91]]],
      [352, 381, [[0, 91]]],
      [352, 391, [[0, 91]]],
      [358, 397, [[0, 42]]],
      [319, 397, [[0, 91]]],
      [358, 400, [[0, 42]]],
      [360, 400, [[0, 91]]],
      [358, 745, [[0, 42]]],
      [360, 745, [[0, 91]]],
      [320, 745, [[0, 91]]],
      [323, 745, [[0, 91]]],
      [745, 754, [[0, 91]]],
      [313, 748, [[0, 91]]],
      [360, 752, [[0, 91]]],
      [752, 754, [[0, 91]]],
      [312, 358, [[0, 42]]],
      [312, 360, [[0, 91]]],
      [312, 362, [[0, 42]]],
      [358, 367, [[0, 42]]],
      [363, 367, [[0, 91]]],
      [364, 367, [[0, 91]]],
      [367, 403, [[0, 91]]],
      [315, 371, [[0, 42]]],
      [328, 329, [[0, 91]]],
      [234, 329, [[0, 3]]],
      [329, 358, [[0, 42]]],
      [319, 329, [[0, 91]]],
      [320, 329, [[0, 91]]],
      [323, 329, [[0, 91]]],
      [329, 379, [[0, 91]]],
      [329, 389, [[0, 91]]],
      [329, 394, [[0, 91]]],
      [330, 332, [[0, 91]]],
      [234, 332, [[0, 3]]],
      [332, 358, [[0, 42]]],
      [319, 332, [[0, 91]]],
      [320, 332, [[0, 91]]],
      [323, 332, [[0, 91]]],
      [332, 379, [[0, 91]]],
      [332, 380, [[0, 91]]],
      [332, 389, [[0, 91]]],
      [332, 939, [[0, 3]]],
      [330, 333, [[0, 91]]],
      [333, 358, [[0, 42]]],
      [319, 333, [[0, 91]]],
      [320, 333, [[0, 91]]],
      [323, 333, [[0, 91]]],
      [333, 382, [[0, 91]]],
      [333, 389, [[0, 91]]],
      [330, 334, [[0, 91]]],
      [234, 334, [[0, 3]]],
      [334, 354, [[0, 91]]],
      [334, 358, [[0, 42]]],
      [319, 334, [[0, 91]]],
      [320, 334, [[0, 91]]],
      [323, 334, [[0, 91]]],
      [334, 382, [[0, 91]]],
      [334, 383, [[0, 91]]],
      [334, 389, [[0, 91]]],
      [334, 394, [[0, 91]]],
      [334, 939, [[0, 3]]],
      [333, 335, [[0, 91]]],
      [335, 336, [[0, 91]]],
      [234, 335, [[0, 3]]],
      [319, 335, [[0, 91]]],
      [335, 360, [[0, 91]]],
      [323, 335, [[0, 91]]],
      [335, 939, [[0, 3]]],
      [330, 336, [[0, 91]]],
      [336, 354, [[0, 91]]],
      [336, 358, [[0, 42]]],
      [319, 336, [[0, 91]]],
      [323, 336, [[0, 91]]],
      [336, 379, [[0, 91]]],
      [336, 389, [[0, 91]]],
      [336, 394, [[0, 91]]],
      [558, 590, [[0, 91]]],
      [558, 652, [[0, 3]]],
      [590, 873, [[0, 91]]],
      [314, 652, [[0, 3]]],
      [394, 652, [[0, 3]]],
      [396, 652, [[0, 3]]],
      [652, 975, [[0, 3]]],
      [
        873,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [874, 879, [[0, 3]]],
      [
        874,
        890,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        874,
        891,
        [
          [0, 78],
          [80, 80],
          [89, 91]
        ]
      ],
      [
        874,
        892,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        900,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        903,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        905,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        128,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        139,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        202,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [226, 874, [[0, 3]]],
      [230, 874, [[0, 3]]],
      [237, 874, [[0, 3]]],
      [
        274,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [349, 874, [[0, 3]]],
      [358, 874, [[0, 3]]],
      [360, 874, [[0, 3]]],
      [362, 874, [[0, 3]]],
      [396, 874, [[0, 3]]],
      [
        470,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        503,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        506,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        531,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        535,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        537,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [538, 874, [[0, 3]]],
      [
        543,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        545,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [546, 874, [[0, 3]]],
      [547, 874, [[0, 3]]],
      [
        548,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        549,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        551,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        558,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        582,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [593, 874, [[0, 3]]],
      [
        594,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [596, 874, [[0, 3]]],
      [597, 874, [[0, 3]]],
      [599, 874, [[0, 3]]],
      [
        604,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [605, 874, [[0, 12]]],
      [607, 874, [[0, 3]]],
      [
        609,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        611,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        612,
        874,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        618,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        651,
        874,
        [
          [0, 3],
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [652, 874, [[0, 3]]],
      [
        730,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [738, 874, [[0, 3]]],
      [
        740,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        750,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [797, 874, [[0, 3]]],
      [
        874,
        877,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [874, 880, [[0, 27]]],
      [
        874,
        888,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        874,
        909,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        911,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        913,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        919,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        923,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        930,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [874, 931, [[0, 27]]],
      [
        874,
        934,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        935,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        936,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        938,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        874,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        874,
        948,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        954,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        955,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        959,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [874, 960, [[0, 3]]],
      [
        874,
        967,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        970,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        874,
        982,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        874,
        983,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [874, 984, [[0, 3]]],
      [
        874,
        987,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [874, 988, [[0, 3]]],
      [874, 989, [[0, 3]]],
      [874, 1005, [[0, 3]]],
      [652, 879, [[0, 3]]],
      [
        873,
        890,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [882, 890, [[0, 3]]],
      [349, 890, [[0, 3]]],
      [360, 890, [[0, 3]]],
      [396, 890, [[0, 3]]],
      [652, 882, [[0, 3]]],
      [882, 973, [[0, 3]]],
      [652, 973, [[0, 3]]],
      [891, 904, [[0, 3]]],
      [226, 891, [[0, 3]]],
      [230, 891, [[0, 3]]],
      [360, 891, [[0, 3]]],
      [396, 891, [[0, 3]]],
      [
        582,
        891,
        [
          [0, 78],
          [80, 80],
          [89, 91]
        ]
      ],
      [360, 904, [[0, 3]]],
      [396, 904, [[0, 3]]],
      [404, 904, [[0, 3]]],
      [904, 976, [[0, 3]]],
      [226, 233, [[0, 3]]],
      [226, 358, [[0, 3]]],
      [226, 360, [[0, 3]]],
      [226, 396, [[0, 3]]],
      [226, 960, [[0, 3]]],
      [582, 593, [[0, 3]]],
      [582, 599, [[0, 3]]],
      [
        582,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [582, 977, [[0, 23]]],
      [
        947,
        977,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        974,
        977,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [226, 947, [[0, 3]]],
      [230, 947, [[0, 3]]],
      [237, 947, [[0, 3]]],
      [360, 947, [[0, 3]]],
      [
        582,
        947,
        [
          [0, 80],
          [83, 86],
          [89, 91]
        ]
      ],
      [872, 947, [[0, 3]]],
      [
        917,
        947,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        947,
        955,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        947,
        1002,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [237, 976, [[0, 3]]],
      [870, 872, [[0, 3]]],
      [597, 870, [[0, 3]]],
      [360, 955, [[0, 3]]],
      [
        582,
        955,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [609, 955, [[0, 91]]],
      [
        617,
        955,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [618, 955, [[0, 91]]],
      [652, 955, [[0, 3]]],
      [739, 955, [[0, 91]]],
      [
        873,
        955,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        909,
        955,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [934, 955, [[0, 91]]],
      [
        955,
        957,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [189, 609, [[0, 91]]],
      [360, 609, [[0, 3]]],
      [537, 609, [[0, 91]]],
      [545, 609, [[0, 91]]],
      [
        549,
        609,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        582,
        609,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [593, 609, [[0, 3]]],
      [597, 609, [[0, 3]]],
      [
        609,
        611,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [609, 613, [[0, 3]]],
      [609, 614, [[0, 3]]],
      [609, 618, [[0, 91]]],
      [
        609,
        620,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [609, 652, [[0, 3]]],
      [609, 760, [[0, 91]]],
      [609, 879, [[0, 3]]],
      [
        609,
        909,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [609, 924, [[0, 91]]],
      [609, 931, [[0, 27]]],
      [609, 934, [[0, 91]]],
      [609, 948, [[0, 91]]],
      [609, 954, [[0, 91]]],
      [609, 967, [[0, 91]]],
      [189, 618, [[0, 91]]],
      [
        617,
        618,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [360, 618, [[0, 3]]],
      [613, 618, [[0, 3]]],
      [
        618,
        620,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [618, 652, [[0, 3]]],
      [618, 760, [[0, 91]]],
      [
        618,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 879, [[0, 3]]],
      [618, 935, [[0, 91]]],
      [
        618,
        1001,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 1003, [[0, 3]]],
      [538, 617, [[0, 3]]],
      [546, 617, [[0, 3]]],
      [
        582,
        617,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [597, 617, [[0, 3]]],
      [
        617,
        620,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [617, 652, [[0, 3]]],
      [
        617,
        877,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        617,
        909,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        617,
        957,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        617,
        969,
        [
          [0, 12],
          [85, 88]
        ]
      ],
      [228, 538, [[0, 3]]],
      [228, 546, [[0, 3]]],
      [597, 620, [[0, 3]]],
      [
        620,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        873,
        877,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [360, 877, [[0, 3]]],
      [
        558,
        877,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 877, [[0, 91]]],
      [652, 877, [[0, 3]]],
      [778, 877, [[0, 27]]],
      [877, 935, [[0, 91]]],
      [877, 948, [[0, 91]]],
      [877, 954, [[0, 91]]],
      [877, 987, [[0, 91]]],
      [777, 778, [[0, 65]]],
      [319, 777, [[0, 3]]],
      [618, 777, [[0, 65]]],
      [762, 777, [[0, 3]]],
      [763, 777, [[0, 65]]],
      [765, 777, [[0, 3]]],
      [777, 948, [[0, 65]]],
      [319, 762, [[0, 3]]],
      [762, 764, [[0, 3]]],
      [762, 767, [[0, 3]]],
      [239, 764, [[0, 3]]],
      [319, 764, [[0, 3]]],
      [239, 360, [[0, 3]]],
      [239, 960, [[0, 3]]],
      [239, 976, [[0, 3]]],
      [319, 767, [[0, 3]]],
      [767, 1003, [[0, 3]]],
      [319, 763, [[0, 3]]],
      [763, 764, [[0, 3]]],
      [763, 767, [[0, 3]]],
      [763, 873, [[0, 65]]],
      [763, 874, [[0, 65]]],
      [319, 765, [[0, 3]]],
      [762, 765, [[0, 3]]],
      [360, 948, [[0, 3]]],
      [
        558,
        948,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 948, [[0, 91]]],
      [
        873,
        948,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        903,
        948,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        948,
        979,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [948, 984, [[0, 3]]],
      [948, 987, [[0, 91]]],
      [
        948,
        993,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        873,
        903,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [892, 903, [[0, 23]]],
      [903, 999, [[0, 3]]],
      [
        873,
        892,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [892, 898, [[0, 23]]],
      [892, 901, [[0, 91]]],
      [892, 902, [[0, 23]]],
      [
        204,
        892,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        558,
        892,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        559,
        892,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        579,
        892,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        582,
        892,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [593, 892, [[0, 3]]],
      [
        892,
        913,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [892, 930, [[0, 91]]],
      [
        892,
        948,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        892,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [898, 901, [[0, 23]]],
      [
        582,
        901,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        874,
        901,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        189,
        204,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [204, 593, [[0, 3]]],
      [204, 599, [[0, 3]]],
      [204, 603, [[0, 3]]],
      [
        204,
        604,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [599, 603, [[0, 3]]],
      [599, 604, [[0, 3]]],
      [
        604,
        618,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        604,
        641,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        604,
        947,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [604, 984, [[0, 3]]],
      [
        641,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [559, 560, [[0, 91]]],
      [558, 559, [[0, 91]]],
      [559, 652, [[0, 3]]],
      [558, 560, [[0, 91]]],
      [572, 579, [[0, 16]]],
      [
        579,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [34, 572, [[0, 16]]],
      [123, 572, [[0, 16]]],
      [569, 572, [[0, 16]]],
      [572, 575, [[0, 16]]],
      [572, 576, [[0, 16]]],
      [572, 577, [[0, 16]]],
      [572, 578, [[0, 16]]],
      [572, 582, [[0, 16]]],
      [572, 598, [[0, 3]]],
      [572, 730, [[0, 16]]],
      [572, 1002, [[0, 16]]],
      [34, 958, [[0, 16]]],
      [873, 958, [[0, 16]]],
      [
        122,
        123,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        125,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        126,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        506,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        512,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [123, 513, [[0, 3]]],
      [123, 562, [[0, 3]]],
      [
        123,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        123,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        122,
        512,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [122, 513, [[0, 3]]],
      [
        122,
        654,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        125,
        512,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        197,
        512,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [502, 512, [[0, 91]]],
      [
        512,
        515,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [512, 593, [[0, 3]]],
      [512, 599, [[0, 3]]],
      [
        512,
        661,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [512, 673, [[0, 91]]],
      [512, 674, [[0, 91]]],
      [
        512,
        716,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        512,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        512,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        512,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        512,
        735,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        512,
        909,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        512,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        120,
        125,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        122,
        125,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        125,
        197,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        125,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        120,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        110,
        502,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        502,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        498,
        502,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [500, 502, [[0, 91]]],
      [502, 593, [[0, 3]]],
      [502, 599, [[0, 3]]],
      [
        502,
        930,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        110,
        111,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        110,
        969,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        111,
        969,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        498,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        498,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [498, 513, [[0, 3]]],
      [498, 520, [[0, 3]]],
      [
        498,
        521,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [498, 522, [[0, 3]]],
      [498, 593, [[0, 3]]],
      [498, 599, [[0, 3]]],
      [
        498,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [498, 602, [[0, 3]]],
      [
        498,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        498,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        121,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        123,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        116,
        129,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [116, 593, [[0, 3]]],
      [116, 599, [[0, 3]]],
      [
        116,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        609,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        618,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        909,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        121,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        129,
        908,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [218, 908, [[0, 3]]],
      [
        492,
        908,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        908,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [908, 1003, [[0, 3]]],
      [
        600,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        600,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        25,
        909,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [26, 909, [[0, 91]]],
      [27, 909, [[0, 91]]],
      [
        28,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        46,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        29,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        30,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        123,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [495, 909, [[0, 3]]],
      [
        514,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        529,
        909,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        561,
        909,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [562, 909, [[0, 3]]],
      [593, 909, [[0, 3]]],
      [597, 909, [[0, 3]]],
      [599, 909, [[0, 3]]],
      [
        626,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        654,
        909,
        [
          [0, 81],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        680,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        681,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        682,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        684,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        686,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        687,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        688,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        689,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        690,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        691,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        692,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        693,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        677,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        707,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        710,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        730,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        873,
        909,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        25,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        26,
        579,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        26,
        582,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [27, 31, [[0, 3]]],
      [27, 524, [[0, 91]]],
      [
        27,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [27, 593, [[0, 3]]],
      [
        27,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        27,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [27, 930, [[0, 91]]],
      [
        27,
        956,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [27, 980, [[0, 3]]],
      [31, 593, [[0, 3]]],
      [
        524,
        525,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [524, 526, [[0, 91]]],
      [
        524,
        527,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        524,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        524,
        530,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        525,
        528,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        525,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        528,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [529, 538, [[0, 3]]],
      [529, 546, [[0, 3]]],
      [
        529,
        558,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [529, 969, [[0, 12]]],
      [
        526,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [526, 534, [[0, 3]]],
      [
        526,
        541,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [534, 538, [[0, 3]]],
      [
        541,
        544,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [541, 546, [[0, 3]]],
      [544, 546, [[0, 3]]],
      [226, 544, [[0, 3]]],
      [228, 544, [[0, 3]]],
      [230, 544, [[0, 3]]],
      [231, 544, [[0, 3]]],
      [235, 544, [[0, 3]]],
      [314, 544, [[0, 3]]],
      [319, 544, [[0, 3]]],
      [396, 544, [[0, 3]]],
      [544, 610, [[0, 3]]],
      [544, 652, [[0, 3]]],
      [
        544,
        927,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [544, 984, [[0, 3]]],
      [
        544,
        987,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [226, 231, [[0, 3]]],
      [230, 231, [[0, 3]]],
      [231, 358, [[0, 3]]],
      [231, 360, [[0, 3]]],
      [231, 396, [[0, 3]]],
      [231, 984, [[0, 3]]],
      [235, 396, [[0, 3]]],
      [610, 652, [[0, 3]]],
      [
        925,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        927,
        944,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [927, 950, [[0, 91]]],
      [
        197,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [454, 927, [[0, 91]]],
      [
        462,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        471,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        560,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        873,
        927,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        558,
        925,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        590,
        925,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        873,
        925,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        944,
        947,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        558,
        950,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        559,
        950,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        560,
        950,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        582,
        950,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        873,
        950,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        874,
        950,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [911, 950, [[0, 91]]],
      [912, 950, [[0, 91]]],
      [935, 950, [[0, 91]]],
      [948, 950, [[0, 91]]],
      [
        950,
        953,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        950,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [266, 911, [[0, 65]]],
      [
        118,
        911,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [346, 911, [[0, 3]]],
      [
        582,
        911,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [596, 911, [[0, 3]]],
      [597, 911, [[0, 3]]],
      [873, 911, [[0, 65]]],
      [
        911,
        930,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        911,
        936,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [911, 942, [[0, 91]]],
      [911, 959, [[0, 91]]],
      [
        911,
        962,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        911,
        969,
        [
          [0, 84],
          [89, 91]
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
      [245, 554, [[0, 65]]],
      [245, 562, [[0, 3]]],
      [245, 593, [[0, 3]]],
      [245, 597, [[0, 3]]],
      [245, 599, [[0, 3]]],
      [245, 618, [[0, 65]]],
      [245, 730, [[0, 65]]],
      [245, 739, [[0, 65]]],
      [245, 769, [[0, 65]]],
      [245, 911, [[0, 65]]],
      [245, 984, [[0, 3]]],
      [245, 1007, [[0, 65]]],
      [245, 1013, [[0, 65]]],
      [245, 1016, [[0, 65]]],
      [245, 1017, [[0, 65]]],
      [245, 1018, [[0, 65]]],
      [245, 1020, [[0, 65]]],
      [552, 554, [[0, 3]]],
      [554, 555, [[0, 3]]],
      [554, 556, [[0, 3]]],
      [554, 557, [[0, 65]]],
      [554, 582, [[0, 65]]],
      [554, 593, [[0, 3]]],
      [554, 599, [[0, 3]]],
      [554, 966, [[0, 65]]],
      [552, 555, [[0, 3]]],
      [555, 599, [[0, 3]]],
      [555, 556, [[0, 3]]],
      [555, 557, [[0, 3]]],
      [189, 557, [[0, 65]]],
      [557, 924, [[0, 65]]],
      [6, 924, [[0, 24]]],
      [189, 924, [[0, 91]]],
      [233, 924, [[0, 3]]],
      [360, 924, [[0, 3]]],
      [381, 924, [[0, 3]]],
      [396, 924, [[0, 3]]],
      [
        582,
        924,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        617,
        924,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [618, 924, [[0, 91]]],
      [739, 924, [[0, 91]]],
      [
        874,
        924,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [877, 924, [[0, 91]]],
      [
        924,
        966,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [924, 987, [[0, 91]]],
      [6, 211, [[0, 24]]],
      [6, 874, [[0, 24]]],
      [6, 909, [[0, 24]]],
      [24, 211, [[0, 65]]],
      [211, 593, [[0, 3]]],
      [211, 599, [[0, 3]]],
      [211, 909, [[0, 65]]],
      [211, 921, [[0, 65]]],
      [18, 24, [[0, 65]]],
      [19, 24, [[0, 3]]],
      [24, 205, [[0, 65]]],
      [24, 218, [[0, 3]]],
      [24, 539, [[0, 65]]],
      [24, 540, [[0, 65]]],
      [24, 593, [[0, 3]]],
      [24, 597, [[0, 3]]],
      [24, 610, [[0, 3]]],
      [24, 638, [[0, 65]]],
      [24, 639, [[0, 65]]],
      [24, 640, [[0, 65]]],
      [24, 641, [[0, 65]]],
      [24, 644, [[0, 3]]],
      [24, 645, [[0, 3]]],
      [24, 647, [[0, 65]]],
      [24, 648, [[0, 3]]],
      [24, 649, [[0, 65]]],
      [18, 205, [[0, 65]]],
      [205, 582, [[0, 65]]],
      [205, 593, [[0, 3]]],
      [205, 598, [[0, 3]]],
      [205, 956, [[0, 65]]],
      [593, 598, [[0, 3]]],
      [598, 599, [[0, 3]]],
      [
        873,
        956,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [19, 20, [[0, 3]]],
      [19, 644, [[0, 3]]],
      [20, 23, [[0, 3]]],
      [20, 644, [[0, 3]]],
      [22, 23, [[0, 3]]],
      [23, 644, [[0, 3]]],
      [21, 22, [[0, 3]]],
      [22, 644, [[0, 3]]],
      [22, 646, [[0, 3]]],
      [21, 646, [[0, 3]]],
      [610, 646, [[0, 3]]],
      [644, 646, [[0, 3]]],
      [539, 873, [[0, 65]]],
      [540, 597, [[0, 3]]],
      [540, 932, [[0, 3]]],
      [
        540,
        966,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [597, 932, [[0, 3]]],
      [184, 966, [[0, 0]]],
      [185, 966, [[0, 0]]],
      [186, 966, [[0, 0]]],
      [187, 966, [[0, 0]]],
      [197, 966, [[0, 52]]],
      [455, 966, [[0, 52]]],
      [582, 966, [[0, 52]]],
      [615, 966, [[0, 0]]],
      [616, 966, [[0, 0]]],
      [
        930,
        966,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [942, 966, [[0, 0]]],
      [
        966,
        970,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [88, 184, [[0, 0]]],
      [184, 582, [[0, 0]]],
      [184, 961, [[0, 0]]],
      [184, 970, [[0, 0]]],
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
      [88, 650, [[0, 0]]],
      [88, 927, [[0, 0]]],
      [88, 997, [[0, 0]]],
      [55, 57, [[0, 65]]],
      [55, 200, [[0, 65]]],
      [55, 319, [[0, 3]]],
      [55, 914, [[0, 65]]],
      [57, 582, [[0, 65]]],
      [200, 283, [[0, 65]]],
      [200, 273, [[0, 65]]],
      [200, 274, [[0, 65]]],
      [200, 319, [[0, 3]]],
      [200, 473, [[0, 65]]],
      [200, 873, [[0, 65]]],
      [200, 914, [[0, 91]]],
      [270, 283, [[0, 3]]],
      [271, 283, [[0, 65]]],
      [273, 283, [[0, 65]]],
      [275, 283, [[0, 65]]],
      [277, 283, [[0, 65]]],
      [279, 283, [[0, 65]]],
      [280, 283, [[0, 65]]],
      [270, 287, [[0, 3]]],
      [287, 988, [[0, 3]]],
      [358, 988, [[0, 3]]],
      [271, 274, [[0, 65]]],
      [
        274,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
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
      [277, 873, [[0, 65]]],
      [277, 278, [[0, 65]]],
      [278, 582, [[0, 65]]],
      [277, 281, [[0, 65]]],
      [277, 280, [[0, 65]]],
      [278, 280, [[0, 65]]],
      [282, 287, [[0, 3]]],
      [279, 282, [[0, 65]]],
      [282, 988, [[0, 3]]],
      [274, 279, [[0, 65]]],
      [473, 474, [[0, 65]]],
      [197, 473, [[0, 65]]],
      [471, 473, [[0, 65]]],
      [473, 873, [[0, 65]]],
      [473, 927, [[0, 65]]],
      [469, 474, [[0, 65]]],
      [197, 474, [[0, 65]]],
      [474, 873, [[0, 65]]],
      [469, 652, [[0, 3]]],
      [
        469,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        558,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        197,
        471,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        471,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        471,
        944,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [199, 914, [[0, 91]]],
      [273, 914, [[0, 65]]],
      [360, 914, [[0, 3]]],
      [199, 283, [[0, 65]]],
      [199, 273, [[0, 65]]],
      [199, 274, [[0, 65]]],
      [199, 319, [[0, 3]]],
      [199, 360, [[0, 3]]],
      [199, 473, [[0, 65]]],
      [199, 582, [[0, 65]]],
      [199, 739, [[0, 65]]],
      [199, 873, [[0, 65]]],
      [199, 874, [[0, 65]]],
      [137, 739, [[0, 91]]],
      [189, 739, [[0, 91]]],
      [229, 739, [[0, 91]]],
      [358, 739, [[0, 3]]],
      [360, 739, [[0, 3]]],
      [739, 746, [[0, 3]]],
      [739, 752, [[0, 3]]],
      [739, 987, [[0, 91]]],
      [739, 994, [[0, 3]]],
      [137, 358, [[0, 3]]],
      [137, 360, [[0, 3]]],
      [137, 1020, [[0, 91]]],
      [593, 1020, [[0, 3]]],
      [599, 1020, [[0, 3]]],
      [
        617,
        1020,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [618, 1020, [[0, 91]]],
      [
        873,
        1020,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [163, 229, [[0, 3]]],
      [228, 229, [[0, 3]]],
      [229, 360, [[0, 3]]],
      [229, 373, [[0, 3]]],
      [229, 381, [[0, 3]]],
      [229, 387, [[0, 3]]],
      [229, 396, [[0, 3]]],
      [229, 913, [[0, 91]]],
      [229, 949, [[0, 3]]],
      [229, 954, [[0, 91]]],
      [229, 960, [[0, 3]]],
      [163, 360, [[0, 3]]],
      [911, 913, [[0, 91]]],
      [136, 913, [[0, 91]]],
      [137, 913, [[0, 91]]],
      [154, 913, [[0, 91]]],
      [159, 913, [[0, 36]]],
      [165, 913, [[0, 91]]],
      [166, 913, [[0, 91]]],
      [170, 913, [[0, 91]]],
      [238, 913, [[0, 91]]],
      [360, 913, [[0, 3]]],
      [394, 913, [[0, 3]]],
      [396, 913, [[0, 3]]],
      [438, 913, [[0, 3]]],
      [
        582,
        913,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 913, [[0, 91]]],
      [739, 913, [[0, 91]]],
      [
        866,
        913,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        909,
        913,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [913, 918, [[0, 3]]],
      [913, 935, [[0, 91]]],
      [
        913,
        947,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [913, 948, [[0, 91]]],
      [913, 949, [[0, 3]]],
      [913, 955, [[0, 91]]],
      [913, 959, [[0, 91]]],
      [913, 963, [[0, 91]]],
      [
        913,
        965,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [913, 987, [[0, 91]]],
      [
        913,
        1026,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [136, 360, [[0, 3]]],
      [136, 739, [[0, 91]]],
      [136, 984, [[0, 3]]],
      [136, 987, [[0, 91]]],
      [360, 987, [[0, 3]]],
      [394, 987, [[0, 3]]],
      [396, 987, [[0, 3]]],
      [
        558,
        987,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [793, 987, [[0, 91]]],
      [870, 987, [[0, 3]]],
      [739, 793, [[0, 91]]],
      [752, 793, [[0, 3]]],
      [136, 154, [[0, 91]]],
      [154, 360, [[0, 3]]],
      [154, 618, [[0, 91]]],
      [154, 739, [[0, 91]]],
      [154, 948, [[0, 91]]],
      [154, 955, [[0, 91]]],
      [64, 159, [[0, 65]]],
      [60, 159, [[0, 65]]],
      [159, 319, [[0, 3]]],
      [64, 161, [[0, 65]]],
      [155, 161, [[0, 3]]],
      [161, 360, [[0, 3]]],
      [161, 873, [[0, 65]]],
      [161, 874, [[0, 65]]],
      [161, 941, [[0, 3]]],
      [161, 948, [[0, 65]]],
      [161, 1003, [[0, 3]]],
      [155, 239, [[0, 3]]],
      [155, 360, [[0, 3]]],
      [360, 941, [[0, 3]]],
      [60, 61, [[0, 65]]],
      [60, 62, [[0, 65]]],
      [60, 63, [[0, 65]]],
      [60, 158, [[0, 3]]],
      [60, 160, [[0, 65]]],
      [60, 162, [[0, 65]]],
      [60, 360, [[0, 3]]],
      [60, 941, [[0, 3]]],
      [61, 162, [[0, 65]]],
      [156, 162, [[0, 65]]],
      [162, 874, [[0, 65]]],
      [156, 157, [[0, 65]]],
      [157, 903, [[0, 65]]],
      [59, 62, [[0, 65]]],
      [62, 162, [[0, 65]]],
      [59, 162, [[0, 65]]],
      [63, 162, [[0, 65]]],
      [158, 941, [[0, 3]]],
      [155, 160, [[0, 3]]],
      [160, 239, [[0, 3]]],
      [160, 360, [[0, 3]]],
      [160, 873, [[0, 65]]],
      [160, 874, [[0, 65]]],
      [160, 941, [[0, 3]]],
      [160, 948, [[0, 65]]],
      [160, 985, [[0, 65]]],
      [
        979,
        985,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        558,
        979,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [165, 360, [[0, 3]]],
      [165, 749, [[0, 91]]],
      [
        165,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [165, 880, [[0, 27]]],
      [
        582,
        749,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [739, 749, [[0, 91]]],
      [360, 880, [[0, 3]]],
      [370, 880, [[0, 3]]],
      [396, 880, [[0, 3]]],
      [424, 880, [[0, 3]]],
      [
        880,
        931,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [138, 931, [[0, 27]]],
      [138, 139, [[0, 27]]],
      [138, 360, [[0, 3]]],
      [138, 582, [[0, 27]]],
      [138, 739, [[0, 27]]],
      [139, 360, [[0, 3]]],
      [
        139,
        739,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [163, 166, [[0, 3]]],
      [166, 360, [[0, 3]]],
      [166, 848, [[0, 91]]],
      [360, 848, [[0, 3]]],
      [396, 848, [[0, 3]]],
      [407, 848, [[0, 3]]],
      [
        582,
        848,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [739, 848, [[0, 91]]],
      [
        848,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        848,
        899,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        848,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        848,
        985,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        874,
        899,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [892, 899, [[0, 23]]],
      [319, 899, [[0, 3]]],
      [880, 905, [[0, 27]]],
      [
        881,
        905,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [904, 905, [[0, 3]]],
      [238, 905, [[0, 91]]],
      [360, 905, [[0, 3]]],
      [396, 905, [[0, 3]]],
      [
        582,
        905,
        [
          [0, 78],
          [80, 80],
          [89, 91]
        ]
      ],
      [
        833,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        836,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        834,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        837,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        839,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        838,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [840, 905, [[0, 91]]],
      [
        841,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        842,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        844,
        905,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        845,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        847,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [849, 905, [[0, 91]]],
      [
        850,
        905,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        852,
        905,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        853,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        855,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        857,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        858,
        905,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        859,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        860,
        905,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [905, 976, [[0, 3]]],
      [360, 881, [[0, 3]]],
      [396, 881, [[0, 3]]],
      [
        833,
        881,
        [
          [0, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [
        844,
        881,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        858,
        881,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [360, 833, [[0, 3]]],
      [360, 844, [[0, 3]]],
      [396, 844, [[0, 3]]],
      [
        582,
        844,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [360, 858, [[0, 3]]],
      [399, 858, [[0, 3]]],
      [404, 858, [[0, 3]]],
      [
        858,
        866,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        858,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [858, 880, [[0, 27]]],
      [858, 960, [[0, 3]]],
      [360, 866, [[0, 3]]],
      [396, 866, [[0, 3]]],
      [
        582,
        866,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        865,
        866,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        866,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [866, 880, [[0, 27]]],
      [866, 931, [[0, 27]]],
      [866, 960, [[0, 3]]],
      [
        865,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [236, 238, [[0, 91]]],
      [238, 358, [[0, 3]]],
      [238, 319, [[0, 3]]],
      [238, 360, [[0, 3]]],
      [238, 320, [[0, 3]]],
      [238, 368, [[0, 3]]],
      [238, 403, [[0, 3]]],
      [238, 404, [[0, 3]]],
      [
        238,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [238, 940, [[0, 3]]],
      [238, 960, [[0, 3]]],
      [238, 976, [[0, 3]]],
      [236, 314, [[0, 3]]],
      [236, 319, [[0, 3]]],
      [236, 368, [[0, 3]]],
      [236, 381, [[0, 3]]],
      [236, 396, [[0, 3]]],
      [236, 404, [[0, 3]]],
      [236, 437, [[0, 3]]],
      [236, 913, [[0, 91]]],
      [
        236,
        947,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [236, 960, [[0, 3]]],
      [236, 984, [[0, 3]]],
      [236, 1003, [[0, 3]]],
      [360, 836, [[0, 3]]],
      [396, 836, [[0, 3]]],
      [360, 834, [[0, 3]]],
      [396, 834, [[0, 3]]],
      [360, 837, [[0, 3]]],
      [396, 837, [[0, 3]]],
      [360, 839, [[0, 3]]],
      [396, 839, [[0, 3]]],
      [360, 838, [[0, 3]]],
      [396, 838, [[0, 3]]],
      [
        840,
        856,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [49, 840, [[0, 27]]],
      [235, 840, [[0, 3]]],
      [360, 840, [[0, 3]]],
      [396, 840, [[0, 3]]],
      [
        471,
        840,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [477, 840, [[0, 91]]],
      [840, 880, [[0, 27]]],
      [840, 927, [[0, 91]]],
      [235, 856, [[0, 3]]],
      [360, 856, [[0, 3]]],
      [
        856,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        856,
        928,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [49, 880, [[0, 27]]],
      [360, 477, [[0, 3]]],
      [396, 477, [[0, 3]]],
      [
        457,
        477,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [477, 618, [[0, 91]]],
      [439, 457, [[0, 31]]],
      [
        457,
        909,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [197, 439, [[0, 31]]],
      [439, 441, [[0, 31]]],
      [439, 453, [[0, 31]]],
      [439, 456, [[0, 31]]],
      [439, 464, [[0, 31]]],
      [439, 465, [[0, 31]]],
      [439, 927, [[0, 31]]],
      [439, 944, [[0, 31]]],
      [440, 441, [[0, 31]]],
      [441, 456, [[0, 31]]],
      [440, 456, [[0, 31]]],
      [440, 471, [[0, 31]]],
      [440, 582, [[0, 31]]],
      [440, 925, [[0, 31]]],
      [197, 456, [[0, 31]]],
      [456, 471, [[0, 31]]],
      [456, 925, [[0, 31]]],
      [197, 453, [[0, 31]]],
      [453, 456, [[0, 31]]],
      [453, 464, [[0, 31]]],
      [453, 927, [[0, 31]]],
      [464, 873, [[0, 31]]],
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
      [468, 925, [[0, 31]]],
      [468, 927, [[0, 31]]],
      [468, 944, [[0, 31]]],
      [450, 468, [[0, 31]]],
      [197, 452, [[0, 31]]],
      [452, 579, [[0, 31]]],
      [123, 451, [[0, 31]]],
      [360, 841, [[0, 3]]],
      [396, 841, [[0, 3]]],
      [360, 842, [[0, 3]]],
      [396, 842, [[0, 3]]],
      [360, 845, [[0, 3]]],
      [396, 845, [[0, 3]]],
      [360, 847, [[0, 3]]],
      [396, 847, [[0, 3]]],
      [170, 849, [[0, 91]]],
      [171, 849, [[0, 91]]],
      [360, 849, [[0, 3]]],
      [396, 849, [[0, 3]]],
      [
        558,
        849,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 849, [[0, 91]]],
      [849, 948, [[0, 91]]],
      [
        849,
        979,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [849, 987, [[0, 91]]],
      [170, 360, [[0, 3]]],
      [170, 593, [[0, 3]]],
      [170, 592, [[0, 3]]],
      [170, 599, [[0, 3]]],
      [170, 749, [[0, 91]]],
      [170, 948, [[0, 91]]],
      [
        170,
        985,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [592, 599, [[0, 3]]],
      [
        167,
        171,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [169, 171, [[0, 3]]],
      [171, 172, [[0, 3]]],
      [171, 197, [[0, 3]]],
      [171, 360, [[0, 3]]],
      [
        171,
        558,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        171,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [171, 927, [[0, 91]]],
      [167, 360, [[0, 3]]],
      [
        167,
        470,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        167,
        558,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        470,
        558,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [169, 360, [[0, 3]]],
      [172, 360, [[0, 3]]],
      [360, 850, [[0, 3]]],
      [396, 850, [[0, 3]]],
      [
        582,
        850,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [360, 852, [[0, 3]]],
      [404, 852, [[0, 3]]],
      [
        852,
        865,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        852,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [852, 960, [[0, 3]]],
      [360, 853, [[0, 3]]],
      [396, 853, [[0, 3]]],
      [360, 855, [[0, 3]]],
      [396, 855, [[0, 3]]],
      [360, 857, [[0, 3]]],
      [396, 857, [[0, 3]]],
      [360, 859, [[0, 3]]],
      [396, 859, [[0, 3]]],
      [360, 860, [[0, 3]]],
      [396, 860, [[0, 3]]],
      [228, 918, [[0, 3]]],
      [
        175,
        935,
        [
          [0, 79],
          [81, 91]
        ]
      ],
      [189, 935, [[0, 91]]],
      [
        558,
        935,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [593, 935, [[0, 3]]],
      [599, 935, [[0, 3]]],
      [652, 935, [[0, 3]]],
      [
        739,
        935,
        [
          [0, 79],
          [81, 91]
        ]
      ],
      [
        873,
        935,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [934, 935, [[0, 91]]],
      [
        935,
        938,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [935, 948, [[0, 91]]],
      [935, 984, [[0, 3]]],
      [175, 360, [[0, 3]]],
      [
        175,
        854,
        [
          [0, 79],
          [81, 91]
        ]
      ],
      [
        175,
        874,
        [
          [0, 79],
          [81, 83],
          [89, 91]
        ]
      ],
      [175, 960, [[0, 3]]],
      [
        50,
        854,
        [
          [0, 79],
          [81, 91]
        ]
      ],
      [360, 854, [[0, 3]]],
      [396, 854, [[0, 3]]],
      [
        854,
        874,
        [
          [0, 79],
          [81, 83],
          [89, 91]
        ]
      ],
      [854, 880, [[0, 27]]],
      [
        854,
        905,
        [
          [0, 78],
          [81, 82],
          [89, 91]
        ]
      ],
      [854, 960, [[0, 3]]],
      [
        50,
        935,
        [
          [0, 79],
          [81, 91]
        ]
      ],
      [148, 934, [[0, 91]]],
      [224, 934, [[0, 3]]],
      [360, 934, [[0, 3]]],
      [537, 934, [[0, 91]]],
      [538, 934, [[0, 3]]],
      [545, 934, [[0, 91]]],
      [546, 934, [[0, 3]]],
      [
        549,
        934,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        558,
        934,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        582,
        934,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 934, [[0, 91]]],
      [739, 934, [[0, 91]]],
      [877, 934, [[0, 91]]],
      [
        909,
        934,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        934,
        981,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [934, 984, [[0, 3]]],
      [934, 990, [[0, 3]]],
      [148, 360, [[0, 3]]],
      [148, 537, [[0, 91]]],
      [148, 545, [[0, 91]]],
      [
        148,
        549,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        148,
        582,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        148,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [148, 984, [[0, 3]]],
      [360, 537, [[0, 3]]],
      [537, 538, [[0, 3]]],
      [
        537,
        581,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [537, 618, [[0, 91]]],
      [537, 739, [[0, 91]]],
      [537, 984, [[0, 3]]],
      [
        581,
        582,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [360, 545, [[0, 3]]],
      [545, 546, [[0, 3]]],
      [
        545,
        581,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [545, 618, [[0, 91]]],
      [545, 739, [[0, 91]]],
      [545, 984, [[0, 3]]],
      [360, 549, [[0, 3]]],
      [
        549,
        581,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        549,
        582,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        549,
        611,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [549, 969, [[0, 12]]],
      [549, 984, [[0, 3]]],
      [
        611,
        617,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [611, 969, [[0, 12]]],
      [224, 360, [[0, 3]]],
      [224, 984, [[0, 3]]],
      [224, 1003, [[0, 3]]],
      [981, 990, [[0, 3]]],
      [538, 981, [[0, 3]]],
      [546, 981, [[0, 3]]],
      [
        558,
        981,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [224, 990, [[0, 3]]],
      [228, 990, [[0, 3]]],
      [538, 990, [[0, 3]]],
      [546, 990, [[0, 3]]],
      [
        558,
        938,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        582,
        938,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [905, 959, [[0, 91]]],
      [360, 963, [[0, 3]]],
      [396, 963, [[0, 3]]],
      [618, 963, [[0, 91]]],
      [739, 963, [[0, 91]]],
      [
        874,
        963,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [963, 984, [[0, 3]]],
      [
        582,
        965,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [360, 1026, [[0, 3]]],
      [
        947,
        1026,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [313, 954, [[0, 3]]],
      [360, 954, [[0, 3]]],
      [597, 954, [[0, 3]]],
      [618, 954, [[0, 91]]],
      [739, 954, [[0, 91]]],
      [750, 954, [[0, 91]]],
      [913, 954, [[0, 91]]],
      [954, 984, [[0, 3]]],
      [954, 1003, [[0, 3]]],
      [597, 750, [[0, 3]]],
      [739, 750, [[0, 91]]],
      [358, 994, [[0, 3]]],
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
      [443, 927, [[0, 0]]],
      [
        454,
        469,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        454,
        470,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        454,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [454, 950, [[0, 91]]],
      [
        454,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        454,
        998,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        873,
        998,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        997,
        998,
        [
          [0, 80],
          [83, 84],
          [89, 91]
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
      [463, 595, [[0, 0]]],
      [463, 597, [[0, 0]]],
      [463, 608, [[0, 0]]],
      [463, 618, [[0, 0]]],
      [463, 650, [[0, 0]]],
      [463, 873, [[0, 0]]],
      [463, 874, [[0, 0]]],
      [463, 909, [[0, 0]]],
      [463, 913, [[0, 0]]],
      [463, 927, [[0, 0]]],
      [463, 947, [[0, 0]]],
      [463, 948, [[0, 0]]],
      [463, 979, [[0, 0]]],
      [463, 1003, [[0, 0]]],
      [475, 476, [[0, 0]]],
      [360, 475, [[0, 0]]],
      [360, 476, [[0, 0]]],
      [476, 984, [[0, 0]]],
      [476, 478, [[0, 0]]],
      [360, 478, [[0, 0]]],
      [478, 536, [[0, 0]]],
      [478, 537, [[0, 0]]],
      [478, 538, [[0, 0]]],
      [478, 984, [[0, 0]]],
      [533, 536, [[0, 9]]],
      [536, 538, [[0, 3]]],
      [
        197,
        536,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [230, 536, [[0, 3]]],
      [231, 536, [[0, 3]]],
      [314, 536, [[0, 3]]],
      [319, 536, [[0, 3]]],
      [396, 536, [[0, 3]]],
      [
        536,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [536, 984, [[0, 3]]],
      [
        536,
        987,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [536, 1003, [[0, 3]]],
      [197, 533, [[0, 9]]],
      [471, 533, [[0, 9]]],
      [533, 559, [[0, 9]]],
      [533, 560, [[0, 9]]],
      [533, 873, [[0, 9]]],
      [533, 1003, [[0, 3]]],
      [469, 481, [[0, 0]]],
      [469, 482, [[0, 0]]],
      [482, 560, [[0, 0]]],
      [482, 912, [[0, 0]]],
      [482, 997, [[0, 0]]],
      [482, 998, [[0, 0]]],
      [
        558,
        912,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        559,
        912,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        560,
        912,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [652, 912, [[0, 3]]],
      [
        873,
        912,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        912,
        953,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        912,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        912,
        998,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        558,
        953,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        953,
        997,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [458, 597, [[0, 0]]],
      [461, 471, [[0, 0]]],
      [461, 597, [[0, 0]]],
      [461, 926, [[0, 0]]],
      [471, 926, [[0, 0]]],
      [558, 926, [[0, 0]]],
      [590, 926, [[0, 0]]],
      [873, 926, [[0, 0]]],
      [595, 599, [[0, 3]]],
      [582, 608, [[0, 0]]],
      [608, 609, [[0, 0]]],
      [608, 618, [[0, 0]]],
      [608, 652, [[0, 0]]],
      [608, 903, [[0, 0]]],
      [608, 909, [[0, 0]]],
      [469, 650, [[0, 0]]],
      [474, 650, [[0, 0]]],
      [650, 652, [[0, 0]]],
      [650, 888, [[0, 0]]],
      [650, 912, [[0, 0]]],
      [883, 888, [[0, 3]]],
      [884, 888, [[0, 3]]],
      [885, 888, [[0, 3]]],
      [886, 888, [[0, 3]]],
      [887, 888, [[0, 3]]],
      [888, 889, [[0, 3]]],
      [
        888,
        890,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [888, 973, [[0, 3]]],
      [652, 883, [[0, 3]]],
      [883, 973, [[0, 3]]],
      [652, 884, [[0, 3]]],
      [884, 973, [[0, 3]]],
      [652, 885, [[0, 3]]],
      [885, 973, [[0, 3]]],
      [652, 886, [[0, 3]]],
      [652, 887, [[0, 3]]],
      [889, 973, [[0, 3]]],
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
      [210, 873, [[0, 0]]],
      [445, 470, [[0, 0]]],
      [446, 470, [[0, 0]]],
      [447, 470, [[0, 0]]],
      [87, 467, [[0, 0]]],
      [87, 469, [[0, 0]]],
      [87, 472, [[0, 0]]],
      [87, 480, [[0, 0]]],
      [87, 927, [[0, 0]]],
      [467, 469, [[0, 0]]],
      [467, 482, [[0, 0]]],
      [470, 480, [[0, 0]]],
      [105, 106, [[0, 0]]],
      [105, 107, [[0, 0]]],
      [105, 108, [[0, 0]]],
      [105, 997, [[0, 0]]],
      [105, 998, [[0, 0]]],
      [16, 106, [[0, 0]]],
      [106, 997, [[0, 0]]],
      [106, 998, [[0, 0]]],
      [107, 997, [[0, 0]]],
      [107, 998, [[0, 0]]],
      [108, 582, [[0, 0]]],
      [108, 936, [[0, 0]]],
      [108, 997, [[0, 0]]],
      [108, 998, [[0, 0]]],
      [
        936,
        969,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [94, 95, [[0, 0]]],
      [94, 966, [[0, 0]]],
      [459, 479, [[0, 0]]],
      [459, 988, [[0, 0]]],
      [479, 988, [[0, 0]]],
      [460, 481, [[0, 0]]],
      [950, 961, [[0, 0]]],
      [961, 966, [[0, 0]]],
      [
        558,
        970,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        618,
        970,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        909,
        970,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [930, 970, [[0, 91]]],
      [90, 185, [[0, 0]]],
      [185, 950, [[0, 0]]],
      [185, 970, [[0, 0]]],
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
      [90, 930, [[0, 0]]],
      [90, 935, [[0, 0]]],
      [90, 950, [[0, 0]]],
      [90, 997, [[0, 0]]],
      [74, 78, [[0, 0]]],
      [74, 75, [[0, 0]]],
      [74, 178, [[0, 0]]],
      [74, 995, [[0, 0]]],
      [74, 996, [[0, 0]]],
      [74, 997, [[0, 0]]],
      [74, 998, [[0, 0]]],
      [78, 178, [[0, 0]]],
      [178, 182, [[0, 0]]],
      [178, 618, [[0, 0]]],
      [178, 935, [[0, 0]]],
      [178, 938, [[0, 0]]],
      [178, 950, [[0, 0]]],
      [178, 995, [[0, 0]]],
      [178, 996, [[0, 0]]],
      [182, 935, [[0, 0]]],
      [950, 995, [[0, 0]]],
      [995, 997, [[0, 0]]],
      [995, 998, [[0, 0]]],
      [950, 996, [[0, 0]]],
      [75, 76, [[0, 0]]],
      [76, 79, [[0, 0]]],
      [76, 80, [[0, 0]]],
      [76, 618, [[0, 0]]],
      [76, 909, [[0, 0]]],
      [76, 935, [[0, 0]]],
      [76, 950, [[0, 0]]],
      [76, 996, [[0, 0]]],
      [79, 909, [[0, 0]]],
      [79, 950, [[0, 0]]],
      [80, 935, [[0, 0]]],
      [80, 950, [[0, 0]]],
      [77, 178, [[0, 0]]],
      [72, 181, [[0, 0]]],
      [72, 582, [[0, 0]]],
      [72, 966, [[0, 0]]],
      [181, 582, [[0, 0]]],
      [178, 179, [[0, 0]]],
      [179, 558, [[0, 0]]],
      [179, 582, [[0, 0]]],
      [179, 595, [[0, 0]]],
      [179, 609, [[0, 0]]],
      [179, 618, [[0, 0]]],
      [179, 873, [[0, 0]]],
      [179, 903, [[0, 0]]],
      [179, 909, [[0, 0]]],
      [179, 912, [[0, 0]]],
      [179, 913, [[0, 0]]],
      [179, 935, [[0, 0]]],
      [179, 947, [[0, 0]]],
      [179, 950, [[0, 0]]],
      [179, 979, [[0, 0]]],
      [179, 997, [[0, 0]]],
      [179, 998, [[0, 0]]],
      [179, 1003, [[0, 0]]],
      [73, 180, [[0, 0]]],
      [73, 950, [[0, 0]]],
      [178, 183, [[0, 0]]],
      [183, 912, [[0, 0]]],
      [183, 950, [[0, 0]]],
      [183, 997, [[0, 0]]],
      [183, 998, [[0, 0]]],
      [91, 186, [[0, 0]]],
      [186, 932, [[0, 0]]],
      [186, 970, [[0, 0]]],
      [12, 91, [[0, 0]]],
      [91, 98, [[0, 0]]],
      [91, 99, [[0, 0]]],
      [91, 95, [[0, 0]]],
      [91, 164, [[0, 0]]],
      [91, 197, [[0, 0]]],
      [91, 206, [[0, 0]]],
      [91, 582, [[0, 0]]],
      [91, 925, [[0, 0]]],
      [91, 943, [[0, 0]]],
      [91, 944, [[0, 0]]],
      [91, 977, [[0, 0]]],
      [91, 1002, [[0, 0]]],
      [12, 13, [[0, 0]]],
      [12, 188, [[0, 0]]],
      [12, 582, [[0, 0]]],
      [12, 977, [[0, 0]]],
      [12, 1002, [[0, 0]]],
      [13, 977, [[0, 0]]],
      [188, 977, [[0, 0]]],
      [
        977,
        1002,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [97, 98, [[0, 0]]],
      [98, 932, [[0, 0]]],
      [97, 932, [[0, 0]]],
      [99, 943, [[0, 0]]],
      [197, 943, [[0, 65]]],
      [471, 943, [[0, 65]]],
      [873, 943, [[0, 65]]],
      [164, 168, [[0, 52]]],
      [164, 484, [[0, 52]]],
      [164, 599, [[0, 3]]],
      [164, 944, [[0, 52]]],
      [168, 360, [[0, 3]]],
      [168, 595, [[0, 3]]],
      [168, 599, [[0, 3]]],
      [168, 739, [[0, 52]]],
      [168, 913, [[0, 52]]],
      [168, 947, [[0, 52]]],
      [197, 484, [[0, 52]]],
      [471, 484, [[0, 52]]],
      [484, 944, [[0, 52]]],
      [206, 977, [[0, 0]]],
      [92, 187, [[0, 0]]],
      [93, 187, [[0, 0]]],
      [187, 582, [[0, 0]]],
      [187, 970, [[0, 0]]],
      [92, 103, [[0, 0]]],
      [12, 92, [[0, 0]]],
      [13, 92, [[0, 0]]],
      [66, 92, [[0, 0]]],
      [84, 92, [[0, 0]]],
      [92, 104, [[0, 0]]],
      [92, 95, [[0, 0]]],
      [92, 206, [[0, 0]]],
      [92, 593, [[0, 0]]],
      [92, 595, [[0, 0]]],
      [92, 598, [[0, 0]]],
      [92, 913, [[0, 0]]],
      [92, 916, [[0, 0]]],
      [92, 930, [[0, 0]]],
      [92, 945, [[0, 0]]],
      [92, 947, [[0, 0]]],
      [92, 955, [[0, 0]]],
      [92, 964, [[0, 0]]],
      [92, 974, [[0, 0]]],
      [92, 977, [[0, 0]]],
      [10, 103, [[0, 0]]],
      [12, 103, [[0, 0]]],
      [13, 103, [[0, 0]]],
      [66, 103, [[0, 0]]],
      [103, 206, [[0, 0]]],
      [103, 595, [[0, 0]]],
      [103, 913, [[0, 0]]],
      [103, 945, [[0, 0]]],
      [103, 947, [[0, 0]]],
      [103, 955, [[0, 0]]],
      [103, 977, [[0, 0]]],
      [10, 945, [[0, 0]]],
      [945, 947, [[0, 0]]],
      [582, 945, [[0, 0]]],
      [945, 977, [[0, 0]]],
      [66, 209, [[0, 0]]],
      [66, 785, [[0, 0]]],
      [66, 871, [[0, 0]]],
      [66, 959, [[0, 0]]],
      [209, 360, [[0, 3]]],
      [209, 582, [[0, 16]]],
      [358, 785, [[0, 0]]],
      [360, 785, [[0, 0]]],
      [785, 787, [[0, 0]]],
      [785, 788, [[0, 0]]],
      [785, 791, [[0, 0]]],
      [785, 798, [[0, 0]]],
      [785, 815, [[0, 0]]],
      [785, 863, [[0, 0]]],
      [785, 870, [[0, 0]]],
      [785, 959, [[0, 0]]],
      [785, 975, [[0, 0]]],
      [785, 976, [[0, 0]]],
      [786, 787, [[0, 0]]],
      [360, 787, [[0, 0]]],
      [787, 792, [[0, 0]]],
      [787, 975, [[0, 0]]],
      [315, 786, [[0, 0]]],
      [582, 792, [[0, 0]]],
      [792, 947, [[0, 0]]],
      [784, 788, [[0, 0]]],
      [788, 789, [[0, 0]]],
      [360, 788, [[0, 0]]],
      [739, 788, [[0, 0]]],
      [753, 788, [[0, 0]]],
      [754, 788, [[0, 0]]],
      [788, 801, [[0, 0]]],
      [788, 934, [[0, 0]]],
      [788, 940, [[0, 0]]],
      [788, 975, [[0, 0]]],
      [788, 984, [[0, 0]]],
      [784, 790, [[0, 0]]],
      [360, 784, [[0, 0]]],
      [739, 784, [[0, 0]]],
      [784, 792, [[0, 0]]],
      [784, 794, [[0, 0]]],
      [784, 795, [[0, 0]]],
      [360, 790, [[0, 0]]],
      [139, 794, [[0, 0]]],
      [330, 794, [[0, 0]]],
      [358, 794, [[0, 0]]],
      [314, 794, [[0, 0]]],
      [319, 794, [[0, 0]]],
      [320, 794, [[0, 0]]],
      [368, 794, [[0, 0]]],
      [323, 794, [[0, 0]]],
      [618, 794, [[0, 0]]],
      [739, 794, [[0, 0]]],
      [741, 794, [[0, 0]]],
      [742, 794, [[0, 0]]],
      [743, 794, [[0, 0]]],
      [747, 794, [[0, 0]]],
      [748, 794, [[0, 0]]],
      [754, 794, [[0, 0]]],
      [794, 799, [[0, 0]]],
      [794, 874, [[0, 0]]],
      [794, 939, [[0, 0]]],
      [794, 940, [[0, 0]]],
      [139, 741, [[0, 0]]],
      [391, 741, [[0, 0]]],
      [739, 741, [[0, 0]]],
      [326, 742, [[0, 0]]],
      [330, 742, [[0, 0]]],
      [358, 742, [[0, 0]]],
      [314, 742, [[0, 0]]],
      [323, 742, [[0, 0]]],
      [391, 742, [[0, 0]]],
      [739, 742, [[0, 0]]],
      [742, 1003, [[0, 0]]],
      [314, 743, [[0, 0]]],
      [742, 743, [[0, 0]]],
      [743, 747, [[0, 0]]],
      [743, 754, [[0, 0]]],
      [317, 799, [[0, 0]]],
      [319, 799, [[0, 0]]],
      [391, 799, [[0, 0]]],
      [795, 874, [[0, 0]]],
      [795, 939, [[0, 0]]],
      [795, 940, [[0, 0]]],
      [789, 790, [[0, 0]]],
      [360, 789, [[0, 0]]],
      [789, 792, [[0, 0]]],
      [789, 794, [[0, 0]]],
      [789, 795, [[0, 0]]],
      [360, 753, [[0, 0]]],
      [753, 754, [[0, 0]]],
      [358, 801, [[0, 0]]],
      [801, 940, [[0, 0]]],
      [801, 1003, [[0, 0]]],
      [784, 791, [[0, 0]]],
      [739, 791, [[0, 0]]],
      [753, 791, [[0, 0]]],
      [780, 791, [[0, 0]]],
      [791, 796, [[0, 0]]],
      [791, 798, [[0, 0]]],
      [791, 863, [[0, 0]]],
      [617, 780, [[0, 0]]],
      [780, 924, [[0, 0]]],
      [139, 796, [[0, 0]]],
      [360, 796, [[0, 0]]],
      [739, 796, [[0, 0]]],
      [753, 796, [[0, 0]]],
      [754, 796, [[0, 0]]],
      [757, 796, [[0, 0]]],
      [798, 976, [[0, 0]]],
      [804, 863, [[0, 0]]],
      [806, 863, [[0, 0]]],
      [807, 863, [[0, 0]]],
      [808, 863, [[0, 0]]],
      [809, 863, [[0, 0]]],
      [810, 863, [[0, 0]]],
      [814, 863, [[0, 0]]],
      [815, 863, [[0, 0]]],
      [816, 863, [[0, 0]]],
      [817, 863, [[0, 0]]],
      [818, 863, [[0, 0]]],
      [819, 863, [[0, 0]]],
      [823, 863, [[0, 0]]],
      [822, 863, [[0, 0]]],
      [824, 863, [[0, 0]]],
      [5, 863, [[0, 0]]],
      [7, 863, [[0, 0]]],
      [8, 863, [[0, 0]]],
      [17, 863, [[0, 0]]],
      [51, 863, [[0, 0]]],
      [52, 863, [[0, 0]]],
      [53, 863, [[0, 0]]],
      [70, 863, [[0, 0]]],
      [71, 863, [[0, 0]]],
      [82, 863, [[0, 0]]],
      [115, 863, [[0, 0]]],
      [761, 863, [[0, 0]]],
      [804, 976, [[0, 0]]],
      [805, 806, [[0, 0]]],
      [806, 976, [[0, 0]]],
      [396, 805, [[0, 0]]],
      [807, 830, [[0, 0]]],
      [396, 807, [[0, 0]]],
      [807, 976, [[0, 0]]],
      [830, 976, [[0, 0]]],
      [808, 976, [[0, 0]]],
      [809, 846, [[0, 0]]],
      [809, 874, [[0, 0]]],
      [809, 976, [[0, 0]]],
      [809, 984, [[0, 0]]],
      [360, 846, [[0, 0]]],
      [846, 868, [[0, 0]]],
      [846, 948, [[0, 0]]],
      [846, 984, [[0, 0]]],
      [558, 868, [[0, 0]]],
      [868, 873, [[0, 0]]],
      [868, 874, [[0, 0]]],
      [810, 811, [[0, 0]]],
      [810, 812, [[0, 0]]],
      [810, 813, [[0, 0]]],
      [810, 825, [[0, 0]]],
      [810, 976, [[0, 0]]],
      [811, 830, [[0, 0]]],
      [47, 811, [[0, 0]]],
      [358, 811, [[0, 0]]],
      [396, 811, [[0, 0]]],
      [811, 976, [[0, 0]]],
      [47, 48, [[0, 0]]],
      [47, 358, [[0, 0]]],
      [48, 358, [[0, 0]]],
      [812, 830, [[0, 0]]],
      [404, 812, [[0, 0]]],
      [812, 976, [[0, 0]]],
      [813, 830, [[0, 0]]],
      [813, 976, [[0, 0]]],
      [802, 825, [[0, 0]]],
      [803, 825, [[0, 0]]],
      [825, 976, [[0, 0]]],
      [802, 976, [[0, 0]]],
      [582, 803, [[0, 0]]],
      [803, 976, [[0, 0]]],
      [814, 830, [[0, 0]]],
      [814, 976, [[0, 0]]],
      [310, 815, [[0, 0]]],
      [317, 815, [[0, 0]]],
      [319, 815, [[0, 0]]],
      [396, 815, [[0, 0]]],
      [739, 815, [[0, 0]]],
      [799, 815, [[0, 0]]],
      [815, 867, [[0, 0]]],
      [815, 976, [[0, 0]]],
      [360, 867, [[0, 0]]],
      [396, 867, [[0, 0]]],
      [816, 976, [[0, 0]]],
      [817, 831, [[0, 0]]],
      [319, 817, [[0, 0]]],
      [817, 874, [[0, 0]]],
      [817, 880, [[0, 0]]],
      [831, 906, [[0, 0]]],
      [873, 906, [[0, 65]]],
      [396, 818, [[0, 0]]],
      [818, 960, [[0, 0]]],
      [818, 976, [[0, 0]]],
      [818, 987, [[0, 0]]],
      [471, 819, [[0, 0]]],
      [819, 820, [[0, 0]]],
      [819, 821, [[0, 0]]],
      [819, 825, [[0, 0]]],
      [819, 976, [[0, 0]]],
      [820, 830, [[0, 0]]],
      [618, 820, [[0, 0]]],
      [820, 976, [[0, 0]]],
      [821, 826, [[0, 0]]],
      [821, 830, [[0, 0]]],
      [821, 832, [[0, 0]]],
      [821, 861, [[0, 0]]],
      [821, 862, [[0, 0]]],
      [821, 927, [[0, 0]]],
      [821, 976, [[0, 0]]],
      [826, 827, [[0, 0]]],
      [826, 843, [[0, 0]]],
      [827, 828, [[0, 0]]],
      [827, 829, [[0, 0]]],
      [465, 828, [[0, 0]]],
      [473, 829, [[0, 0]]],
      [739, 843, [[0, 0]]],
      [756, 843, [[0, 0]]],
      [360, 756, [[0, 3]]],
      [832, 927, [[0, 0]]],
      [832, 944, [[0, 0]]],
      [197, 861, [[0, 0]]],
      [618, 861, [[0, 0]]],
      [861, 873, [[0, 0]]],
      [861, 927, [[0, 0]]],
      [861, 976, [[0, 0]]],
      [469, 862, [[0, 0]]],
      [482, 862, [[0, 0]]],
      [537, 862, [[0, 0]]],
      [832, 862, [[0, 0]]],
      [145, 823, [[0, 0]]],
      [823, 976, [[0, 0]]],
      [
        140,
        145,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        143,
        145,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        144,
        145,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        145,
        149,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        145,
        151,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [145, 153, [[0, 0]]],
      [145, 360, [[0, 0]]],
      [145, 466, [[0, 0]]],
      [145, 739, [[0, 0]]],
      [145, 800, [[0, 0]]],
      [145, 913, [[0, 0]]],
      [145, 948, [[0, 0]]],
      [145, 987, [[0, 0]]],
      [140, 358, [[0, 0]]],
      [140, 360, [[0, 0]]],
      [141, 143, [[0, 0]]],
      [143, 147, [[0, 0]]],
      [143, 360, [[0, 0]]],
      [143, 582, [[0, 0]]],
      [143, 618, [[0, 0]]],
      [143, 739, [[0, 0]]],
      [141, 618, [[0, 0]]],
      [141, 739, [[0, 0]]],
      [141, 147, [[0, 0]]],
      [147, 360, [[0, 0]]],
      [147, 739, [[0, 0]]],
      [144, 319, [[0, 0]]],
      [144, 466, [[0, 0]]],
      [144, 930, [[0, 0]]],
      [197, 466, [[0, 0]]],
      [360, 466, [[0, 0]]],
      [458, 466, [[0, 0]]],
      [461, 466, [[0, 0]]],
      [466, 483, [[0, 0]]],
      [466, 909, [[0, 0]]],
      [466, 948, [[0, 0]]],
      [466, 985, [[0, 0]]],
      [483, 558, [[0, 0]]],
      [483, 873, [[0, 0]]],
      [147, 149, [[0, 0]]],
      [149, 150, [[0, 0]]],
      [149, 153, [[0, 0]]],
      [136, 149, [[0, 0]]],
      [149, 360, [[0, 0]]],
      [136, 150, [[0, 0]]],
      [150, 360, [[0, 0]]],
      [150, 618, [[0, 0]]],
      [150, 874, [[0, 0]]],
      [150, 930, [[0, 0]]],
      [150, 992, [[0, 0]]],
      [360, 992, [[0, 3]]],
      [153, 360, [[0, 0]]],
      [153, 582, [[0, 0]]],
      [153, 739, [[0, 0]]],
      [153, 947, [[0, 0]]],
      [153, 965, [[0, 0]]],
      [153, 987, [[0, 0]]],
      [153, 992, [[0, 0]]],
      [142, 151, [[0, 0]]],
      [146, 151, [[0, 0]]],
      [151, 152, [[0, 0]]],
      [151, 154, [[0, 0]]],
      [151, 360, [[0, 0]]],
      [142, 153, [[0, 0]]],
      [142, 360, [[0, 0]]],
      [142, 582, [[0, 0]]],
      [142, 739, [[0, 0]]],
      [142, 874, [[0, 0]]],
      [141, 146, [[0, 0]]],
      [146, 358, [[0, 0]]],
      [146, 360, [[0, 0]]],
      [146, 397, [[0, 0]]],
      [146, 739, [[0, 0]]],
      [146, 987, [[0, 0]]],
      [152, 360, [[0, 0]]],
      [152, 618, [[0, 0]]],
      [152, 739, [[0, 0]]],
      [152, 874, [[0, 0]]],
      [152, 909, [[0, 0]]],
      [152, 987, [[0, 0]]],
      [360, 800, [[0, 0]]],
      [558, 800, [[0, 0]]],
      [800, 993, [[0, 0]]],
      [
        558,
        993,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [558, 822, [[0, 65]]],
      [618, 822, [[0, 65]]],
      [739, 822, [[0, 65]]],
      [822, 873, [[0, 65]]],
      [822, 948, [[0, 65]]],
      [822, 960, [[0, 3]]],
      [822, 976, [[0, 3]]],
      [822, 987, [[0, 65]]],
      [824, 830, [[0, 0]]],
      [396, 824, [[0, 0]]],
      [824, 976, [[0, 0]]],
      [5, 135, [[0, 0]]],
      [135, 739, [[0, 0]]],
      [135, 835, [[0, 0]]],
      [135, 874, [[0, 0]]],
      [360, 835, [[0, 0]]],
      [835, 868, [[0, 0]]],
      [835, 948, [[0, 0]]],
      [835, 984, [[0, 0]]],
      [7, 190, [[0, 65]]],
      [7, 319, [[0, 3]]],
      [7, 739, [[0, 65]]],
      [7, 874, [[0, 65]]],
      [7, 976, [[0, 3]]],
      [7, 984, [[0, 3]]],
      [190, 208, [[0, 65]]],
      [190, 247, [[0, 65]]],
      [190, 319, [[0, 3]]],
      [190, 948, [[0, 65]]],
      [208, 282, [[0, 65]]],
      [208, 319, [[0, 3]]],
      [247, 284, [[0, 65]]],
      [247, 282, [[0, 65]]],
      [279, 284, [[0, 65]]],
      [282, 284, [[0, 65]]],
      [8, 191, [[0, 65]]],
      [8, 249, [[0, 65]]],
      [8, 319, [[0, 3]]],
      [8, 880, [[0, 27]]],
      [8, 976, [[0, 3]]],
      [8, 987, [[0, 65]]],
      [191, 208, [[0, 65]]],
      [191, 249, [[0, 65]]],
      [191, 319, [[0, 3]]],
      [249, 284, [[0, 65]]],
      [249, 282, [[0, 65]]],
      [17, 207, [[0, 0]]],
      [17, 948, [[0, 0]]],
      [17, 976, [[0, 0]]],
      [207, 739, [[0, 0]]],
      [207, 960, [[0, 0]]],
      [207, 976, [[0, 0]]],
      [207, 978, [[0, 0]]],
      [51, 198, [[0, 0]]],
      [51, 207, [[0, 0]]],
      [51, 976, [[0, 0]]],
      [198, 319, [[0, 0]]],
      [198, 948, [[0, 0]]],
      [198, 987, [[0, 0]]],
      [52, 54, [[0, 65]]],
      [52, 199, [[0, 65]]],
      [52, 319, [[0, 3]]],
      [52, 582, [[0, 65]]],
      [52, 880, [[0, 27]]],
      [52, 976, [[0, 3]]],
      [52, 987, [[0, 65]]],
      [54, 56, [[0, 65]]],
      [54, 58, [[0, 65]]],
      [54, 319, [[0, 3]]],
      [55, 56, [[0, 65]]],
      [56, 319, [[0, 3]]],
      [56, 914, [[0, 65]]],
      [58, 582, [[0, 65]]],
      [52, 53, [[0, 65]]],
      [53, 880, [[0, 27]]],
      [53, 976, [[0, 3]]],
      [70, 177, [[0, 0]]],
      [177, 239, [[0, 0]]],
      [177, 396, [[0, 0]]],
      [177, 873, [[0, 0]]],
      [177, 874, [[0, 0]]],
      [177, 948, [[0, 0]]],
      [177, 960, [[0, 0]]],
      [71, 976, [[0, 0]]],
      [81, 82, [[0, 0]]],
      [82, 83, [[0, 0]]],
      [82, 207, [[0, 0]]],
      [82, 396, [[0, 0]]],
      [82, 948, [[0, 0]]],
      [82, 976, [[0, 0]]],
      [81, 83, [[0, 0]]],
      [81, 203, [[0, 0]]],
      [81, 358, [[0, 0]]],
      [81, 396, [[0, 0]]],
      [81, 988, [[0, 0]]],
      [83, 396, [[0, 0]]],
      [203, 396, [[0, 0]]],
      [203, 988, [[0, 0]]],
      [113, 115, [[0, 0]]],
      [115, 214, [[0, 0]]],
      [115, 215, [[0, 0]]],
      [115, 216, [[0, 0]]],
      [115, 396, [[0, 0]]],
      [115, 874, [[0, 0]]],
      [115, 976, [[0, 0]]],
      [115, 984, [[0, 0]]],
      [113, 114, [[0, 0]]],
      [113, 212, [[0, 0]]],
      [113, 215, [[0, 0]]],
      [113, 396, [[0, 0]]],
      [113, 812, [[0, 0]]],
      [113, 976, [[0, 0]]],
      [114, 203, [[0, 0]]],
      [114, 213, [[0, 0]]],
      [114, 396, [[0, 0]]],
      [213, 988, [[0, 0]]],
      [198, 212, [[0, 0]]],
      [215, 1004, [[0, 0]]],
      [873, 1004, [[0, 0]]],
      [214, 396, [[0, 0]]],
      [216, 360, [[0, 0]]],
      [216, 618, [[0, 0]]],
      [216, 873, [[0, 0]]],
      [216, 874, [[0, 0]]],
      [216, 948, [[0, 0]]],
      [216, 960, [[0, 0]]],
      [216, 985, [[0, 0]]],
      [761, 766, [[0, 0]]],
      [761, 767, [[0, 0]]],
      [761, 768, [[0, 0]]],
      [761, 874, [[0, 0]]],
      [761, 948, [[0, 0]]],
      [319, 766, [[0, 0]]],
      [766, 767, [[0, 0]]],
      [766, 778, [[0, 0]]],
      [319, 768, [[0, 0]]],
      [763, 768, [[0, 0]]],
      [870, 871, [[0, 0]]],
      [84, 947, [[0, 0]]],
      [65, 104, [[0, 0]]],
      [94, 104, [[0, 0]]],
      [104, 947, [[0, 0]]],
      [65, 201, [[0, 0]]],
      [65, 871, [[0, 0]]],
      [65, 947, [[0, 0]]],
      [201, 915, [[0, 0]]],
      [201, 947, [[0, 0]]],
      [201, 1027, [[0, 0]]],
      [873, 915, [[0, 0]]],
      [915, 947, [[0, 0]]],
      [915, 1027, [[0, 0]]],
      [947, 1027, [[0, 0]]],
      [916, 947, [[0, 0]]],
      [916, 974, [[0, 0]]],
      [916, 977, [[0, 0]]],
      [916, 1002, [[0, 0]]],
      [
        947,
        974,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [947, 964, [[0, 0]]],
      [93, 100, [[0, 0]]],
      [93, 102, [[0, 0]]],
      [93, 95, [[0, 0]]],
      [93, 168, [[0, 0]]],
      [93, 197, [[0, 0]]],
      [93, 598, [[0, 0]]],
      [93, 916, [[0, 0]]],
      [93, 947, [[0, 0]]],
      [93, 974, [[0, 0]]],
      [93, 977, [[0, 0]]],
      [93, 1002, [[0, 0]]],
      [14, 100, [[0, 0]]],
      [100, 945, [[0, 0]]],
      [100, 947, [[0, 0]]],
      [100, 974, [[0, 0]]],
      [100, 977, [[0, 0]]],
      [14, 15, [[0, 0]]],
      [14, 945, [[0, 0]]],
      [14, 947, [[0, 0]]],
      [14, 955, [[0, 0]]],
      [14, 977, [[0, 0]]],
      [15, 67, [[0, 0]]],
      [15, 173, [[0, 0]]],
      [15, 945, [[0, 0]]],
      [15, 947, [[0, 0]]],
      [15, 955, [[0, 0]]],
      [15, 977, [[0, 0]]],
      [67, 68, [[0, 0]]],
      [67, 69, [[0, 0]]],
      [67, 785, [[0, 0]]],
      [67, 871, [[0, 0]]],
      [67, 947, [[0, 0]]],
      [68, 947, [[0, 0]]],
      [69, 947, [[0, 0]]],
      [168, 173, [[0, 0]]],
      [173, 582, [[0, 0]]],
      [173, 947, [[0, 0]]],
      [101, 102, [[0, 0]]],
      [102, 196, [[0, 0]]],
      [102, 947, [[0, 0]]],
      [67, 101, [[0, 0]]],
      [101, 168, [[0, 0]]],
      [101, 173, [[0, 0]]],
      [101, 196, [[0, 0]]],
      [196, 947, [[0, 0]]],
      [164, 455, [[0, 52]]],
      [197, 455, [[0, 52]]],
      [455, 457, [[0, 52]]],
      [455, 597, [[0, 3]]],
      [85, 615, [[0, 0]]],
      [615, 970, [[0, 0]]],
      [85, 89, [[0, 0]]],
      [85, 618, [[0, 0]]],
      [85, 930, [[0, 0]]],
      [12, 89, [[0, 0]]],
      [13, 89, [[0, 0]]],
      [89, 95, [[0, 0]]],
      [89, 109, [[0, 0]]],
      [89, 189, [[0, 0]]],
      [89, 206, [[0, 0]]],
      [89, 582, [[0, 0]]],
      [89, 598, [[0, 0]]],
      [89, 609, [[0, 0]]],
      [89, 618, [[0, 0]]],
      [89, 967, [[0, 0]]],
      [89, 977, [[0, 0]]],
      [89, 1002, [[0, 0]]],
      [13, 109, [[0, 0]]],
      [109, 618, [[0, 0]]],
      [109, 977, [[0, 0]]],
      [
        923,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        928,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        930,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [934, 967, [[0, 91]]],
      [
        962,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        966,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        582,
        967,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [618, 967, [[0, 91]]],
      [
        907,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        909,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        967,
        970,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [133, 962, [[0, 32]]],
      [134, 962, [[0, 32]]],
      [
        930,
        962,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        962,
        969,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        962,
        970,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [1, 133, [[0, 32]]],
      [3, 133, [[0, 32]]],
      [133, 970, [[0, 32]]],
      [1, 2, [[0, 32]]],
      [1, 131, [[0, 32]]],
      [1, 930, [[0, 32]]],
      [2, 930, [[0, 32]]],
      [131, 930, [[0, 32]]],
      [2, 3, [[0, 32]]],
      [3, 131, [[0, 32]]],
      [3, 930, [[0, 32]]],
      [4, 134, [[0, 32]]],
      [134, 970, [[0, 32]]],
      [4, 132, [[0, 32]]],
      [132, 558, [[0, 32]]],
      [132, 873, [[0, 32]]],
      [132, 935, [[0, 32]]],
      [360, 907, [[0, 3]]],
      [
        582,
        907,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        874,
        907,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        903,
        907,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        907,
        947,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [96, 616, [[0, 0]]],
      [582, 616, [[0, 0]]],
      [616, 618, [[0, 0]]],
      [616, 970, [[0, 0]]],
      [89, 96, [[0, 0]]],
      [
        930,
        942,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [739, 942, [[0, 91]]],
      [
        942,
        969,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [597, 638, [[0, 3]]],
      [638, 645, [[0, 3]]],
      [638, 652, [[0, 3]]],
      [638, 943, [[0, 65]]],
      [610, 645, [[0, 3]]],
      [645, 652, [[0, 3]]],
      [540, 639, [[0, 65]]],
      [639, 646, [[0, 3]]],
      [639, 932, [[0, 3]]],
      [640, 642, [[0, 65]]],
      [582, 640, [[0, 65]]],
      [593, 640, [[0, 3]]],
      [597, 640, [[0, 3]]],
      [640, 641, [[0, 65]]],
      [640, 643, [[0, 65]]],
      [640, 652, [[0, 3]]],
      [640, 873, [[0, 65]]],
      [640, 874, [[0, 65]]],
      [640, 927, [[0, 65]]],
      [396, 642, [[0, 3]]],
      [642, 652, [[0, 3]]],
      [642, 873, [[0, 65]]],
      [582, 643, [[0, 65]]],
      [597, 643, [[0, 3]]],
      [540, 647, [[0, 65]]],
      [647, 652, [[0, 3]]],
      [610, 648, [[0, 3]]],
      [648, 652, [[0, 3]]],
      [540, 649, [[0, 65]]],
      [610, 649, [[0, 3]]],
      [645, 649, [[0, 3]]],
      [647, 649, [[0, 65]]],
      [648, 649, [[0, 3]]],
      [649, 652, [[0, 3]]],
      [582, 921, [[0, 65]]],
      [597, 921, [[0, 3]]],
      [769, 776, [[0, 65]]],
      [197, 769, [[0, 65]]],
      [508, 769, [[0, 65]]],
      [553, 769, [[0, 3]]],
      [554, 769, [[0, 65]]],
      [582, 769, [[0, 65]]],
      [597, 769, [[0, 3]]],
      [633, 769, [[0, 65]]],
      [769, 921, [[0, 65]]],
      [769, 928, [[0, 65]]],
      [769, 930, [[0, 65]]],
      [775, 776, [[0, 65]]],
      [123, 776, [[0, 65]]],
      [555, 776, [[0, 3]]],
      [554, 776, [[0, 65]]],
      [582, 776, [[0, 65]]],
      [618, 776, [[0, 65]]],
      [739, 776, [[0, 65]]],
      [776, 873, [[0, 65]]],
      [776, 934, [[0, 65]]],
      [776, 935, [[0, 65]]],
      [771, 775, [[0, 65]]],
      [772, 775, [[0, 65]]],
      [773, 775, [[0, 65]]],
      [774, 775, [[0, 65]]],
      [552, 775, [[0, 3]]],
      [555, 775, [[0, 3]]],
      [775, 874, [[0, 65]]],
      [770, 771, [[0, 3]]],
      [314, 771, [[0, 3]]],
      [319, 771, [[0, 3]]],
      [771, 984, [[0, 3]]],
      [771, 987, [[0, 65]]],
      [233, 770, [[0, 3]]],
      [314, 770, [[0, 3]]],
      [319, 770, [[0, 3]]],
      [770, 984, [[0, 3]]],
      [770, 992, [[0, 3]]],
      [771, 772, [[0, 65]]],
      [358, 773, [[0, 3]]],
      [739, 773, [[0, 65]]],
      [360, 774, [[0, 3]]],
      [552, 774, [[0, 3]]],
      [739, 774, [[0, 65]]],
      [754, 774, [[0, 3]]],
      [756, 774, [[0, 3]]],
      [
        508,
        510,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        116,
        508,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        118,
        508,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [218, 508, [[0, 3]]],
      [
        508,
        512,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [508, 513, [[0, 3]]],
      [508, 520, [[0, 3]]],
      [
        508,
        521,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [508, 522, [[0, 3]]],
      [508, 593, [[0, 3]]],
      [508, 597, [[0, 3]]],
      [508, 599, [[0, 3]]],
      [
        508,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        508,
        601,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [508, 602, [[0, 3]]],
      [
        508,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        508,
        705,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        508,
        708,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        508,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        508,
        736,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        508,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        508,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [510, 599, [[0, 3]]],
      [
        510,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [513, 520, [[0, 3]]],
      [520, 522, [[0, 3]]],
      [520, 599, [[0, 3]]],
      [516, 521, [[0, 3]]],
      [521, 522, [[0, 3]]],
      [218, 521, [[0, 3]]],
      [513, 521, [[0, 3]]],
      [520, 521, [[0, 3]]],
      [521, 593, [[0, 3]]],
      [521, 597, [[0, 3]]],
      [521, 599, [[0, 3]]],
      [
        521,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        521,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        521,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [516, 602, [[0, 3]]],
      [599, 602, [[0, 3]]],
      [599, 601, [[0, 3]]],
      [
        600,
        601,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        705,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        197,
        708,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        654,
        708,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [661, 708, [[0, 91]]],
      [
        659,
        661,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        660,
        661,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        662,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        663,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        664,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        665,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        666,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        661,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        197,
        661,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        579,
        661,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [593, 661, [[0, 3]]],
      [
        654,
        661,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        655,
        661,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        656,
        661,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [661, 667, [[0, 3]]],
      [661, 707, [[0, 91]]],
      [
        661,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        661,
        731,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [661, 732, [[0, 3]]],
      [
        654,
        659,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        654,
        660,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        654,
        662,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        663,
        665,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        654,
        663,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        654,
        665,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        663,
        664,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        664,
        665,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        654,
        664,
        [
          [0, 81],
          [83, 91]
        ]
      ],
      [
        486,
        666,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        666,
        731,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        197,
        731,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [485, 731, [[0, 3]]],
      [488, 731, [[0, 91]]],
      [491, 731, [[0, 91]]],
      [593, 731, [[0, 3]]],
      [597, 731, [[0, 3]]],
      [599, 731, [[0, 3]]],
      [
        655,
        731,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [728, 731, [[0, 91]]],
      [118, 488, [[0, 91]]],
      [
        197,
        488,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [486, 488, [[0, 91]]],
      [488, 597, [[0, 3]]],
      [
        488,
        873,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [488, 928, [[0, 91]]],
      [488, 728, [[0, 91]]],
      [
        655,
        728,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        654,
        656,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [562, 667, [[0, 3]]],
      [593, 707, [[0, 3]]],
      [597, 707, [[0, 3]]],
      [
        654,
        707,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        705,
        707,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [707, 708, [[0, 91]]],
      [
        707,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        707,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [197, 732, [[0, 3]]],
      [599, 732, [[0, 3]]],
      [606, 732, [[0, 3]]],
      [599, 606, [[0, 3]]],
      [218, 736, [[0, 3]]],
      [
        730,
        736,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [118, 633, [[0, 65]]],
      [189, 633, [[0, 65]]],
      [211, 633, [[0, 65]]],
      [593, 633, [[0, 3]]],
      [621, 633, [[0, 65]]],
      [633, 635, [[0, 65]]],
      [633, 636, [[0, 3]]],
      [633, 874, [[0, 65]]],
      [633, 909, [[0, 65]]],
      [621, 635, [[0, 65]]],
      [621, 636, [[0, 3]]],
      [635, 636, [[0, 3]]],
      [635, 652, [[0, 3]]],
      [
        635,
        873,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        635,
        874,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        635,
        927,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [636, 652, [[0, 3]]],
      [118, 1007, [[0, 65]]],
      [593, 1007, [[0, 3]]],
      [597, 1007, [[0, 3]]],
      [599, 1007, [[0, 3]]],
      [909, 1007, [[0, 65]]],
      [1007, 1018, [[0, 65]]],
      [118, 1018, [[0, 65]]],
      [580, 1018, [[0, 65]]],
      [730, 1018, [[0, 65]]],
      [928, 1018, [[0, 65]]],
      [218, 580, [[0, 3]]],
      [492, 580, [[0, 65]]],
      [580, 873, [[0, 65]]],
      [1012, 1013, [[0, 65]]],
      [314, 1013, [[0, 3]]],
      [320, 1013, [[0, 3]]],
      [238, 1012, [[0, 65]]],
      [349, 1012, [[0, 3]]],
      [358, 1012, [[0, 3]]],
      [314, 1012, [[0, 3]]],
      [319, 1012, [[0, 3]]],
      [320, 1012, [[0, 3]]],
      [377, 1012, [[0, 3]]],
      [394, 1012, [[0, 3]]],
      [396, 1012, [[0, 3]]],
      [597, 1012, [[0, 3]]],
      [960, 1012, [[0, 3]]],
      [978, 1012, [[0, 3]]],
      [984, 1012, [[0, 3]]],
      [618, 1016, [[0, 65]]],
      [1008, 1017, [[0, 28]]],
      [1017, 1022, [[0, 65]]],
      [1017, 1024, [[0, 65]]],
      [1017, 1025, [[0, 3]]],
      [599, 1017, [[0, 3]]],
      [617, 1017, [[0, 65]]],
      [1008, 1024, [[0, 28]]],
      [1008, 1025, [[0, 3]]],
      [593, 1008, [[0, 3]]],
      [1022, 1024, [[0, 65]]],
      [1023, 1024, [[0, 3]]],
      [1008, 1022, [[0, 28]]],
      [1019, 1023, [[0, 3]]],
      [1014, 1019, [[0, 3]]],
      [1015, 1019, [[0, 3]]],
      [1009, 1014, [[0, 3]]],
      [1014, 1015, [[0, 3]]],
      [1009, 1011, [[0, 3]]],
      [597, 1009, [[0, 3]]],
      [597, 1011, [[0, 3]]],
      [597, 1015, [[0, 3]]],
      [599, 1025, [[0, 3]]],
      [250, 874, [[0, 65]]],
      [250, 892, [[0, 65]]],
      [251, 562, [[0, 3]]],
      [251, 739, [[0, 65]]],
      [251, 911, [[0, 65]]],
      [251, 969, [[0, 65]]],
      [252, 582, [[0, 65]]],
      [252, 589, [[0, 65]]],
      [252, 911, [[0, 65]]],
      [252, 969, [[0, 65]]],
      [118, 589, [[0, 65]]],
      [589, 593, [[0, 3]]],
      [118, 253, [[0, 65]]],
      [123, 253, [[0, 65]]],
      [253, 561, [[0, 65]]],
      [253, 911, [[0, 65]]],
      [254, 488, [[0, 65]]],
      [254, 911, [[0, 65]]],
      [255, 874, [[0, 65]]],
      [255, 358, [[0, 3]]],
      [255, 360, [[0, 3]]],
      [256, 911, [[0, 65]]],
      [257, 309, [[0, 65]]],
      [257, 319, [[0, 3]]],
      [257, 360, [[0, 3]]],
      [257, 396, [[0, 3]]],
      [257, 407, [[0, 3]]],
      [257, 874, [[0, 65]]],
      [257, 913, [[0, 65]]],
      [257, 960, [[0, 3]]],
      [257, 976, [[0, 3]]],
      [309, 358, [[0, 3]]],
      [309, 319, [[0, 3]]],
      [309, 360, [[0, 3]]],
      [309, 391, [[0, 3]]],
      [309, 874, [[0, 65]]],
      [309, 940, [[0, 3]]],
      [309, 976, [[0, 3]]],
      [258, 319, [[0, 3]]],
      [258, 911, [[0, 65]]],
      [259, 874, [[0, 65]]],
      [260, 618, [[0, 65]]],
      [260, 874, [[0, 65]]],
      [260, 909, [[0, 65]]],
      [261, 874, [[0, 65]]],
      [261, 308, [[0, 65]]],
      [261, 358, [[0, 3]]],
      [261, 360, [[0, 3]]],
      [261, 368, [[0, 3]]],
      [261, 394, [[0, 3]]],
      [261, 403, [[0, 3]]],
      [261, 652, [[0, 3]]],
      [261, 947, [[0, 65]]],
      [261, 959, [[0, 65]]],
      [261, 969, [[0, 65]]],
      [261, 1005, [[0, 3]]],
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
        869,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [308, 874, [[0, 65]]],
      [308, 905, [[0, 65]]],
      [308, 913, [[0, 65]]],
      [308, 960, [[0, 3]]],
      [308, 976, [[0, 3]]],
      [308, 991, [[0, 3]]],
      [308, 999, [[0, 3]]],
      [360, 869, [[0, 3]]],
      [988, 991, [[0, 3]]],
      [360, 999, [[0, 3]]],
      [984, 999, [[0, 3]]],
      [360, 1005, [[0, 3]]],
      [595, 1005, [[0, 3]]],
      [262, 874, [[0, 65]]],
      [262, 358, [[0, 3]]],
      [262, 360, [[0, 3]]],
      [262, 582, [[0, 65]]],
      [262, 969, [[0, 65]]],
      [263, 319, [[0, 3]]],
      [263, 911, [[0, 65]]],
      [264, 319, [[0, 3]]],
      [264, 558, [[0, 65]]],
      [264, 764, [[0, 3]]],
      [264, 767, [[0, 3]]],
      [264, 911, [[0, 65]]],
      [265, 319, [[0, 3]]],
      [265, 911, [[0, 65]]],
      [267, 779, [[0, 65]]],
      [267, 874, [[0, 65]]],
      [319, 779, [[0, 3]]],
      [778, 779, [[0, 65]]],
      [779, 948, [[0, 65]]],
      [246, 289, [[0, 65]]],
      [248, 289, [[0, 65]]],
      [269, 289, [[0, 65]]],
      [288, 289, [[0, 65]]],
      [289, 290, [[0, 65]]],
      [289, 298, [[0, 65]]],
      [289, 319, [[0, 3]]],
      [289, 874, [[0, 65]]],
      [289, 911, [[0, 65]]],
      [289, 936, [[0, 65]]],
      [289, 969, [[0, 65]]],
      [7, 246, [[0, 65]]],
      [246, 319, [[0, 3]]],
      [246, 880, [[0, 27]]],
      [246, 911, [[0, 65]]],
      [8, 248, [[0, 65]]],
      [248, 319, [[0, 3]]],
      [248, 880, [[0, 27]]],
      [248, 911, [[0, 65]]],
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
      [269, 558, [[0, 65]]],
      [269, 597, [[0, 3]]],
      [269, 873, [[0, 65]]],
      [269, 874, [[0, 65]]],
      [269, 880, [[0, 27]]],
      [269, 911, [[0, 65]]],
      [269, 914, [[0, 65]]],
      [269, 969, [[0, 65]]],
      [269, 984, [[0, 3]]],
      [269, 987, [[0, 65]]],
      [273, 285, [[0, 65]]],
      [285, 358, [[0, 3]]],
      [285, 360, [[0, 3]]],
      [272, 273, [[0, 65]]],
      [272, 274, [[0, 65]]],
      [272, 358, [[0, 3]]],
      [272, 319, [[0, 3]]],
      [272, 396, [[0, 3]]],
      [272, 582, [[0, 65]]],
      [272, 873, [[0, 65]]],
      [272, 979, [[0, 65]]],
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
      [288, 880, [[0, 27]]],
      [288, 911, [[0, 65]]],
      [288, 914, [[0, 65]]],
      [199, 290, [[0, 65]]],
      [285, 290, [[0, 65]]],
      [273, 290, [[0, 65]]],
      [272, 290, [[0, 65]]],
      [290, 358, [[0, 3]]],
      [290, 319, [[0, 3]]],
      [290, 558, [[0, 65]]],
      [290, 874, [[0, 65]]],
      [290, 911, [[0, 65]]],
      [290, 914, [[0, 65]]],
      [290, 969, [[0, 65]]],
      [290, 984, [[0, 3]]],
      [52, 298, [[0, 65]]],
      [199, 298, [[0, 65]]],
      [285, 298, [[0, 65]]],
      [272, 298, [[0, 65]]],
      [298, 358, [[0, 3]]],
      [298, 319, [[0, 3]]],
      [298, 558, [[0, 65]]],
      [298, 874, [[0, 65]]],
      [298, 880, [[0, 27]]],
      [298, 911, [[0, 65]]],
      [298, 914, [[0, 65]]],
      [298, 984, [[0, 3]]],
      [159, 291, [[0, 65]]],
      [291, 360, [[0, 3]]],
      [291, 874, [[0, 65]]],
      [292, 873, [[0, 65]]],
      [292, 874, [[0, 65]]],
      [292, 892, [[0, 65]]],
      [292, 358, [[0, 3]]],
      [292, 360, [[0, 3]]],
      [292, 597, [[0, 3]]],
      [292, 909, [[0, 65]]],
      [292, 969, [[0, 65]]],
      [292, 1005, [[0, 3]]],
      [293, 874, [[0, 65]]],
      [293, 905, [[0, 65]]],
      [293, 360, [[0, 3]]],
      [294, 911, [[0, 65]]],
      [295, 304, [[0, 65]]],
      [295, 319, [[0, 3]]],
      [295, 874, [[0, 65]]],
      [295, 911, [[0, 65]]],
      [295, 984, [[0, 3]]],
      [304, 319, [[0, 3]]],
      [304, 360, [[0, 3]]],
      [304, 558, [[0, 65]]],
      [304, 822, [[0, 65]]],
      [304, 874, [[0, 65]]],
      [304, 880, [[0, 27]]],
      [304, 905, [[0, 65]]],
      [304, 960, [[0, 3]]],
      [296, 874, [[0, 65]]],
      [296, 308, [[0, 65]]],
      [296, 358, [[0, 3]]],
      [296, 360, [[0, 3]]],
      [296, 368, [[0, 3]]],
      [296, 403, [[0, 3]]],
      [297, 874, [[0, 65]]],
      [297, 319, [[0, 3]]],
      [297, 999, [[0, 3]]],
      [299, 304, [[0, 65]]],
      [299, 911, [[0, 65]]],
      [300, 360, [[0, 3]]],
      [300, 874, [[0, 65]]],
      [301, 360, [[0, 3]]],
      [301, 874, [[0, 65]]],
      [303, 874, [[0, 65]]],
      [302, 303, [[0, 65]]],
      [303, 360, [[0, 3]]],
      [303, 322, [[0, 3]]],
      [303, 969, [[0, 65]]],
      [302, 905, [[0, 65]]],
      [302, 870, [[0, 3]]],
      [302, 872, [[0, 3]]],
      [305, 873, [[0, 65]]],
      [305, 874, [[0, 65]]],
      [167, 305, [[0, 65]]],
      [169, 305, [[0, 3]]],
      [172, 305, [[0, 3]]],
      [305, 360, [[0, 3]]],
      [305, 396, [[0, 3]]],
      [305, 558, [[0, 65]]],
      [305, 597, [[0, 3]]],
      [305, 864, [[0, 65]]],
      [305, 880, [[0, 27]]],
      [305, 906, [[0, 65]]],
      [305, 960, [[0, 3]]],
      [305, 971, [[0, 65]]],
      [305, 984, [[0, 3]]],
      [864, 874, [[0, 65]]],
      [969, 971, [[0, 65]]],
      [970, 971, [[0, 65]]],
      [360, 971, [[0, 3]]],
      [558, 971, [[0, 65]]],
      [873, 971, [[0, 65]]],
      [874, 971, [[0, 65]]],
      [880, 971, [[0, 27]]],
      [306, 874, [[0, 65]]],
      [306, 319, [[0, 3]]],
      [307, 873, [[0, 65]]],
      [307, 874, [[0, 65]]],
      [307, 319, [[0, 3]]],
      [307, 948, [[0, 65]]],
      [346, 358, [[0, 3]]],
      [317, 346, [[0, 3]]],
      [593, 596, [[0, 3]]],
      [596, 599, [[0, 3]]],
      [
        462,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        527,
        528,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        527,
        529,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        529,
        530,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [360, 980, [[0, 3]]],
      [
        28,
        42,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        28,
        43,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        28,
        44,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        28,
        116,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [28, 218, [[0, 3]]],
      [
        28,
        489,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [28, 562, [[0, 3]]],
      [42, 218, [[0, 3]]],
      [42, 562, [[0, 3]]],
      [
        42,
        923,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        42,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        43,
        116,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        43,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [44, 45, [[0, 3]]],
      [
        44,
        119,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        44,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [45, 220, [[0, 3]]],
      [220, 562, [[0, 3]]],
      [
        119,
        197,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [119, 220, [[0, 3]]],
      [119, 563, [[0, 3]]],
      [
        116,
        489,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [489, 597, [[0, 3]]],
      [
        489,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        46,
        122,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        46,
        123,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        46,
        125,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        46,
        519,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [46, 593, [[0, 3]]],
      [
        46,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        46,
        707,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        46,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        515,
        519,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [519, 599, [[0, 3]]],
      [
        519,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [513, 515, [[0, 3]]],
      [
        515,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        654,
        726,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        726,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        125,
        726,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        197,
        726,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        707,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        29,
        116,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        29,
        129,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        29,
        579,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [29, 593, [[0, 3]]],
      [29, 599, [[0, 3]]],
      [
        29,
        600,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        30,
        116,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [495, 593, [[0, 3]]],
      [
        120,
        514,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        123,
        514,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [494, 514, [[0, 13]]],
      [514, 519, [[0, 13]]],
      [514, 593, [[0, 3]]],
      [514, 597, [[0, 3]]],
      [514, 720, [[0, 13]]],
      [
        514,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [197, 494, [[0, 13]]],
      [494, 597, [[0, 3]]],
      [494, 654, [[0, 13]]],
      [
        122,
        720,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        197,
        720,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        504,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        512,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [593, 720, [[0, 3]]],
      [597, 720, [[0, 3]]],
      [
        600,
        720,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        601,
        720,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        720,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        658,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        661,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        664,
        720,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        668,
        720,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        705,
        720,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        707,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        708,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        717,
        720,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        720,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        720,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        118,
        504,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [504, 597, [[0, 3]]],
      [
        504,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        504,
        705,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        504,
        708,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        504,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        658,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        197,
        658,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [593, 658, [[0, 3]]],
      [599, 658, [[0, 3]]],
      [657, 658, [[0, 3]]],
      [
        658,
        707,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        658,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [658, 732, [[0, 3]]],
      [217, 657, [[0, 3]]],
      [218, 657, [[0, 3]]],
      [
        654,
        668,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        197,
        717,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        717,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        664,
        717,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        717,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        197,
        727,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [513, 727, [[0, 3]]],
      [522, 727, [[0, 3]]],
      [
        579,
        727,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [593, 727, [[0, 3]]],
      [597, 727, [[0, 3]]],
      [599, 727, [[0, 3]]],
      [
        654,
        727,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        656,
        727,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [667, 727, [[0, 3]]],
      [
        707,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        727,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [727, 732, [[0, 3]]],
      [
        609,
        626,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        618,
        626,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        627,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        628,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        630,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        631,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        632,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        626,
        635,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        627,
        632,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        618,
        632,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [632, 636, [[0, 3]]],
      [
        623,
        628,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        625,
        628,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        197,
        628,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        622,
        628,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        628,
        630,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        628,
        632,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        623,
        634,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        634,
        873,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        625,
        635,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        622,
        630,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        118,
        630,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        630,
        634,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        618,
        631,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        630,
        631,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        631,
        634,
        [
          [0, 80],
          [89, 91]
        ]
      ],
      [
        631,
        635,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        654,
        680,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        680,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        681,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        682,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        684,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        686,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [685, 686, [[0, 3]]],
      [
        669,
        686,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        686,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [686, 734, [[0, 3]]],
      [685, 734, [[0, 3]]],
      [597, 734, [[0, 3]]],
      [
        123,
        669,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [593, 669, [[0, 3]]],
      [599, 669, [[0, 3]]],
      [
        669,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        687,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [512, 687, [[0, 91]]],
      [
        116,
        688,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        688,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        689,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        690,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        690,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        691,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        691,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        692,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        679,
        693,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        693,
        724,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        693,
        725,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        693,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        679,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        724,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        725,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        123,
        677,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        129,
        677,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        579,
        677,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [593, 677, [[0, 3]]],
      [597, 677, [[0, 3]]],
      [599, 677, [[0, 3]]],
      [
        600,
        677,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        677,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        656,
        677,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        665,
        677,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        677,
        707,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [677, 711, [[0, 14]]],
      [
        677,
        719,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        677,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [677, 732, [[0, 3]]],
      [677, 733, [[0, 3]]],
      [
        677,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        677,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [597, 711, [[0, 3]]],
      [654, 711, [[0, 14]]],
      [705, 711, [[0, 14]]],
      [708, 711, [[0, 14]]],
      [
        123,
        719,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        197,
        719,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [599, 719, [[0, 3]]],
      [
        654,
        719,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        661,
        719,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        719,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [593, 733, [[0, 3]]],
      [732, 733, [[0, 3]]],
      [
        118,
        710,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        710,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [218, 710, [[0, 3]]],
      [513, 710, [[0, 3]]],
      [522, 710, [[0, 3]]],
      [593, 710, [[0, 3]]],
      [599, 710, [[0, 3]]],
      [
        600,
        710,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        710,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        664,
        710,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        707,
        710,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        710,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        710,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        710,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        500,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [500, 593, [[0, 3]]],
      [
        671,
        673,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        673,
        675,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        673,
        676,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        673,
        678,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [599, 673, [[0, 3]]],
      [667, 673, [[0, 3]]],
      [673, 716, [[0, 91]]],
      [513, 671, [[0, 3]]],
      [522, 671, [[0, 3]]],
      [
        654,
        671,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [667, 671, [[0, 3]]],
      [671, 709, [[0, 3]]],
      [671, 732, [[0, 3]]],
      [671, 733, [[0, 3]]],
      [513, 709, [[0, 3]]],
      [
        669,
        675,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        675,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [513, 675, [[0, 3]]],
      [522, 675, [[0, 3]]],
      [
        654,
        675,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [675, 709, [[0, 3]]],
      [
        123,
        676,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [513, 676, [[0, 3]]],
      [
        654,
        676,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [676, 709, [[0, 3]]],
      [
        123,
        678,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [513, 678, [[0, 3]]],
      [522, 678, [[0, 3]]],
      [
        654,
        678,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        678,
        707,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        678,
        715,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        678,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        123,
        715,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [513, 715, [[0, 3]]],
      [
        704,
        715,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [513, 704, [[0, 3]]],
      [
        654,
        704,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        123,
        716,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        125,
        716,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [218, 716, [[0, 3]]],
      [513, 716, [[0, 3]]],
      [517, 716, [[0, 3]]],
      [522, 716, [[0, 3]]],
      [593, 716, [[0, 3]]],
      [597, 716, [[0, 3]]],
      [599, 716, [[0, 3]]],
      [
        600,
        716,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        601,
        716,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        654,
        716,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        658,
        716,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        664,
        716,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        705,
        716,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        707,
        716,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        708,
        716,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        716,
        717,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        716,
        726,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        716,
        727,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        716,
        730,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [716, 732, [[0, 3]]],
      [716, 733, [[0, 3]]],
      [
        716,
        735,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        716,
        737,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        716,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        716,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        716,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [218, 517, [[0, 3]]],
      [513, 735, [[0, 3]]],
      [522, 735, [[0, 3]]],
      [
        654,
        735,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [522, 737, [[0, 3]]],
      [593, 737, [[0, 3]]],
      [599, 737, [[0, 3]]],
      [
        737,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        670,
        674,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        671,
        674,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        674,
        675,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        674,
        676,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [599, 674, [[0, 3]]],
      [674, 716, [[0, 91]]],
      [
        123,
        670,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [513, 670, [[0, 3]]],
      [522, 670, [[0, 3]]],
      [
        654,
        670,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        670,
        930,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        122,
        126,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        116,
        126,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        126,
        508,
        [
          [0, 87],
          [89, 91]
        ]
      ],
      [
        126,
        512,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [
        126,
        654,
        [
          [0, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        126,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        197,
        506,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [506, 562, [[0, 3]]],
      [
        506,
        968,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        174,
        968,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [360, 968, [[0, 3]]],
      [371, 968, [[0, 3]]],
      [
        582,
        968,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [940, 968, [[0, 3]]],
      [
        947,
        968,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [960, 968, [[0, 3]]],
      [968, 984, [[0, 3]]],
      [174, 358, [[0, 3]]],
      [174, 360, [[0, 3]]],
      [174, 396, [[0, 3]]],
      [
        174,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [569, 582, [[0, 16]]],
      [569, 907, [[0, 16]]],
      [573, 575, [[0, 16]]],
      [573, 574, [[0, 16]]],
      [11, 574, [[0, 16]]],
      [574, 582, [[0, 16]]],
      [9, 11, [[0, 16]]],
      [9, 873, [[0, 16]]],
      [576, 654, [[0, 16]]],
      [576, 679, [[0, 16]]],
      [209, 577, [[0, 16]]],
      [577, 582, [[0, 16]]],
      [32, 578, [[0, 16]]],
      [33, 578, [[0, 16]]],
      [35, 578, [[0, 16]]],
      [37, 578, [[0, 16]]],
      [118, 578, [[0, 16]]],
      [197, 578, [[0, 16]]],
      [209, 578, [[0, 16]]],
      [566, 578, [[0, 16]]],
      [570, 578, [[0, 16]]],
      [571, 578, [[0, 16]]],
      [578, 582, [[0, 16]]],
      [578, 585, [[0, 16]]],
      [578, 588, [[0, 16]]],
      [578, 703, [[0, 16]]],
      [578, 726, [[0, 16]]],
      [578, 729, [[0, 16]]],
      [578, 1002, [[0, 16]]],
      [32, 922, [[0, 16]]],
      [32, 956, [[0, 16]]],
      [922, 936, [[0, 16]]],
      [922, 956, [[0, 16]]],
      [922, 969, [[0, 16]]],
      [33, 36, [[0, 16]]],
      [33, 123, [[0, 16]]],
      [33, 497, [[0, 16]]],
      [33, 593, [[0, 3]]],
      [33, 930, [[0, 16]]],
      [36, 125, [[0, 16]]],
      [36, 129, [[0, 16]]],
      [36, 593, [[0, 3]]],
      [36, 654, [[0, 16]]],
      [36, 705, [[0, 16]]],
      [36, 708, [[0, 16]]],
      [36, 730, [[0, 16]]],
      [36, 908, [[0, 16]]],
      [123, 497, [[0, 16]]],
      [129, 497, [[0, 16]]],
      [497, 511, [[0, 16]]],
      [497, 512, [[0, 16]]],
      [497, 513, [[0, 3]]],
      [497, 593, [[0, 3]]],
      [497, 606, [[0, 3]]],
      [497, 707, [[0, 16]]],
      [497, 908, [[0, 16]]],
      [497, 909, [[0, 16]]],
      [123, 511, [[0, 16]]],
      [35, 40, [[0, 16]]],
      [35, 41, [[0, 16]]],
      [35, 194, [[0, 16]]],
      [35, 531, [[0, 16]]],
      [35, 532, [[0, 16]]],
      [35, 582, [[0, 16]]],
      [35, 930, [[0, 16]]],
      [40, 930, [[0, 16]]],
      [41, 532, [[0, 16]]],
      [531, 532, [[0, 16]]],
      [532, 582, [[0, 16]]],
      [532, 873, [[0, 16]]],
      [532, 903, [[0, 16]]],
      [532, 909, [[0, 16]]],
      [
        531,
        582,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        531,
        930,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        38,
        194,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [
        39,
        194,
        [
          [0, 86],
          [89, 91]
        ]
      ],
      [194, 909, [[0, 16]]],
      [39, 531, [[0, 16]]],
      [37, 118, [[0, 16]]],
      [37, 487, [[0, 16]]],
      [37, 909, [[0, 16]]],
      [116, 487, [[0, 16]]],
      [486, 487, [[0, 16]]],
      [566, 568, [[0, 16]]],
      [565, 566, [[0, 16]]],
      [564, 568, [[0, 16]]],
      [564, 873, [[0, 16]]],
      [565, 567, [[0, 16]]],
      [564, 567, [[0, 16]]],
      [570, 582, [[0, 16]]],
      [570, 936, [[0, 16]]],
      [11, 571, [[0, 16]]],
      [571, 582, [[0, 16]]],
      [585, 587, [[0, 16]]],
      [584, 585, [[0, 16]]],
      [583, 587, [[0, 16]]],
      [587, 588, [[0, 16]]],
      [587, 597, [[0, 3]]],
      [583, 873, [[0, 16]]],
      [583, 588, [[0, 16]]],
      [588, 597, [[0, 3]]],
      [584, 586, [[0, 16]]],
      [583, 586, [[0, 16]]],
      [586, 588, [[0, 16]]],
      [586, 597, [[0, 3]]],
      [694, 703, [[0, 16]]],
      [697, 703, [[0, 16]]],
      [699, 703, [[0, 16]]],
      [701, 703, [[0, 16]]],
      [123, 694, [[0, 16]]],
      [512, 694, [[0, 16]]],
      [513, 694, [[0, 3]]],
      [694, 706, [[0, 16]]],
      [694, 707, [[0, 16]]],
      [694, 713, [[0, 16]]],
      [694, 714, [[0, 16]]],
      [694, 715, [[0, 16]]],
      [694, 725, [[0, 16]]],
      [694, 726, [[0, 16]]],
      [694, 909, [[0, 16]]],
      [122, 706, [[0, 16]]],
      [123, 706, [[0, 16]]],
      [197, 706, [[0, 16]]],
      [513, 706, [[0, 3]]],
      [654, 706, [[0, 16]]],
      [706, 713, [[0, 16]]],
      [706, 726, [[0, 16]]],
      [123, 713, [[0, 16]]],
      [513, 713, [[0, 3]]],
      [713, 718, [[0, 16]]],
      [123, 718, [[0, 16]]],
      [123, 714, [[0, 16]]],
      [125, 714, [[0, 16]]],
      [593, 714, [[0, 3]]],
      [600, 714, [[0, 16]]],
      [714, 726, [[0, 16]]],
      [697, 726, [[0, 16]]],
      [697, 729, [[0, 16]]],
      [697, 947, [[0, 16]]],
      [197, 729, [[0, 16]]],
      [653, 729, [[0, 16]]],
      [729, 730, [[0, 16]]],
      [653, 873, [[0, 16]]],
      [33, 699, [[0, 16]]],
      [36, 699, [[0, 16]]],
      [501, 699, [[0, 16]]],
      [699, 700, [[0, 16]]],
      [672, 699, [[0, 16]]],
      [699, 726, [[0, 16]]],
      [123, 501, [[0, 16]]],
      [501, 509, [[0, 16]]],
      [501, 736, [[0, 16]]],
      [123, 509, [[0, 16]]],
      [509, 593, [[0, 3]]],
      [509, 597, [[0, 3]]],
      [509, 606, [[0, 3]]],
      [509, 909, [[0, 16]]],
      [509, 930, [[0, 16]]],
      [123, 700, [[0, 16]]],
      [127, 700, [[0, 16]]],
      [122, 127, [[0, 16]]],
      [123, 127, [[0, 16]]],
      [127, 654, [[0, 16]]],
      [672, 704, [[0, 16]]],
      [123, 672, [[0, 16]]],
      [497, 672, [[0, 16]]],
      [501, 672, [[0, 16]]],
      [506, 672, [[0, 16]]],
      [512, 672, [[0, 16]]],
      [513, 672, [[0, 3]]],
      [523, 672, [[0, 3]]],
      [672, 706, [[0, 16]]],
      [672, 707, [[0, 16]]],
      [672, 714, [[0, 16]]],
      [672, 715, [[0, 16]]],
      [672, 717, [[0, 16]]],
      [672, 722, [[0, 16]]],
      [672, 723, [[0, 16]]],
      [672, 726, [[0, 16]]],
      [672, 730, [[0, 16]]],
      [513, 523, [[0, 3]]],
      [123, 722, [[0, 16]]],
      [125, 722, [[0, 16]]],
      [513, 722, [[0, 3]]],
      [704, 722, [[0, 16]]],
      [707, 722, [[0, 16]]],
      [722, 726, [[0, 16]]],
      [722, 909, [[0, 16]]],
      [123, 723, [[0, 16]]],
      [513, 723, [[0, 3]]],
      [696, 701, [[0, 16]]],
      [701, 726, [[0, 16]]],
      [701, 730, [[0, 16]]],
      [513, 696, [[0, 3]]],
      [695, 696, [[0, 16]]],
      [696, 698, [[0, 16]]],
      [696, 702, [[0, 16]]],
      [696, 712, [[0, 16]]],
      [695, 730, [[0, 16]]],
      [698, 730, [[0, 16]]],
      [698, 734, [[0, 3]]],
      [702, 726, [[0, 16]]],
      [702, 730, [[0, 16]]],
      [702, 909, [[0, 16]]],
      [118, 712, [[0, 16]]],
      [123, 712, [[0, 16]]],
      [197, 712, [[0, 16]]],
      [512, 712, [[0, 16]]],
      [654, 712, [[0, 16]]],
      [707, 712, [[0, 16]]],
      [712, 713, [[0, 16]]],
      [712, 718, [[0, 16]]],
      [712, 726, [[0, 16]]],
      [712, 730, [[0, 16]]],
      [712, 909, [[0, 16]]],
      [
        873,
        957,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        957,
        977,
        [
          [0, 80],
          [83, 86],
          [89, 91]
        ]
      ],
      [
        957,
        1001,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [
        957,
        1002,
        [
          [0, 80],
          [83, 86],
          [89, 91]
        ]
      ],
      [
        873,
        1001,
        [
          [0, 80],
          [83, 91]
        ]
      ],
      [613, 652, [[0, 3]]],
      [759, 760, [[0, 20]]],
      [759, 782, [[0, 20]]],
      [618, 759, [[0, 20]]],
      [739, 759, [[0, 20]]],
      [758, 759, [[0, 3]]],
      [781, 782, [[0, 20]]],
      [782, 783, [[0, 3]]],
      [360, 782, [[0, 3]]],
      [781, 783, [[0, 3]]],
      [360, 781, [[0, 3]]],
      [758, 781, [[0, 3]]],
      [781, 935, [[0, 20]]],
      [781, 940, [[0, 3]]],
      [360, 783, [[0, 3]]],
      [493, 783, [[0, 3]]],
      [493, 597, [[0, 3]]],
      [758, 994, [[0, 3]]],
      [394, 614, [[0, 3]]],
      [892, 900, [[0, 23]]],
      [894, 900, [[0, 91]]],
      [895, 900, [[0, 91]]],
      [896, 900, [[0, 91]]],
      [897, 900, [[0, 91]]],
      [893, 900, [[0, 23]]],
      [900, 903, [[0, 91]]],
      [892, 894, [[0, 23]]],
      [894, 903, [[0, 91]]],
      [894, 896, [[0, 91]]],
      [
        874,
        894,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [892, 896, [[0, 23]]],
      [896, 903, [[0, 91]]],
      [892, 895, [[0, 23]]],
      [895, 903, [[0, 91]]],
      [894, 895, [[0, 91]]],
      [892, 897, [[0, 23]]],
      [897, 903, [[0, 91]]],
      [894, 897, [[0, 91]]],
      [896, 897, [[0, 91]]],
      [892, 893, [[0, 23]]],
      [893, 898, [[0, 23]]],
      [
        118,
        128,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        128,
        176,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        128,
        197,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [128, 485, [[0, 3]]],
      [128, 597, [[0, 3]]],
      [
        128,
        923,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        128,
        928,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        176,
        618,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        176,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        176,
        874,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        176,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [176, 984, [[0, 3]]],
      [202, 360, [[0, 3]]],
      [202, 652, [[0, 3]]],
      [
        202,
        739,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        202,
        967,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        202,
        987,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        202,
        1006,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        739,
        1006,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        123,
        503,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [503, 599, [[0, 3]]],
      [
        503,
        909,
        [
          [0, 82],
          [89, 91]
        ]
      ],
      [360, 535, [[0, 3]]],
      [
        535,
        536,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        535,
        537,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [535, 538, [[0, 3]]],
      [
        535,
        611,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        535,
        617,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        535,
        934,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        535,
        967,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [360, 543, [[0, 3]]],
      [
        471,
        543,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        542,
        543,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        543,
        544,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [543, 546, [[0, 3]]],
      [543, 597, [[0, 3]]],
      [
        543,
        611,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        543,
        617,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [543, 652, [[0, 3]]],
      [
        543,
        873,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        543,
        934,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        543,
        944,
        [
          [0, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        543,
        967,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [
        543,
        969,
        [
          [0, 12],
          [84, 84]
        ]
      ],
      [543, 984, [[0, 3]]],
      [
        540,
        542,
        [
          [0, 84],
          [89, 91]
        ]
      ],
      [360, 548, [[0, 3]]],
      [547, 548, [[0, 3]]],
      [
        548,
        549,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [
        548,
        551,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        548,
        934,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [548, 969, [[0, 12]]],
      [548, 984, [[0, 3]]],
      [
        550,
        551,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [197, 551, [[0, 3]]],
      [
        551,
        582,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        551,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        550,
        873,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [593, 594, [[0, 3]]],
      [594, 595, [[0, 3]]],
      [360, 594, [[0, 3]]],
      [
        594,
        877,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [599, 605, [[0, 3]]],
      [605, 969, [[0, 12]]],
      [599, 607, [[0, 3]]],
      [319, 612, [[0, 3]]],
      [396, 612, [[0, 3]]],
      [612, 652, [[0, 3]]],
      [
        612,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [394, 651, [[0, 3]]],
      [651, 652, [[0, 3]]],
      [651, 986, [[0, 3]]],
      [358, 986, [[0, 3]]],
      [360, 986, [[0, 3]]],
      [320, 986, [[0, 3]]],
      [363, 986, [[0, 3]]],
      [364, 986, [[0, 3]]],
      [368, 986, [[0, 3]]],
      [394, 986, [[0, 3]]],
      [313, 738, [[0, 3]]],
      [360, 740, [[0, 3]]],
      [
        739,
        740,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [358, 797, [[0, 3]]],
      [314, 797, [[0, 3]]],
      [360, 797, [[0, 3]]],
      [362, 797, [[0, 3]]],
      [380, 797, [[0, 3]]],
      [383, 797, [[0, 3]]],
      [755, 797, [[0, 3]]],
      [314, 755, [[0, 3]]],
      [362, 755, [[0, 3]]],
      [
        913,
        919,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [360, 919, [[0, 3]]],
      [386, 919, [[0, 3]]],
      [652, 919, [[0, 3]]],
      [
        919,
        947,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        470,
        982,
        [
          [0, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        983,
        987,
        [
          [0, 83],
          [89, 91]
        ]
      ],
      [360, 983, [[0, 3]]],
      [652, 983, [[0, 3]]],
      [652, 989, [[0, 3]]],
      [485, 1000, [[0, 3]]],
      [1010, 1012, [[3, 3]]],
      [394, 1010, [[3, 3]]],
      [
        536,
        873,
        [
          [10, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        536,
        927,
        [
          [10, 83],
          [89, 91]
        ]
      ],
      [
        536,
        979,
        [
          [10, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        496,
        909,
        [
          [14, 82],
          [89, 91]
        ]
      ],
      [
        46,
        505,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        123,
        505,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        505,
        518,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        505,
        725,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        518,
        654,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        46,
        496,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        123,
        496,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        496,
        499,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        496,
        514,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        496,
        519,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        499,
        505,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        499,
        507,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        123,
        507,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        507,
        514,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        507,
        654,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        507,
        727,
        [
          [14, 87],
          [89, 91]
        ]
      ],
      [
        514,
        654,
        [
          [14, 81],
          [83, 83],
          [89, 91]
        ]
      ],
      [1017, 1021, [[29, 65]]],
      [470, 1021, [[29, 65]]],
      [1021, 1022, [[29, 65]]],
      [425, 438, [[30, 91]]],
      [396, 425, [[30, 91]]],
      [407, 425, [[30, 91]]],
      [
        851,
        905,
        [
          [30, 78],
          [80, 82],
          [89, 91]
        ]
      ],
      [268, 289, [[30, 65]]],
      [268, 911, [[30, 65]]],
      [291, 987, [[37, 65]]],
      [360, 390, [[43, 91]]],
      [360, 392, [[43, 91]]],
      [360, 395, [[43, 91]]],
      [326, 392, [[43, 91]]],
      [326, 395, [[43, 91]]],
      [324, 392, [[43, 91]]],
      [324, 395, [[43, 91]]],
      [330, 392, [[43, 91]]],
      [327, 392, [[43, 91]]],
      [327, 395, [[43, 91]]],
      [328, 392, [[43, 91]]],
      [328, 395, [[43, 91]]],
      [319, 390, [[43, 91]]],
      [319, 393, [[43, 91]]],
      [319, 395, [[43, 91]]],
      [343, 395, [[43, 91]]],
      [320, 395, [[43, 91]]],
      [379, 395, [[43, 91]]],
      [395, 396, [[43, 91]]],
      [320, 392, [[43, 91]]],
      [314, 392, [[43, 91]]],
      [314, 395, [[43, 91]]],
      [394, 395, [[43, 91]]],
      [318, 390, [[43, 91]]],
      [322, 395, [[43, 91]]],
      [317, 390, [[43, 91]]],
      [317, 393, [[43, 91]]],
      [317, 395, [[43, 91]]],
      [323, 392, [[43, 91]]],
      [323, 395, [[43, 91]]],
      [319, 392, [[43, 91]]],
      [380, 392, [[43, 91]]],
      [383, 392, [[43, 91]]],
      [380, 395, [[43, 91]]],
      [374, 395, [[43, 91]]],
      [382, 395, [[43, 91]]],
      [383, 395, [[43, 91]]],
      [375, 395, [[43, 91]]],
      [378, 391, [[43, 91]]],
      [378, 395, [[43, 91]]],
      [389, 395, [[43, 91]]],
      [384, 395, [[43, 91]]],
      [387, 395, [[43, 91]]],
      [381, 395, [[43, 91]]],
      [368, 395, [[43, 91]]],
      [232, 395, [[43, 91]]],
      [363, 395, [[43, 91]]],
      [365, 395, [[43, 91]]],
      [364, 395, [[43, 91]]],
      [390, 415, [[43, 91]]],
      [311, 390, [[43, 91]]],
      [390, 395, [[43, 91]]],
      [395, 975, [[43, 91]]],
      [395, 747, [[43, 91]]],
      [369, 395, [[43, 91]]],
      [342, 390, [[43, 91]]],
      [352, 395, [[43, 91]]],
      [390, 393, [[43, 91]]],
      [393, 396, [[43, 91]]],
      [370, 395, [[43, 91]]],
      [388, 395, [[43, 91]]],
      [222, 395, [[43, 91]]],
      [223, 395, [[43, 91]]],
      [367, 395, [[43, 91]]],
      [329, 392, [[43, 91]]],
      [329, 395, [[43, 91]]],
      [332, 392, [[43, 91]]],
      [332, 395, [[43, 91]]],
      [333, 392, [[43, 91]]],
      [333, 395, [[43, 91]]],
      [334, 392, [[43, 91]]],
      [334, 395, [[43, 91]]],
      [336, 392, [[43, 91]]],
      [336, 395, [[43, 91]]],
      [
        710,
        717,
        [
          [52, 87],
          [89, 91]
        ]
      ],
      [
        192,
        202,
        [
          [54, 83],
          [89, 91]
        ]
      ],
      [
        192,
        739,
        [
          [54, 83],
          [89, 91]
        ]
      ],
      [
        192,
        1006,
        [
          [54, 83],
          [89, 91]
        ]
      ],
      [
        116,
        491,
        [
          [67, 83],
          [89, 91]
        ]
      ],
      [
        112,
        486,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        970,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        873,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        491,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        195,
        490,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        195,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        923,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        195,
        923,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        195,
        930,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        874,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        901,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        0,
        913,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        913,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        195,
        911,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        739,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        229,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        0,
        609,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        609,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        0,
        112,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        545,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        909,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        683,
        909,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        27,
        112,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        27,
        193,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        193,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        0,
        903,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        987,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        28,
        112,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        116,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        116,
        195,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        123,
        195,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        195,
        498,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        661,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        731,
        [
          [71, 80],
          [83, 91]
        ]
      ],
      [
        112,
        669,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        716,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        727,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        195,
        508,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        720,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        46,
        112,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        29,
        112,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        496,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        499,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        507,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        514,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        626,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        624,
        628,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        628,
        629,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        195,
        628,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        624,
        637,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        112,
        637,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        629,
        637,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        112,
        622,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        622,
        637,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        195,
        630,
        [
          [71, 80],
          [89, 91]
        ]
      ],
      [
        112,
        680,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        681,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        682,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        683,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        684,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        689,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        690,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        691,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        693,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        677,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        967,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        0,
        907,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        195,
        907,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        154,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        955,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        477,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        849,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        171,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        202,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        195,
        202,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        274,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        274,
        920,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        920,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        873,
        920,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        535,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        112,
        543,
        [
          [71, 80],
          [83, 84],
          [89, 91]
        ]
      ],
      [
        112,
        651,
        [
          [71, 80],
          [83, 83],
          [89, 91]
        ]
      ],
      [
        227,
        874,
        [
          [79, 79],
          [83, 83]
        ]
      ],
      [
        240,
        905,
        [
          [79, 79],
          [83, 84]
        ]
      ],
      [
        240,
        844,
        [
          [79, 79],
          [83, 84]
        ]
      ],
      [
        240,
        582,
        [
          [79, 79],
          [83, 84]
        ]
      ],
      [
        240,
        840,
        [
          [79, 79],
          [83, 84]
        ]
      ],
      [
        240,
        850,
        [
          [79, 79],
          [83, 84]
        ]
      ],
      [
        227,
        582,
        [
          [79, 79],
          [83, 83]
        ]
      ],
      [122, 909, [[83, 84]]],
      [122, 664, [[83, 88]]],
      [117, 503, [[83, 83]]],
      [124, 503, [[83, 83]]],
      [25, 117, [[83, 83]]],
      [28, 117, [[83, 86]]],
      [30, 117, [[83, 86]]],
      [116, 117, [[83, 86]]],
      [122, 508, [[83, 83]]],
      [124, 508, [[83, 87]]],
      [26, 124, [[83, 83]]],
      [46, 124, [[83, 87]]],
      [29, 124, [[83, 87]]],
      [112, 124, [[83, 83]]],
      [122, 124, [[83, 83]]],
      [123, 124, [[83, 87]]],
      [124, 496, [[83, 87]]],
      [124, 512, [[83, 88]]],
      [124, 514, [[83, 87]]],
      [124, 561, [[83, 83]]],
      [124, 683, [[83, 83]]],
      [124, 677, [[83, 87]]],
      [124, 707, [[83, 87]]],
      [124, 710, [[83, 87]]],
      [124, 730, [[83, 83]]],
      [512, 721, [[83, 88]]],
      [122, 673, [[83, 83]]],
      [122, 716, [[83, 83]]],
      [124, 716, [[83, 88]]],
      [122, 674, [[83, 83]]],
      [654, 721, [[83, 83]]],
      [680, 721, [[83, 83]]],
      [681, 721, [[83, 83]]],
      [682, 721, [[83, 83]]],
      [684, 721, [[83, 83]]],
      [686, 721, [[83, 87]]],
      [687, 721, [[83, 88]]],
      [688, 721, [[83, 87]]],
      [689, 721, [[83, 83]]],
      [690, 721, [[83, 87]]],
      [691, 721, [[83, 87]]],
      [692, 721, [[83, 83]]],
      [693, 721, [[83, 83]]],
      [122, 710, [[83, 83]]],
      [27, 875, [[84, 88]]],
      [950, 969, [[84, 84]]],
      [875, 911, [[84, 84]]],
      [875, 876, [[84, 88]]],
      [876, 969, [[84, 88]]],
      [618, 969, [[84, 84]]],
      [873, 969, [[84, 88]]],
      [892, 969, [[84, 88]]],
      [900, 969, [[84, 88]]],
      [620, 875, [[84, 84]]],
      [875, 877, [[84, 84]]],
      [877, 878, [[84, 88]]],
      [618, 875, [[84, 84]]],
      [875, 935, [[84, 84]]],
      [175, 875, [[84, 84]]],
      [854, 875, [[84, 84]]],
      [875, 913, [[84, 84]]],
      [878, 913, [[84, 88]]],
      [875, 987, [[84, 84]]],
      [875, 948, [[84, 84]]],
      [903, 969, [[84, 86]]],
      [609, 875, [[84, 84]]],
      [537, 875, [[84, 84]]],
      [545, 875, [[84, 84]]],
      [549, 875, [[84, 84]]],
      [875, 924, [[84, 84]]],
      [924, 969, [[84, 84]]],
      [875, 934, [[84, 84]]],
      [148, 875, [[84, 84]]],
      [875, 954, [[84, 84]]],
      [954, 969, [[84, 84]]],
      [875, 907, [[84, 84]]],
      [848, 875, [[84, 84]]],
      [875, 899, [[84, 84]]],
      [238, 875, [[84, 84]]],
      [238, 969, [[84, 84]]],
      [866, 875, [[84, 84]]],
      [865, 875, [[84, 84]]],
      [558, 878, [[84, 84]]],
      [875, 878, [[84, 84]]],
      [878, 948, [[84, 88]]],
      [858, 875, [[84, 84]]],
      [852, 875, [[84, 84]]],
      [875, 963, [[84, 84]]],
      [875, 892, [[84, 84]]],
      [901, 969, [[84, 86]]],
      [604, 875, [[84, 84]]],
      [894, 969, [[84, 86]]],
      [619, 970, [[85, 88]]],
      [910, 970, [[85, 88]]],
      [909, 910, [[85, 88]]],
      [558, 617, [[85, 88]]],
      [122, 910, [[85, 88]]],
      [654, 910, [[85, 88]]],
      [617, 619, [[85, 88]]],
      [894, 901, [[87, 88]]],
      [130, 500, [[88, 88]]],
      [124, 130, [[88, 88]]],
      [130, 512, [[88, 88]]]
    ]
  }
}
