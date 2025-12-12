# 四万十町グルメガイド 🚃

## プロジェクト概要
- **名前**: 四万十町グルメガイド (shimanto-restaurant-guide)
- **目的**: 汽車で訪れる観光客向けの地元高校生おすすめ飲食店ガイド
- **主な機能**: 
  - お店一覧表示（ジャンル別フィルタリング）
  - 地図表示（Google Maps連携、ズームレベル16）
  - 写真スポット情報
  - Google Sheetsからのデータ取得
  - レスポンシブデザイン（スマホ・タブレット対応）
  - 高速データ読み込み（並列処理・バックグラウンドジオコーディング）

## URLs
- **本番環境**: https://shimanto-restaurant-guide.pages.dev
- **最新デプロイ**: https://9262f495.shimanto-restaurant-guide.pages.dev
- **GitHub**: https://github.com/kikuchimmmy/shimantogourmet

## データアーキテクチャ
- **データソース**: Google Sheets（公開CSV）
  - お店データ: シートID `1itlpjo95O019S1EZYI3k9dJ0prRivYd9drMH8icTpAI` (gid=0)
  - 写真スポット: シートID `1itlpjo95O019S1EZYI3k9dJ0prRivYd9drMH8icTpAI` (gid=1446929807)
- **外部サービス**: 
  - Google Maps API（地図表示・ジオコーディング）
  - Google Drive（画像ホスティング）
- **データフロー**: 
  1. フロントエンドがAPIリクエスト
  2. バックエンドがGoogle SheetsからCSVを取得
  3. CSVをパースしてJSON形式で返却
  4. フロントエンドが地図とリストを表示

## 開発環境
```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# サンドボックス開発サーバー起動（PM2使用）
pm2 start ecosystem.config.cjs

# ポートクリーンアップ
npm run clean-port

# サーバーテスト
npm test
```

## デプロイ
```bash
# Cloudflare Pagesにデプロイ
npm run deploy:prod
```

## 技術スタック
- **バックエンド**: Hono + TypeScript
- **フロントエンド**: Vanilla JavaScript + TailwindCSS
- **デプロイ**: Cloudflare Pages
- **データ**: Google Sheets (CSV)
- **地図**: Google Maps API

## プロジェクト構造
```
webapp/
├── src/
│   ├── index.tsx          # メインアプリケーション
│   └── renderer.tsx       # HTMLレンダラー
├── public/
│   └── static/
│       ├── app.js         # フロントエンドロジック
│       └── style.css      # スタイル定義
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc         # Cloudflare設定
└── package.json
```

## 実装済み機能
- ✅ Google Sheetsからのお店データ取得
- ✅ Google Sheetsからの写真スポットデータ取得
- ✅ ジャンル別フィルタリング（お店＋おすすめスポット）
- ✅ おすすめスポット一覧表示・クリックで地図表示
- ✅ Google Maps地図表示（ズームレベル16）
- ✅ レスポンシブデザイン（スマホ・タブレット対応）
- ✅ Google Drive画像プロキシ（CORS回避）
- ✅ ジオコーディングAPI（並列処理・高速化）

## 未実装機能
- ⬜ お店の詳細情報モーダル
- ⬜ ルート検索機能
- ⬜ お気に入り機能
- ⬜ 口コミ・レビュー投稿機能

## 推奨される次のステップ
1. Google Maps API keyの設定（環境変数 `GOOGLE_MAPS_API_KEY`）
2. お店詳細情報の表示機能追加
3. ユーザーレビュー機能の実装
4. パフォーマンス最適化（画像の遅延読み込み）
5. アクセシビリティの向上

## デプロイ状況
- **プラットフォーム**: Cloudflare Pages
- **ステータス**: ✅ 本番環境稼働中
- **最終更新**: 2025-12-12
- **地図初期位置**: 四万十町中心部 (緯度: 33.2180, 経度: 132.9360)
- **データ**: レストラン12店舗、写真スポット10箇所
