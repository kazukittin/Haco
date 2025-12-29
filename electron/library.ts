import * as fs from 'fs'
import * as path from 'path'
import { app, webContents } from 'electron'
import * as chokidar from 'chokidar'
import type { LibraryData, WorkInfo, ScanResult, AppSettings } from './types'
import { scrapeWorkInfo, scrapeByTitleWithFallback } from './scraper'
import { getViewerData, getImageData } from './viewer'

/**
 * サムネイルが取得できていない場合、最初の一枚をサムネイルにする
 */
function ensureThumbnail(work: WorkInfo): WorkInfo {
    if (work.thumbnailUrl && (work.thumbnailUrl.startsWith('http') || work.thumbnailUrl.startsWith('data:'))) {
        return work
    }

    try {
        const viewerData = getViewerData(work.localPath)
        if (viewerData && viewerData.images.length > 0) {
            const firstImage = viewerData.images[0]
            const base64 = getImageData(firstImage.sourceType, firstImage.source, viewerData.archivePath)
            if (base64) {
                work.thumbnailUrl = base64
                // ついでにサンプル画像としても追加しておく
                if (!work.sampleImages || work.sampleImages.length === 0) {
                    work.sampleImages = [base64]
                }
            }
        }
    } catch (error) {
        console.error(`[Library] Error ensuring thumbnail for ${work.rjCode}:`, error)
    }

    return work
}

// 監視インスタンスの保持
let watcher: chokidar.FSWatcher | null = null
let scanTimer: NodeJS.Timeout | null = null
let isScanningGlobal = false

/**
 * 現在スキャン中かどうかを取得
 */
export function isScanning(): boolean {
    return isScanningGlobal
}

// RJコードの正規表現（RJ + 6〜8桁の数字）
const RJ_CODE_REGEX = /RJ\d{6,8}/i

// ライブラリデータのデフォルト値
const DEFAULT_LIBRARY_DATA: LibraryData = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    scanPaths: [],
    works: {},
}

// 設定のデフォルト値
const DEFAULT_SETTINGS: AppSettings = {
    libraryPaths: [],
    autoScan: false,
    requestDelay: 1500, // 1.5秒
    viewerTheme: 'black',
    defaultBindingDirection: 'rtl',
}

/**
 * ユーザーデータフォルダのパスを取得
 */
function getUserDataPath(): string {
    return app.getPath('userData')
}

/**
 * ライブラリデータファイルのパスを取得
 */
function getLibraryFilePath(): string {
    return path.join(getUserDataPath(), 'library.json')
}

/**
 * 設定ファイルのパスを取得
 */
function getSettingsFilePath(): string {
    return path.join(getUserDataPath(), 'settings.json')
}

/**
 * ライブラリデータを読み込む
 */
export function loadLibraryData(): LibraryData {
    const filePath = getLibraryFilePath()

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8')
            const parsed = JSON.parse(data) as LibraryData
            console.log(`[Library] Loaded ${Object.keys(parsed.works).length} works from library`)
            return parsed
        }
    } catch (error) {
        console.error('[Library] Error loading library data:', error)
    }

    return { ...DEFAULT_LIBRARY_DATA }
}

/**
 * ライブラリデータを保存する
 */
export function saveLibraryData(data: LibraryData): boolean {
    const filePath = getLibraryFilePath()

    try {
        // データフォルダが存在しない場合は作成
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        data.lastUpdated = new Date().toISOString()
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
        console.log(`[Library] Saved ${Object.keys(data.works).length} works to library`)
        return true
    } catch (error) {
        console.error('[Library] Error saving library data:', error)
        return false
    }
}

/**
 * 設定を読み込む
 */
export function loadSettings(): AppSettings {
    const filePath = getSettingsFilePath()

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8')
            const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
            // 新しい設定フィールドのデフォルト値適用
            if (!settings.viewerTheme) settings.viewerTheme = DEFAULT_SETTINGS.viewerTheme
            if (!settings.defaultBindingDirection) settings.defaultBindingDirection = DEFAULT_SETTINGS.defaultBindingDirection

            return settings
        }
    } catch (error) {
        console.error('[Library] Error loading settings:', error)
    }

    return { ...DEFAULT_SETTINGS }
}

