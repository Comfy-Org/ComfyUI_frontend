export default {
  welcome: {
    title: 'ComfyUIへようこそ',
    getStarted: 'はじめる'
  },
  notSupported: {
    title: 'お使いのデバイスはサポートされていません',
    message: '以下のデバイスのみサポートされています:',
    learnMore: '詳細を見る',
    reportIssue: '問題を報告',
    supportedDevices: {
      macos: 'MacOS (M1以降)',
      windows: 'Windows (CUDA対応のNvidia GPU)'
    }
  },
  install: {
    installLocation: 'インストール先',
    migration: '移行',
    desktopSettings: 'デスクトップ設定',
    chooseInstallationLocation: 'インストール先を選択',
    systemLocations: 'システムの場所',
    failedToSelectDirectory: 'ディレクトリの選択に失敗しました',
    pathValidationFailed: 'パスの検証に失敗しました',
    installLocationDescription:
      'ComfyUIのユーザーデータを保存するディレクトリを選択してください。Python環境が選択した場所にインストールされます。選択したディスクに約15GBの空き容量が必要です。',
    installLocationTooltip:
      'ComfyUIのユーザーデータディレクトリ。保存内容:\n- Python環境\n- モデル\n- カスタムノード\n',
    appDataLocationTooltip:
      'ComfyUIのアプリデータディレクトリ。保存内容:\n- ログ\n- サーバー設定',
    appPathLocationTooltip:
      'ComfyUIのアプリ資産ディレクトリ。ComfyUIのコードとアセットを保存します',
    migrateFromExistingInstallation: '既存のインストールから移行',
    migrationSourcePathDescription:
      '既存のComfyUIインストールがある場合、既存のユーザーファイルやモデルを新しいインストールにコピー/リンクできます。',
    selectItemsToMigrate: '移行する項目を選択',
    migrationOptional:
      '移行は任意です。既存のインストールがない場合、このステップをスキップできます。',
    desktopAppSettings: 'デスクトップアプリの設定',
    desktopAppSettingsDescription:
      'ComfyUIのデスクトップでの動作を設定します。これらの設定は後で変更可能です。',
    settings: {
      autoUpdate: '自動更新',
      allowMetrics: 'クラッシュレポート',
      autoUpdateDescription:
        '更新が利用可能になると、自動的にダウンロードおよびインストールを行います。インストール前に通知が表示されます。',
      allowMetricsDescription:
        'ComfyUIの改善に協力してください。匿名のクラッシュレポートを送信します。個人情報やワークフロー内容は収集されません。この設定はいつでも無効にできます。',
      learnMoreAboutData: 'データ収集の詳細を見る',
      dataCollectionDialog: {
        title: 'データ収集について',
        whatWeCollect: '収集内容:',
        whatWeDoNotCollect: '収集しない内容:',
        errorReports: 'エラーメッセージとスタックトレース',
        systemInfo: 'ハードウェア、OSの種類、アプリのバージョン',
        personalInformation: '個人情報',
        workflowContent: 'ワークフロー内容',
        fileSystemInformation: 'ファイルシステム情報',
        workflowContents: 'ワークフロー内容',
        customNodeConfigurations: 'カスタムノード設定'
      }
    },
    customNodes: 'カスタムノード',
    customNodesDescription:
      '既存のComfyUIインストールからカスタムノードファイルを参照し、その依存関係をインストールします。'
  },
  serverStart: {
    reinstall: '再インストール',
    reportIssue: '問題を報告',
    openLogs: 'ログを開く',
    process: {
      'initial-state': '読み込み中...',
      'python-setup': 'Python環境を設定中...',
      'starting-server': 'ComfyUIサーバーを起動中...',
      ready: '完了中...',
      error: 'ComfyUIデスクトップを起動できません'
    }
  },
  serverConfig: {
    modifiedConfigs:
      '以下のサーバー設定を変更しました。変更を適用するには再起動してください。',
    revertChanges: '変更を元に戻す',
    restart: '再起動'
  },
  currentUser: '現在のユーザー',
  empty: '表示する項目がありません',
  noWorkflowsFound: 'ワークフローが見つかりませんでした。',
  comingSoon: '近日公開',
  firstTimeUIMessage:
    'あなたはこの新しいUIを初めて使用します。もし以前のUIに戻したい場合は、"Menu > Use new menu > Disabled"を選択してください。',
  download: 'ダウンロード',
  loadAllFolders: 'すべてのフォルダーを読み込む',
  refresh: '更新',
  terminal: 'ターミナル',
  logs: 'ログ',
  videoFailedToLoad: 'ビデオの読み込みに失敗しました',
  extensionName: '拡張機能名',
  reloadToApplyChanges: '変更を適用するには再読み込みしてください',
  insert: '挿入',
  systemInfo: 'システム情報',
  devices: 'デバイス',
  about: '情報',
  add: '追加',
  confirm: '確認',
  reset: 'リセット',
  resetKeybindingsTooltip: 'キーバインドをデフォルトに戻す',
  customizeFolder: 'フォルダーをカスタマイズ',
  icon: 'アイコン',
  color: '色',
  bookmark: 'ブックマーク',
  folder: 'フォルダー',
  star: 'スター',
  heart: 'ハート',
  file: 'ファイル',
  inbox: '受信箱',
  box: 'ボックス',
  briefcase: 'ブリーフケース',
  error: 'エラー',
  loading: '読み込み中',
  findIssues: '問題を探す',
  reportIssue: 'レポートを送信',
  reportIssueTooltip: 'エラーレポートをComfy Orgに送信',
  reportSent: 'レポートを送信しました',
  copyToClipboard: 'クリップボードにコピー',
  openNewIssue: '新しいIssueを開く',
  showReport: 'レポートを表示',
  imageFailedToLoad: '画像の読み込みに失敗しました',
  reconnecting: '再接続中',
  reconnected: '再接続しました',
  delete: '削除',
  rename: '名前を変更',
  customize: 'カスタマイズ',
  experimental: 'ベータ',
  deprecated: '非推奨',
  loadWorkflow: 'ワークフローを読み込む',
  goToNode: 'ノードへ移動',
  settings: '設定',
  searchWorkflows: 'ワークフローを検索',
  searchSettings: '設定を検索',
  searchNodes: 'ノードを検索',
  searchModels: 'モデルを検索',
  searchKeybindings: 'キーバインドを検索',
  searchExtensions: '拡張機能を検索',
  noResultsFound: '結果が見つかりませんでした',
  searchFailedMessage:
    '検索条件に一致する設定が見つかりませんでした。条件を変更して再試行してください。',
  noTasksFound: 'タスクが見つかりませんでした',
  noTasksFoundMessage: 'キューにタスクがありません。',
  newFolder: '新しいフォルダー',
  sideToolbar: {
    themeToggle: 'テーマの切り替え',
    queue: 'キュー',
    logout: 'ログアウト',
    nodeLibrary: 'ノードライブラリ',
    workflows: 'ワークフロー',
    browseTemplates: 'サンプルテンプレートを表示',
    openWorkflow: 'ローカルでワークフローを開く',
    newBlankWorkflow: '新しい空のワークフローを作成',
    nodeLibraryTab: {
      sortOrder: '並び順'
    },
    modelLibrary: 'モデルライブラリ',
    downloads: 'ダウンロード',
    queueTab: {
      showFlatList: 'フラットリストを表示',
      backToAllTasks: 'すべてのタスクに戻る',
      containImagePreview: '画像プレビューを含める',
      coverImagePreview: '画像プレビューに合わせる',
      clearPendingTasks: '保留中のタスクをクリア',
      filter: '出力をフィルタ',
      filters: {
        hideCached: 'キャッシュを非表示',
        hideCanceled: 'キャンセル済みを非表示'
      }
    }
  },
  menu: {
    hideMenu: 'メニューを隠す',
    showMenu: 'メニューを表示',
    batchCount: 'バッチ数',
    batchCountTooltip: 'ワークフロー生成回数',
    autoQueue: '自動キュー',
    disabled: '無効',
    disabledTooltip: 'ワークフローは自動的にキューに追加されません',
    instant: '即時',
    instantTooltip: '生成完了後すぐにキューに追加',
    change: '変更時',
    changeTooltip: '変更があるとキューに追加',
    queueWorkflow: 'キューに追加 (Shiftで先頭に)',
    queueWorkflowFront: '先頭に追加',
    queue: 'キュー',
    interrupt: '現在の実行を中止',
    refresh: 'ノードを更新',
    clipspace: 'クリップスペースを開く',
    resetView: 'ビューをリセット',
    clear: 'ワークフローをクリア',
    toggleBottomPanel: '下部パネルを切り替え'
  },
  templateWorkflows: {
    title: 'テンプレートを利用して開始'
  },
  graphCanvasMenu: {
    zoomIn: '拡大',
    zoomOut: '縮小',
    resetView: 'ビューをリセット',
    fitView: 'ビューに合わせる',
    selectMode: '選択モード',
    panMode: 'パンモード',
    toggleLinkVisibility: 'リンクの表示切り替え'
  },
  electronFileDownload: {
    inProgress: 'ダウンロード中',
    pause: 'ダウンロードを一時停止',
    paused: '一時停止',
    resume: 'ダウンロードを再開',
    cancel: 'ダウンロードをキャンセル',
    cancelled: 'キャンセルされました'
  }
}
