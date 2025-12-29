import { contextBridge, ipcRenderer } from 'electron'

// スキャン進行状況のコールバック型
type ScanProgressCallback = (data: {
    current: number
    total: number
    rjCode: string
    status: string
}) => void

// レンダラープロセスに公開するAPI
const electronAPI = {
    // プラットフォーム情報
    platform: process.platform,

    // ========================================
    // ダイアログ
    // ========================================

    /** フォルダ選択ダイアログを開く */
    selectFolder: (): Promise<string | null> => {
        return ipcRenderer.invoke('dialog:selectFolder')
    },

    // ========================================
    // ライブラリ操作
    // ========================================

    /** ライブラリデータを取得 */
    getLibraryData: () => {
        return ipcRenderer.invoke('library:getData')
    },

    /** ライブラリをスキャン */
    scanLibrary: (scanPath: string) => {
        return ipcRenderer.invoke('library:scan', scanPath)
    },

    /** 作品を検索 */
    searchWorks: (query: string) => {
        return ipcRenderer.invoke('library:search', query)
    },

    /** タグでフィルタ */
    filterByTag: (tag: string) => {
        return ipcRenderer.invoke('library:filterByTag', tag)
    },

    /** 全タグを取得 */
    getAllTags: () => {
        return ipcRenderer.invoke('library:getAllTags')
    },

    /** 全サークルを取得 */
    getAllCircles: () => {
        return ipcRenderer.invoke('library:getAllCircles')
    },

    /** 作品を削除 */
    removeWork: (rjCode: string) => {
        return ipcRenderer.invoke('library:removeWork', rjCode)
    },

    /** 作品の非表示/表示を切り替え */
    toggleWorkVisibility: (rjCode: string) => {
        return ipcRenderer.invoke('library:toggleVisibility', rjCode)
    },

    /** 作品とファイルを削除 */
    deleteWorkWithFiles: (rjCode: string) => {
        return ipcRenderer.invoke('library:deleteWithFiles', rjCode)
    },

    /** 存在しないファイルの作品をクリーンアップ */
    cleanupMissingWorks: () => {
        return ipcRenderer.invoke('library:cleanupMissing')
    },

    /** 読書進捗を更新 */
    updateReadingProgress: (rjCode: string, currentPage: number, totalPages: number) => {
        return ipcRenderer.invoke('library:updateReadingProgress', rjCode, currentPage, totalPages)
    },

    /** 最近読んだ作品を取得 */
    getRecentlyReadWorks: (limit?: number) => {
        return ipcRenderer.invoke('library:getRecentlyRead', limit)
    },

    /** スキャン進行状況のリスナーを登録 */
    onScanProgress: (callback: ScanProgressCallback) => {
        const handler = (_event: Electron.IpcRendererEvent, data: Parameters<ScanProgressCallback>[0]) => {
            callback(data)
        }
        ipcRenderer.on('library:scanProgress', handler)

        // クリーンアップ関数を返す
        return () => {
            ipcRenderer.removeListener('library:scanProgress', handler)
        }
    },

    /** ライブラリ更新イベントのリスナー */
    onLibraryUpdated: (callback: () => void) => {
        const handler = () => callback()
        ipcRenderer.on('library:updated', handler)
        return () => {
            ipcRenderer.removeListener('library:updated', handler)
        }
    },

    /** 現在スキャン中か確認 */
    isScanning: () => {
        return ipcRenderer.invoke('library:isScanning')
    },

    /** スキャン状態変更イベントのリスナー */
    onScanStateChanged: (callback: (isScanning: boolean) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, isScanning: boolean) => {
            callback(isScanning)
        }
        ipcRenderer.on('library:scanStateChanged', handler)
        return () => {
            ipcRenderer.removeListener('library:scanStateChanged', handler)
        }
    },

    // ========================================
    // 設定
    // ========================================

    /** 設定を取得 */
    getSettings: () => {
        return ipcRenderer.invoke('settings:get')
    },

    /** 設定を保存 */
    saveSettings: (settings: unknown) => {
        return ipcRenderer.invoke('settings:save', settings)
    },

    // ========================================
    // ビューア関連
    // ========================================

    /** ビューアデータを取得（既存API） */
    getViewerData: (workPath: string) => {
        return ipcRenderer.invoke('viewer:getData', workPath)
    },

    /** 画像データを取得（既存API） */
    getImageData: (sourceType: 'folder' | 'zip', source: string, archivePath?: string) => {
        return ipcRenderer.invoke('viewer:getImage', sourceType, source, archivePath)
    },

    /** 画像リストを取得（新API） */
    getImagesList: (workPath: string) => {
        return ipcRenderer.invoke('viewer:get-images', workPath)
    },

    /** 画像データをBase64で取得（新API） */
    getImageDataByFilename: (workPath: string, filename: string) => {
        return ipcRenderer.invoke('viewer:get-image-data', workPath, filename)
    },

    // ========================================
    // アプリ情報
    // ========================================

    /** ユーザーデータフォルダのパスを取得 */
    getUserDataPath: () => {
        return ipcRenderer.invoke('app:getUserDataPath')
    },
}

// コンテキストブリッジでレンダラーに公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 型定義をエクスポート（TypeScript用）
export type ElectronAPI = typeof electronAPI