/**
 * 設定を保存する
 */
export function saveSettings(settings: AppSettings): boolean {
    const filePath = getSettingsFilePath()

    try {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
        console.log('[Library] Settings saved')
        return true
    } catch (error) {
        console.error('[Library] Error saving settings:', error)
        return false
    }
}

/**
 * アプリケーションデータを初期化（保存ファイルを削除）
 */
export async function resetAppData(): Promise<boolean> {
    try {
        // 監視を停止
        if (watcher) {
            await watcher.close()
            watcher = null
        }

        const libraryPath = getLibraryFilePath()
        const settingsPath = getSettingsFilePath()

        if (fs.existsSync(libraryPath)) fs.unlinkSync(libraryPath)
        if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath)

        console.log('[Library] App data reset successfully')
        return true
    } catch (error) {
        console.error('[Library] Error resetting app data:', error)
        return false
    }
}

/**
 * フォルダ名からRJコードを抽出
 */
export function extractRJCode(folderName: string): string | null {
    const match = folderName.match(RJ_CODE_REGEX)
    return match ? match[0].toUpperCase() : null
}

/**
 * ファイル名から一意のIDを生成（RJコードがない場合用）
 */
function generateWorkId(name: string): string {
    // 拡張子を除去
    const baseName = name.replace(/\.(zip|cbz|rar)$/i, '')

    // 簡易ハッシュを生成（ファイル名の文字コードを合計してBase36に変換）
    let hash = 0
    for (let i = 0; i < baseName.length; i++) {
        hash = ((hash << 5) - hash) + baseName.charCodeAt(i)
        hash = hash & hash // 32bit整数に変換
    }
    const hashStr = Math.abs(hash).toString(36).toUpperCase()

    // 英数字部分を抽出（あれば）
    const alphanumeric = baseName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)

    if (alphanumeric.length > 0) {
        return `LOCAL_${alphanumeric}_${hashStr}`
    } else {
        return `LOCAL_${hashStr}`
    }
}

// サポートするアーカイブ拡張子
const ARCHIVE_EXTENSIONS = ['.zip', '.cbz', '.rar']

/**
 * アーカイブファイルかどうかを判定
 */
function isArchiveFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    return ARCHIVE_EXTENSIONS.includes(ext)
}

/**
 * 指定フォルダ内のサブフォルダとZIPファイルをスキャン
 */
export function scanFolderForWorks(folderPath: string): Array<{ rjCode: string; folderPath: string; isArchive?: boolean }> {
    console.log(`[Library] Scanning folder: ${folderPath}`)
    const results: Array<{ rjCode: string; folderPath: string; isArchive?: boolean }> = []

    try {
        if (!fs.existsSync(folderPath)) {
            console.error(`[Library] Folder does not exist: ${folderPath}`)
            return results
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        console.log(`[Library] Found ${entries.length} entries in folder`)

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name)

            if (entry.isDirectory()) {
                // フォルダの場合
                const rjCode = extractRJCode(entry.name)
                if (rjCode) {
                    // RJコードがある場合
                    results.push({
                        rjCode,
                        folderPath: fullPath,
                    })
                } else {
                    // RJコードがない場合も登録（ファイル名ベースのID）
                    results.push({
                        rjCode: generateWorkId(entry.name),
                        folderPath: fullPath,
                    })
                }
            } else if (entry.isFile() && isArchiveFile(entry.name)) {
                // ZIPファイルの場合
                console.log(`[Library] Found archive: ${entry.name}`)
                const rjCode = extractRJCode(entry.name)
                if (rjCode) {
                    results.push({
                        rjCode,
                        folderPath: fullPath,
                        isArchive: true,
                    })
                } else {
                    // RJコードがない場合も登録
                    const workId = generateWorkId(entry.name)
                    console.log(`[Library] Registering with ID: ${workId}`)
                    results.push({
                        rjCode: workId,
                        folderPath: fullPath,
                        isArchive: true,
                    })
                }
            } else {
                console.log(`[Library] Skipping: ${entry.name} (isFile: ${entry.isFile()}, isArchive: ${isArchiveFile(entry.name)})`)
            }
        }

        console.log(`[Library] Found ${results.length} works (folders + archives) in ${folderPath}`)
    } catch (error) {
        console.error(`[Library] Error scanning folder ${folderPath}:`, error)
    }

    return results
}

