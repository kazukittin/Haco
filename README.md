# Haco

モダンなデスクトップアプリケーション - Electron + React + TypeScript + Vite

## 技術スタック

- **Electron** - クロスプラットフォームデスクトップアプリ
- **React 18** - UIライブラリ
- **TypeScript** - 型安全なJavaScript
- **Vite** - 高速なビルドツール
- **Tailwind CSS** - ユーティリティファーストCSS

## 開発

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

### プロダクションビルド

```bash
npm run build
```

## プロジェクト構造

```
haco/
├── electron/           # Electronメインプロセス
│   ├── main.ts        # メインエントリーポイント
│   └── preload.ts     # プリロードスクリプト
├── src/               # Reactフロントエンド
│   ├── App.tsx        # メインコンポーネント
│   ├── main.tsx       # Reactエントリーポイント
│   └── index.css      # グローバルスタイル
├── public/            # 静的アセット
├── index.html         # HTMLテンプレート
├── vite.config.ts     # Vite設定
├── tailwind.config.js # Tailwind CSS設定
└── package.json       # プロジェクト設定
```
