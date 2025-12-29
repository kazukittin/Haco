import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import {
    loadLibraryData,
    saveLibraryData,
    loadSettings,
    saveSettings,
    scanAndUpdateLibrary,
    searchWorks,
    filterByTag,
    getAllTags,
    getAllCircles,
    toggleWorkVisibility,
    removeWorkFromLibrary,
    deleteWorkWithFiles,
    cleanupMissingWorks,
    updateReadingProgress,
    getRecentlyReadWorks,
    setupFolderWatcher,
    isScanning,
    resetAppData,
} from './library'
import { getViewerData, getImageData } from './viewer'
import type { AppSettings, LibraryData } from './types'

/**
 * すべてのIPCハンドラーを登録
 */
export function registerIPCHandlers(): void {
    // ========================================
    // フォルダ選択ダイアログ
    // ========================================
    ipcMain.handle('dialog:selectFolder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '作品フォルダを選択',
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        return result.filePaths[0]
    })

    // ========================================
    // ライブラリ関連
    // ========================================

    // ライブラリデータを取得
    ipcMain.handle('library:getData', () => {
        return loadLibraryData()
    })

    // ライブラリデータを保存
    ipcMain.handle('library:saveData', (_event, data: LibraryData) => {
        return saveLibraryData(data)
    })

    // スキャン中か確認
    ipcMain.handle('library:isScanning', () => {
        return isScanning()
    })

    // ライブラリをスキャン
    ipcMain.handle('library:scan', async (event, scanPath: string, onlyDLsite: boolean = false) => {
        const window = BrowserWindow.fromWebContents(event.sender)

        const result = await scanAndUpdateLibrary(scanPath, (current, total, rjCode, status) => {
            // 進行状況をレンダラーに送信
            if (window && !window.isDestroyed()) {
                window.webContents.send('library:scanProgress', {
                    current,
                    total,
                    rjCode,
                    status,
                })
            }
        }, onlyDLsite)

        return result
    })

    // 作品を検索
    ipcMain.handle('library:search', (_event, query: string) => {
        return searchWorks(query)
    })

    // タグでフィルタ
    ipcMain.handle('library:filterByTag', (_event, tag: string) => {
        return filterByTag(tag)
    })

    // 全タグを取得
    ipcMain.handle('library:getAllTags', () => {
        return getAllTags()
    })

    // 全サークルを取得
    ipcMain.handle('library:getAllCircles', () => {
        return getAllCircles()
    })

    // 作品を削除
    ipcMain.handle('library:removeWork', (_event, rjCode: string) => {
        const data = loadLibraryData()
        if (data.works[rjCode]) {
            delete data.works[rjCode]
            saveLibraryData(data)
            return true
        }
        return false
    })

    // 作品の非表示/表示を切り替え
    ipcMain.handle('library:toggleVisibility', (_event, rjCode: string) => {
        return toggleWorkVisibility(rjCode)
    })

    // 作品をライブラリから削除（ファイルも削除）
    ipcMain.handle('library:deleteWithFiles', (_event, rjCode: string) => {
        return deleteWorkWithFiles(rjCode)
    })

    // 存在しないファイルの作品をクリーンアップ
    ipcMain.handle('library:cleanupMissing', () => {
        return cleanupMissingWorks()
    })

    // 読書進捗を更新
    ipcMain.handle('library:updateReadingProgress', (_event, rjCode: string, currentPage: number, totalPages: number) => {
        return updateReadingProgress(rjCode, currentPage, totalPages)
    })

    // 最近読んだ作品を取得
    ipcMain.handle('library:getRecentlyRead', (_event, limit?: number) => {
        return getRecentlyReadWorks(limit)
    })

    // ========================================
    // 設定関連
    // ========================================

    // 設定を取得
    ipcMain.handle('settings:get', () => {
        return loadSettings()
    })

    // 設定を保存
    ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
        const success = saveSettings(settings)
        if (success) {
            // 監視設定を更新
            setupFolderWatcher()
        }
        return success
    })

    // ========================================
    // ビューア関連
    // ========================================

    // ビューアデータを取得（既存API）
    ipcMain.handle('viewer:getData', (_event, workPath: string) => {
        return getViewerData(workPath)
    })

    // 画像データを取得（既存API）
    ipcMain.handle('viewer:getImage', (_event, sourceType: 'folder' | 'zip', source: string, archivePath?: string) => {
        return getImageData(sourceType, source, archivePath)
    })

    // 画像リストを取得（新API: viewer:get-images）
    // 作品パスを受け取り、画像ファイル名のリストを自然順ソートで返す
    ipcMain.handle('viewer:get-images', (_event, workPath: string) => {
        const data = getViewerData(workPath)
        if (!data) return null
        return {
            images: data.images.map((img: any) => img.filename),
            sourceType: data.sourceType,
            archivePath: data.archivePath,
            totalImages: data.totalImages,
        }
    })

    // 画像データをBase64で取得（新API: viewer:get-image-data）
    // 作品パスとファイル名を受け取り、Base64データを返す
    ipcMain.handle('viewer:get-image-data', (_event, workPath: string, filename: string) => {
        const data = getViewerData(workPath)
        if (!data) return null

        // ファイル名から対応するImageInfoを探す
        const imageInfo = data.images.find((img: any) => img.filename === filename)
        if (!imageInfo) return null

        return getImageData(imageInfo.sourceType, imageInfo.source, data.archivePath)
    })

    // ========================================
    // アプリ情報
    // ========================================

    // アプリのデータフォルダパスを取得
    ipcMain.handle('app:getUserDataPath', () => {
        return app.getPath('userData')
    })

    // アプリデータをリセット
    ipcMain.handle('system:reset', async () => {
        return resetAppData()
    })

    // アプリを再起動
    ipcMain.handle('system:relaunch', () => {
        app.relaunch()
        app.exit(0)
    })

    console.log('[IPC] All handlers registered')
}