/**
 * ライブラリをスキャンして更新する
 */
export async function scanAndUpdateLibrary(
    scanPath: string,
    onProgress?: (current: number, total: number, rjCode: string, status: string) => void,
    onlyDLsite: boolean = false
): Promise<ScanResult> {
    if (isScanningGlobal) {
        console.warn('[Library] Scan already in progress, skipping...')
        return { success: 0, failed: 0, totalFolders: 0, newWorks: [], errors: ['Already scanning'] }
    }

    try {
        isScanningGlobal = true
        // 状態変更を通知
        webContents.getAllWebContents().forEach(wc => {
            wc.send('library:scanStateChanged', true)
        })

        const result: ScanResult = {
            success: 0,
            failed: 0,
            totalFolders: 0,
            newWorks: [],
            errors: [],
        }

        // 現在のライブラリデータを読み込む
        const libraryData = loadLibraryData()

        // スキャンパスを追加
        if (!libraryData.scanPaths.includes(scanPath)) {
            libraryData.scanPaths.push(scanPath)
        }

        // フォルダをスキャン
        const foundWorks = scanFolderForWorks(scanPath)
        result.totalFolders = foundWorks.length

        if (foundWorks.length === 0) {
            result.errors.push('作品（フォルダまたはZIPファイル）が見つかりませんでした')
            saveLibraryData(libraryData)
            return result
        }

        // 既存のデータに実パスが既に登録されていないか事前チェック
        // リネームによってIDが変更されたLOCAL_作品などを検出し、IDを同期させる
        for (const found of foundWorks) {
            const existingByPath = Object.entries(libraryData.works).find(([id, work]) => work.localPath === found.folderPath)
            if (existingByPath) {
                const [oldId, oldWork] = existingByPath
                if (oldId !== found.rjCode) {
                    console.log(`[Library] Migrating renamed work to new ID: ${oldId} -> ${found.rjCode}`)

                    // 情報が不完全な場合は、移行せず削除して新規取得対象にする
                    const isPlaceholder =
                        oldWork.circle === '未取得' ||
                        oldWork.circle === 'エラー' ||
                        oldWork.circle === '未登録' ||
                        oldWork.circle === '未設定' ||
                        oldWork.tags.includes('未取得') ||
                        oldWork.tags.includes('エラー')

                    if (isPlaceholder) {
                        console.log(`[Library] Placeholder work detected during migration. Removing to trigger re-scrape.`)
                    } else {
                        // 正常なデータがある場合は引き継ぐ
                        libraryData.works[found.rjCode] = { ...oldWork, rjCode: found.rjCode }
                    }
                    delete libraryData.works[oldId]
                }
            }
        }

        // 既存のデータにない作品、または情報取得に失敗している作品をフィルタリング
        const newWorks = foundWorks.filter(w => {
            const existing = libraryData.works[w.rjCode]
            if (!existing) return true

            // 情報が不完全な場合は再取得の対象にする
            const isPlaceholder =
                existing.circle === '未取得' ||
                existing.circle === 'エラー' ||
                existing.circle === '未登録' ||
                existing.circle === '未設定' ||
                existing.tags.includes('未取得') ||
                existing.tags.includes('エラー') ||
                (existing.rjCode.startsWith('RJ') && existing.circle === 'ローカル作品') // RJコードがあるのにローカル扱い

            return isPlaceholder
        })

        // 既存の正常な作品
        const existingWorks = foundWorks.filter(w => {
            const existing = libraryData.works[w.rjCode]
            return existing && !newWorks.some(nw => nw.rjCode === w.rjCode)
        })

        // 再スキャン対象の作品を一旦ライブラリから除外して、確実に上書きされるようにする
        newWorks.forEach(w => {
            if (libraryData.works[w.rjCode]) {
                delete libraryData.works[w.rjCode]
            }
        })

        // 既存作品のパスを更新
        if (existingWorks.length > 0) {
            for (const work of existingWorks) {
                if (libraryData.works[work.rjCode]) {
                    libraryData.works[work.rjCode].localPath = work.folderPath
                    // サムネイルがなければローカルから取得試行
                    libraryData.works[work.rjCode] = ensureThumbnail(libraryData.works[work.rjCode])
                }
            }
            // パス更新を即座に反映
            saveLibraryData(libraryData)
            webContents.getAllWebContents().forEach(wc => {
                wc.send('library:updated')
            })
        }

        console.log(`[Library] New works to scrape: ${newWorks.length}, Existing: ${existingWorks.length}`)

        // 設定を読み込んでディレイを取得
        const settings = loadSettings()

        // 新しい作品を処理
        for (let i = 0; i < newWorks.length; i++) {
            const { rjCode, folderPath, isArchive } = newWorks[i]

            // ファイル名からタイトルを生成（拡張子を除去）
            const baseName = path.basename(folderPath)
            const titleFromFile = baseName.replace(/\.(zip|cbz|rar)$/i, '')

            if (onProgress) {
                onProgress(i + 1, newWorks.length, rjCode, '処理中...')
            }

            // LOCAL_ プレフィックスの場合（RJコードなし）
            // タイトルでスクレイピングを試行
            if (rjCode.startsWith('LOCAL_')) {
                console.log(`[Library] Processing local work: ${titleFromFile}`)

                if (onProgress) {
                    onProgress(i + 1, newWorks.length, titleFromFile, 'タイトルで検索中...')
                }

                try {
                    // DLsite → Google Books の順で検索（onlyDLsiteがtrueならDLsiteのみ）
                    console.log(`[Library] Searching for local work: "${titleFromFile}" (OnlyDLsite: ${onlyDLsite})`)
                    const workInfo = await scrapeByTitleWithFallback(titleFromFile, folderPath, rjCode, onlyDLsite)

                    if (workInfo) {
                        let finalRjCode = workInfo.rjCode

                        // LOCAL_ 作品のリネーム処理
                        if (rjCode.startsWith('LOCAL_')) {
                            try {
                                const dir = path.dirname(folderPath)
                                const ext = fs.statSync(folderPath).isDirectory() ? '' : path.extname(folderPath)
                                const safeTitle = workInfo.title.replace(/[\\/:*?"<>|]/g, '_')

                                let newFileName = ''
                                if (!finalRjCode.startsWith('LOCAL_')) {
                                    // RJコードが見つかった場合: [RJxxxxxx] タイトル
                                    newFileName = `[${finalRjCode}] ${safeTitle}${ext}`
                                    console.log(`[Library] Discovered RJ code: ${rjCode} -> ${finalRjCode}`)
                                } else if (workInfo.title !== titleFromFile) {
                                    // RJコードはないが、新しいタイトルが見つかった場合: タイトル
                                    newFileName = `${safeTitle}${ext}`
                                    console.log(`[Library] New title found for local work: "${titleFromFile}" -> "${workInfo.title}"`)
                                }

                                if (newFileName) {
                                    const newPath = path.join(dir, newFileName)
                                    if (folderPath !== newPath && !fs.existsSync(newPath)) {
                                        fs.renameSync(folderPath, newPath)
                                        console.log(`[Library] Renamed local folder: ${folderPath} -> ${newPath}`)
                                        workInfo.localPath = newPath
                                    }
                                }
                            } catch (err) {
                                console.error('[Library] Failed to rename folder after discovery:', err)
                            }
                        }

                        libraryData.works[finalRjCode] = ensureThumbnail(workInfo)
                        result.success++
                        result.newWorks.push(finalRjCode)

                        // IDが変わった場合は元のエントリを削除
                        if (finalRjCode !== rjCode && libraryData.works[rjCode]) {
                            delete libraryData.works[rjCode]
                        }

                        console.log(`[Library] Found info for: ${titleFromFile} (${finalRjCode})`)
                    } else {
                        // 見つからなかった場合はフォールバック
                        libraryData.works[rjCode] = ensureThumbnail({
                            rjCode,
                            title: titleFromFile,
                            circle: 'ローカル作品',
                            authors: [],
                            tags: ['ローカル'],
                            description: 'オンラインで情報が見つかりませんでした。',
                            thumbnailUrl: '',
                            localPath: folderPath,
                            fetchedAt: new Date().toISOString(),
                        })
                        result.success++
                        result.newWorks.push(rjCode)
                        result.errors.push(`${titleFromFile}: オンラインで情報が見つかりませんでした`)
                    }
                } catch (error) {
                    console.error(`[Library] Error searching for ${titleFromFile}:`, error)
                    libraryData.works[rjCode] = ensureThumbnail({
                        rjCode,
                        title: titleFromFile,
                        circle: 'ローカル作品',
                        authors: [],
                        tags: ['ローカル'],
                        description: '検索中にエラーが発生しました。',
                        thumbnailUrl: '',
                        localPath: folderPath,
                        fetchedAt: new Date().toISOString(),
                    })
                    result.success++
                    result.newWorks.push(rjCode)
                }

                // 1件ごとに保存と通知（リアルタイム更新）
                saveLibraryData(libraryData)
                webContents.getAllWebContents().forEach(wc => {
                    wc.send('library:updated')
                })

                // レート制限対策のディレイ
                if (i < newWorks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, settings.requestDelay))
                }
                continue
            }

            // RJコードがある場合はスクレイピングを試行
            try {
                if (onProgress) {
                    onProgress(i + 1, newWorks.length, rjCode, 'スクレイピング中...')
                }

                const workInfo = await scrapeWorkInfo(rjCode, folderPath)

                if (workInfo) {
                    libraryData.works[rjCode] = ensureThumbnail(workInfo)
                    result.success++
                    result.newWorks.push(rjCode)
                } else {
                    // スクレイピング失敗時のフォールバック
                    libraryData.works[rjCode] = ensureThumbnail({
                        rjCode,
                        title: titleFromFile,
                        circle: '未取得',
                        authors: [],
                        tags: ['未取得'],
                        description: '情報の取得に失敗しました。',
                        thumbnailUrl: '',
                        localPath: folderPath,
                        fetchedAt: new Date().toISOString(),
                    })
                    result.success++
                    result.newWorks.push(rjCode)
                    result.errors.push(`${rjCode}: 情報を取得できませんでした（仮登録）`)
                }
            } catch (error) {
                // エラー発生時のフォールバック
                console.error(`[Library] Scrape error for ${rjCode}:`, error)

                libraryData.works[rjCode] = ensureThumbnail({
                    rjCode,
                    title: titleFromFile,
                    circle: 'エラー',
                    authors: [],
                    tags: ['エラー'],
                    description: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                    thumbnailUrl: '',
                    localPath: folderPath,
                    fetchedAt: new Date().toISOString(),
                })
                result.success++
                result.newWorks.push(rjCode)
                result.errors.push(`${rjCode}: エラーにより仮登録しました`)
            }

            // 1件ごとに保存と通知（リアルタイム更新）
            saveLibraryData(libraryData)
            webContents.getAllWebContents().forEach(wc => {
                wc.send('library:updated')
            })

            // レート制限対策のディレイ（RJコードがある場合のみ）
            if (i < newWorks.length - 1 && !rjCode.startsWith('LOCAL_')) {
                await new Promise(resolve => setTimeout(resolve, settings.requestDelay))
            }
        }

        // ライブラリデータを保存
        saveLibraryData(libraryData)

        // 存在しない作品をクリーンアップ
        const cleanupResult = cleanupMissingWorks()
        if (cleanupResult.removed.length > 0) {
            console.log(`[Library] Cleaned up ${cleanupResult.removed.length} missing works during scan`)
            webContents.getAllWebContents().forEach(wc => {
                wc.send('library:updated')
            })
        }

        return result
    } catch (error) {
        console.error('[Library] Scan error:', error)
        throw error
    } finally {
        isScanningGlobal = false
        // 状態変更を通知
        webContents.getAllWebContents().forEach(wc => {
            wc.send('library:scanStateChanged', false)
        })
    }
}

