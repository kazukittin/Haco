import { ipcMain, dialog, BrowserWindow } from 'electron'
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
} from './library'
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

    // ライブラリをスキャン
    ipcMain.handle('library:scan', async (event, scanPath: string) => {
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
        })

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

    // ========================================
    // 設定関連
    // ========================================

    // 設定を取得
    ipcMain.handle('settings:get', () => {
        return loadSettings()
    })

    // 設定を保存
    ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
        return saveSettings(settings)
    })

    // ========================================
    // ビューア関連
    // ========================================

    // ビューアデータを取得
    ipcMain.handle('viewer:getData', (_event, workPath: string) => {
        const { getViewerData } = require('./viewer')
        return getViewerData(workPath)
    })

    // 画像データを取得
    ipcMain.handle('viewer:getImage', (_event, sourceType: 'folder' | 'zip', source: string, archivePath?: string) => {
        const { getImageData } = require('./viewer')
        return getImageData(sourceType, source, archivePath)
    })

    // ========================================
    // アプリ情報
    // ========================================

    // アプリのデータフォルダパスを取得
    ipcMain.handle('app:getUserDataPath', () => {
        const { app } = require('electron')
        return app.getPath('userData')
    })

    console.log('[IPC] All handlers registered')
}
