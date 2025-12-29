/// <reference types="vite/client" />

// ========================================
// 作品情報の型
// ========================================
export interface WorkInfo {
    rjCode: string
    title: string
    circle: string
    authors: string[]
    tags: string[]
    description: string
    thumbnailUrl: string
    localPath: string
    fetchedAt: string
    releaseDate?: string
    ageRating?: string
    workType?: string
    isHidden?: boolean
}

export interface LibraryData {
    version: string
    lastUpdated: string
    scanPaths: string[]
    works: Record<string, WorkInfo>
}

export interface ScanResult {
    success: number
    failed: number
    totalFolders: number
    newWorks: string[]
    errors: string[]
}

export interface AppSettings {
    libraryPaths: string[]
    autoScan: boolean
    requestDelay: number
}

export interface ScanProgress {
    current: number
    total: number
    rjCode: string
    status: string
}

export interface TagCount {
    tag: string
    count: number
}

export interface CircleCount {
    circle: string
    count: number
}

// ========================================
// ビューア関連の型
// ========================================
export interface ImageInfo {
    index: number
    filename: string
    source: string
    sourceType: 'folder' | 'zip'
}

export interface ViewerData {
    workPath: string
    totalImages: number
    images: ImageInfo[]
    sourceType: 'folder' | 'zip'
    archivePath?: string
}

// ========================================
// Electron API の型定義
// ========================================
interface ElectronAPI {
    platform: string

    // ダイアログ
    selectFolder: () => Promise<string | null>

    // ライブラリ操作
    getLibraryData: () => Promise<LibraryData>
    scanLibrary: (scanPath: string) => Promise<ScanResult>
    searchWorks: (query: string) => Promise<WorkInfo[]>
    filterByTag: (tag: string) => Promise<WorkInfo[]>
    getAllTags: () => Promise<TagCount[]>
    getAllCircles: () => Promise<CircleCount[]>
    removeWork: (rjCode: string) => Promise<boolean>
    toggleWorkVisibility: (rjCode: string) => Promise<boolean>
    deleteWorkWithFiles: (rjCode: string) => Promise<{ success: boolean; error?: string }>
    cleanupMissingWorks: () => Promise<{ removed: string[]; errors: string[] }>
    onScanProgress: (callback: (data: ScanProgress) => void) => () => void

    // ビューア操作
    getViewerData: (workPath: string) => Promise<ViewerData | null>
    getImageData: (sourceType: 'folder' | 'zip', source: string, archivePath?: string) => Promise<string | null>
    getImagesList: (workPath: string) => Promise<{ images: string[]; sourceType: 'folder' | 'zip'; archivePath?: string; totalImages: number } | null>
    getImageDataByFilename: (workPath: string, filename: string) => Promise<string | null>

    // 設定
    getSettings: () => Promise<AppSettings>
    saveSettings: (settings: AppSettings) => Promise<boolean>

    // アプリ情報
    getUserDataPath: () => Promise<string>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