/**
 * 作品を検索
 */
export function searchWorks(query: string, libraryData?: LibraryData): WorkInfo[] {
    const data = libraryData || loadLibraryData()
    const works = Object.values(data.works)

    if (!query.trim()) {
        return works
    }

    const lowerQuery = query.toLowerCase()

    return works.filter(work => {
        return (
            work.title.toLowerCase().includes(lowerQuery) ||
            work.circle.toLowerCase().includes(lowerQuery) ||
            work.rjCode.toLowerCase().includes(lowerQuery) ||
            work.authors.some(a => a.toLowerCase().includes(lowerQuery)) ||
            work.tags.some(t => t.toLowerCase().includes(lowerQuery))
        )
    })
}

/**
 * タグで作品をフィルタリング
 */
export function filterByTag(tag: string, libraryData?: LibraryData): WorkInfo[] {
    const data = libraryData || loadLibraryData()
    const works = Object.values(data.works)

    return works.filter(work => work.tags.includes(tag))
}

/**
 * すべてのタグを取得（使用頻度順）
 */
export function getAllTags(libraryData?: LibraryData): Array<{ tag: string; count: number }> {
    const data = libraryData || loadLibraryData()
    const tagCounts = new Map<string, number>()

    for (const work of Object.values(data.works)) {
        for (const tag of work.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        }
    }

    return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
}

