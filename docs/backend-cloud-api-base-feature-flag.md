# 案 B: バックエンドの `/features` に `comfy_api_base` を追加する

## 背景

ComfyUI バックエンドは `--comfy-api-base` CLI フラグで Comfy Cloud の API ベース URL（prod / staging / カスタム）を選択する。
フロントエンドは `__USE_PROD_CONFIG__` ビルド時定数で同じ値を選ぶ。
両者が食い違うと、フロントエンドが発行した Firebase トークン（または API キー）が
バックエンド経由で別の環境に投げられ、認証や課金が落ちる。

現状の検出方法（案 A、`src/views/ConnectionPanelView.vue`）は
`/api/system_stats` の `system.argv`（CLI 全引数）から `--comfy-api-base` を grep するもの。
動くが脆い：

- 引数の書式（`--flag VALUE` vs `--flag=VALUE`）に依存する
- バックエンド側の CLI シグネチャが変わると壊れる
- 「公開 API ではない情報」を検出ロジックに使っている

## 提案

ComfyUI 本体の `/features` エンドポイントに `comfy_api_base` を追加する。
`/features` はすでに「構造化された機能/設定の公開 API」という位置付けがあり、ここに含めるのが自然。

### バックエンドの実装スケッチ

```python
# tmp/ComfyUI/comfy_api/feature_flags.py:65 付近
def get_server_features() -> dict[str, Any]:
    from comfy.cli_args import args
    return {
        ...,
        "comfy_api_base": args.comfy_api_base,
    }
```

### フロントエンドの変更

```ts
// 例: src/platform/connectionPanel/ あたりに移設
const features = await fetch(`${base}/api/features`).then((r) => r.json())
const backendCloudBase =
  features.comfy_api_base ?? parseBackendCloudBase(stats.system?.argv)
```

`features.comfy_api_base` を優先し、未定義の場合のみ `argv` フォールバックを使う。

## メリット

- 構造化された公開 API になり、CLI 変更の影響を受けない
- 拡張機能 / カスタムノードからも安定して参照できる
- 既存の `/features` パターン（ファースト クラスのバックエンド能力公開）に合致
- フロントエンドの検出コードが自明になる

## デメリット

- `Comfy-Org/ComfyUI` 本体への PR とリリースが必要
- リリース前は案 A をフォールバックとして残す必要がある
- `comfy_api_base` を「公開してよい情報」と扱う合意が必要
  （カスタム URL を使うユーザーには内部 URL が露出することになる）

## ロードマップ

1. **案 A をフロントエンドに実装（このコミット）**
   - `ConnectionPanelView.vue` で `/system_stats` の `argv` を解析
   - 不一致を検出した場合は黄色の警告を表示
2. `Comfy-Org/ComfyUI` に `/features` 拡張 PR を提出
   - `comfy_api/feature_flags.py:65` に `comfy_api_base` を追加
3. 本体リリース後、フロントエンドを `features.comfy_api_base` 優先に切替
   - `argv` フォールバックは互換性のために残す
4. 数バージョン後、`argv` フォールバックを削除

## 関連ファイル

- ComfyUI 本体: `comfy/cli_args.py:229` — `--comfy-api-base` 引数定義（デフォルト `https://api.comfy.org`）
- ComfyUI 本体: `comfy_api/feature_flags.py:65` — `get_server_features()` の現状
- ComfyUI 本体: `server.py:646-685` — `/system_stats` ハンドラ（`argv` を返している）
- フロントエンド: `src/config/comfyApi.ts:21-31` — `getComfyApiBaseUrl()`（フロント側のビルド時定数）
- フロントエンド: `src/views/ConnectionPanelView.vue` — 案 A 実装場所
- フロントエンド: `src/platform/remoteConfig/refreshRemoteConfig.ts` — `/features` 既存利用
