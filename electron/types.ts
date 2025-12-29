/**
 * DLsite作品の情報を格納する型
 */
export interface WorkInfo {
    /** RJコード（例: RJ123456） */
    rjCode: string
    /** 作品タイトル */
    title: string
    /** サークル名 */
    circle: string
    /** 作者名（複数の場合あり） */
    authors: string[]
    /** タグ一覧 */
    tags: string[]
    /** あらすじ */
    description: string
    /** サムネイル画像URL */
    thumbnailUrl: string
    /** ローカルフォルダパス */
    localPath: string
    /** 情報取得日時 */
    fetchedAt: string
    /** 発売日 */
    releaseDate?: string
    /** 年齢レーティング */
    ageRating?: string
    /** 作品形式（マンガ、CG・イラスト、ゲームなど） */
    workType?: string
    /** 非表示フラグ */
    isHidden?: boolean
    /** 最後に読んだ日時 */
    lastReadAt?: string
    /** 最後に読んだページ（0始まり） */
    lastReadPage?: number
    /** 総ページ数 */
    totalPages?: number
    /** サンプル画像URL一覧 */
    sampleImages?: string[]
    /** お気に入りフラグ */
    isFavorite?: boolean
    /** 読書ステータス */
    readingStatus?: 'unread' | 'reading' | 'completed'
    /** 綴じ方向 */
    bindingDirection?: 'rtl' | 'ltr'
}

/**
 * ライブラリデータ全体の型
 */
export interface LibraryData {
    /** ライブラリのバージョン */
    version: string
    /** 最終更新日時 */
    lastUpdated: string
    /** スキャン対象のフォルダパス */
    scanPaths: string[]
    /** 作品情報のマップ（RJコード -> WorkInfo） */
    works: Record<string, WorkInfo>
}

/**
 * スキャン結果の型
 */
export interface ScanResult {
    /** 成功した作品数 */
    success: number
    /** 失敗した作品数 */
    failed: number
    /** スキャンされたフォルダ数 */
    totalFolders: number
    /** 新規追加された作品のRJコード */
    newWorks: string[]
    /** エラーメッセージ（あれば） */
    errors: string[]
}

/**
 * 監視フォルダの設定
 */
export interface LibraryPathConfig {
    /** フォルダのフルパス */
    path: string
    /** DLsiteのみでスクレイピングするかどうか */
    onlyDLsite: boolean
}

/**
 * アプリ設定の型
 */
export interface AppSettings {
    /** スキャン対象フォルダのリスト */
    libraryPaths: (string | LibraryPathConfig)[]
    /** 自動スキャンの有効/無効 */
    autoScan: boolean
    /** スクレイピング時のリクエスト間隔（ミリ秒） */
    requestDelay: number
    /** 伏字が含まれる可能性のある検索ワード */
    fuzzyWords?: string[]
    /** ビューアのテーマ */
    viewerTheme?: 'black' | 'dark' | 'sepia' | 'white'
    /** デフォルトの綴じ方向 */
    defaultBindingDirection?: 'rtl' | 'ltr'
}

/**
 * 画像情報の型
 */
export interface ImageInfo {
    /** 画像のID（インデックス） */
    index: number
    /** ファイル名 */
    filename: string
    /** 画像のソース（フォルダ内ファイルの場合はパス、アーカイブの場合はエントリ名） */
    source: string
    /** ソースタイプ */
    sourceType: 'folder' | 'zip'
}

/**
 * ビューアデータの型
 */
export interface ViewerData {
    /** 作品のローカルパス */
    workPath: string
    /** 総画像数 */
    totalImages: number
    /** 画像情報リスト */
    images: ImageInfo[]
    /** ソースタイプ */
    sourceType: 'folder' | 'zip'
    /** アーカイブパス（アーカイブの場合） */
    archivePath?: string
}