/**
 * すべてのサークルを取得
 */
export function getAllCircles(libraryData?: LibraryData): Array<{ circle: string; count: number }> {
    const data = libraryData || loadLibraryData()
    const circleCounts = new Map<string, number>()

    for (const work of Object.values(data.works)) {
        if (work.circle) {
            circleCounts.set(work.circle, (circleCounts.get(work.circle) || 0) + 1)
        }
    }

    return Array.from(circleCounts.entries())
        .map(([circle, count]) => ({ circle, count }))
        .sort((a, b) => b.count - a.count)
}

/**
 * 作品を非表示/表示に切り替え
 */
export function toggleWorkVisibility(rjCode: string): boolean {
    const libraryData = loadLibraryData()
    const work = libraryData.works[rjCode]

    if (!work) {
        console.error(`[Library] Work not found: ${rjCode}`)
        return false
    }

    work.isHidden = !work.isHidden
    saveLibraryData(libraryData)
    console.log(`[Library] Work ${rjCode} visibility set to: ${!work.isHidden}`)
    return true
}

/**
 * 作品をライブラリから削除（ファイルは残す）
 */
export function removeWorkFromLibrary(rjCode: string): boolean {
    const libraryData = loadLibraryData()

    if (!libraryData.works[rjCode]) {
        console.error(`[Library] Work not found: ${rjCode}`)
        return false
    }

    delete libraryData.works[rjCode]
    saveLibraryData(libraryData)
    console.log(`[Library] Removed work from library: ${rjCode}`)
    return true
}

/**
 * 作品をライブラリから削除し、実ファイルも削除
 */
export function deleteWorkWithFiles(rjCode: string): { success: boolean; error?: string } {
    const libraryData = loadLibraryData()
    const work = libraryData.works[rjCode]

    if (!work) {
        return { success: false, error: '作品が見つかりません' }
    }

    const filePath = work.localPath

    try {
        // ファイル/フォルダの存在確認
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)

            if (stat.isDirectory()) {
                // フォルダの場合は再帰的に削除
                fs.rmSync(filePath, { recursive: true, force: true })
            } else {
                // ファイルの場合は単純削除
                fs.unlinkSync(filePath)
            }
            console.log(`[Library] Deleted file/folder: ${filePath}`)
        } else {
            console.log(`[Library] File not found (already deleted?): ${filePath}`)
        }

        // ライブラリからも削除
        delete libraryData.works[rjCode]
        saveLibraryData(libraryData)

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[Library] Error deleting files: ${errorMessage}`)
        return { success: false, error: errorMessage }
    }
}

/**
 * 存在しないファイルの作品を検出して削除
 */
export function cleanupMissingWorks(): { removed: string[]; errors: string[] } {
    const libraryData = loadLibraryData()
    const removed: string[] = []
    const errors: string[] = []

    for (const [rjCode, work] of Object.entries(libraryData.works)) {
        if (!fs.existsSync(work.localPath)) {
            console.log(`[Library] Missing file detected: ${work.localPath}`)
            removed.push(rjCode)
            delete libraryData.works[rjCode]
        }
    }

    if (removed.length > 0) {
        saveLibraryData(libraryData)
        console.log(`[Library] Cleaned up ${removed.length} missing works`)
    }

    return { removed, errors }
}

/**
 * 読書進捗を更新
 */
export function updateReadingProgress(
    rjCode: string,
    currentPage: number,
    totalPages: number
): boolean {
    const libraryData = loadLibraryData()
    const work = libraryData.works[rjCode]

    if (!work) {
        console.error(`[Library] Work not found: ${rjCode}`)
        return false
    }

    work.lastReadAt = new Date().toISOString()
    work.lastReadPage = currentPage
    work.totalPages = totalPages

    saveLibraryData(libraryData)
    console.log(`[Library] Updated reading progress: ${rjCode} - Page ${currentPage + 1}/${totalPages}`)
    return true
}

/**
 * 作品情報を更新する
 */
export async function updateWorkInfo(rjCode: string, updates: Partial<WorkInfo>): Promise<boolean> {
    const data = loadLibraryData()
    const work = data.works[rjCode]
    if (!work) {
        return false
    }

    // タイトルが変更された場合、実ファイル名も変更を試みる
    if (updates.title && updates.title !== work.title) {
        const oldPath = work.localPath
        if (fs.existsSync(oldPath)) {
            try {
                const dir = path.dirname(oldPath)
                const ext = fs.statSync(oldPath).isDirectory() ? '' : path.extname(oldPath)

                // ファイル名に使用できない文字を除去
                const safeTitle = updates.title.replace(/[\\/:*?"<>|]/g, '_')

                // RJコードが含まれている場合は、それを含めた形式にする（スキャン時に見失わないため）
                let newFileName = ''
                if (!work.rjCode.startsWith('LOCAL_')) {
                    newFileName = `[${work.rjCode}] ${safeTitle}${ext}`
                } else {
                    newFileName = `${safeTitle}${ext}`
                }

                const newPath = path.join(dir, newFileName)

                // 名前が変わる場合のみ実行
                if (oldPath !== newPath) {
                    // 同名ファイルが既にある場合は上書きを避ける
                    if (!fs.existsSync(newPath)) {
                        fs.renameSync(oldPath, newPath)
                        console.log(`[Library] Renamed on disk: ${oldPath} -> ${newPath}`)
                        work.localPath = newPath
                    } else {
                        console.warn(`[Library] Rename failed: file already exists at ${newPath}`)
                    }
                }
            } catch (error) {
                console.error('[Library] Error renaming file on disk:', error)
                // ディスク上の名前変更に失敗しても、ライブラリデータ自体の更新は続行する
            }
        }
    }

    let currentRjCode = rjCode
    const oldRjCode = rjCode

    // Explicit rjCode update
    if (updates.rjCode && updates.rjCode !== rjCode) {
        console.log(`[Library] Updating work ID (explicit): ${rjCode} -> ${updates.rjCode}`)
        const newRjCode = updates.rjCode.trim().toUpperCase()
        currentRjCode = newRjCode
        updates.rjCode = newRjCode

        // RJコードが新しく設定された場合、即座にオンライン情報を取得
        if (newRjCode.startsWith('RJ')) {
            try {
                const scrapedInfo = await scrapeWorkInfo(newRjCode, work.localPath)
                if (scrapedInfo) {
                    console.log(`[Library] Successfully fetched info for ${newRjCode} during manual ID update (Overwriting)`)
                    // 取得した情報を最優先する（手動の他項目編集を上書き）
                    updates = {
                        ...updates,
                        ...ensureThumbnail(scrapedInfo)
                    }
                }
            } catch (err) {
                console.error(`[Library] Failed to fetch info for edited ID ${newRjCode}:`, err)
            }
        }
        // Update local path if it contains the old RJ code
        const oldPath = work.localPath
        if (fs.existsSync(oldPath)) {
            try {
                const dir = path.dirname(oldPath)
                const ext = fs.statSync(oldPath).isDirectory() ? '' : path.extname(oldPath)
                const safeTitle = (updates.title || work.title).replace(/[\\/:*?"<>|]/g, '_')

                let newFileName = ''
                if (!currentRjCode.startsWith('LOCAL_')) {
                    newFileName = `[${currentRjCode}] ${safeTitle}${ext}`
                } else {
                    newFileName = `${safeTitle}${ext}`
                }

                const newPath = path.join(dir, newFileName)
                if (oldPath !== newPath && !fs.existsSync(newPath)) {
                    fs.renameSync(oldPath, newPath)
                    work.localPath = newPath
                }
            } catch (err) {
                console.error('[Library] Error renaming for new RJ code:', err)
            }
        }
        delete data.works[oldRjCode]
    }
    // LOCAL_ 作品の場合、タイトルが変わると ID も変わる可能性があるため同期させる (rjCode明示更新がない場合のみ)
    else if (rjCode.startsWith('LOCAL_') && updates.title) {
        // タイトル変更後の新しいIDを生成
        const baseNameForId = updates.title.replace(/[\\/:*?"<>|]/g, '_')
        const newRjCode = generateWorkId(baseNameForId)

        if (newRjCode !== rjCode) {
            console.log(`[Library] Updating LOCAL work ID due to title change: ${rjCode} -> ${newRjCode}`)
            currentRjCode = newRjCode
            // 古いエントリーを削除
            delete data.works[oldRjCode]
        }
    }

    data.works[currentRjCode] = {
        ...work,
        ...updates,
        rjCode: currentRjCode
    }

    return saveLibraryData(data)
}

/**
 * 最近読んだ作品を取得（最大N件）
 */
export function getRecentlyReadWorks(limit: number = 10): import('./types').WorkInfo[] {
    const libraryData = loadLibraryData()
    const works = Object.values(libraryData.works)
        .filter(work => work.lastReadAt && !work.isHidden)
        .sort((a, b) => {
            const dateA = new Date(a.lastReadAt || 0).getTime()
            const dateB = new Date(b.lastReadAt || 0).getTime()
            return dateB - dateA
        })
        .slice(0, limit)

    return works
}

/**
 * フォルダ監視のセットアップ/更新
 */
export function setupFolderWatcher(): void {
    const settings = loadSettings()
    const paths = settings.libraryPaths

    // 既存の監視をクローズ
    if (watcher) {
        watcher.close()
        watcher = null
    }

    // 自動スキャンが無効、またはパスがない場合は何もしない
    if (!settings.autoScan || paths.length === 0) {
        console.log('[Watcher] Real-time monitoring is disabled or no paths.')
        return
    }

    console.log(`[Watcher] Starting watcher for ${paths.length} paths...`)

    // 新しい監視を開始
    const watchPaths = paths.map(p => typeof p === 'string' ? p : p.path)
    console.log(`[Watcher] Watching paths:`, watchPaths)

    watcher = chokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        depth: 3, // 少し深めまで監視（サークル別フォルダなどに対応）
        awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100
        }
    })

    const triggerAutoScan = () => {
        if (scanTimer) clearTimeout(scanTimer)

        scanTimer = setTimeout(async () => {
            console.log('[Watcher] Change detected. Triggering auto-scan...')
            try {
                const currentSettings = loadSettings()

                // 各パスをスキャン
                for (const p of currentSettings.libraryPaths) {
                    const scanPath = typeof p === 'string' ? p : p.path
                    const onlyDLsite = typeof p === 'string' ? false : p.onlyDLsite
                    await scanAndUpdateLibrary(scanPath, undefined, onlyDLsite)
                }

                // 存在しないファイルをクリーンアップは scanAndUpdateLibrary 内で行われるようになったが
                // 念のためここでも最終チェック
                const cleanupResult = cleanupMissingWorks()

                // フロントエンドに通知
                const windows = webContents.getAllWebContents()
                windows.forEach(wc => {
                    wc.send('library:updated', { source: 'watcher' })
                })
                console.log(`[Watcher] Auto-scan completed. Cleaned up: ${cleanupResult.removed.length}`)
            } catch (err) {
                console.error('[Watcher] Auto-scan failed:', err)
            }
        }, 5000) // 5秒待機して安定してから実行
    }

    watcher
        .on('add', (path) => {
            console.log(`[Watcher] File added: ${path}`)
            triggerAutoScan()
        })
        .on('addDir', (path) => {
            console.log(`[Watcher] Directory added: ${path}`)
            triggerAutoScan()
        })
        .on('unlink', (path) => {
            console.log(`[Watcher] File removed: ${path}`)
            triggerAutoScan()
        })
        .on('unlinkDir', (path) => {
            console.log(`[Watcher] Directory removed: ${path}`)
            triggerAutoScan()
        })
}
