import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { LibraryData, WorkInfo, ScanResult, AppSettings } from './types'
import { scrapeWorkInfo } from './scraper'

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
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
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
 * フォルダ名からRJコードを抽出
 */
export function extractRJCode(folderName: string): string | null {
    const match = folderName.match(RJ_CODE_REGEX)
    return match ? match[0].toUpperCase() : null
}

/**
 * 指定フォルダ内のサブフォルダをスキャン
 */
export function scanFolderForWorks(folderPath: string): Array<{ rjCode: string; folderPath: string }> {
    const results: Array<{ rjCode: string; folderPath: string }> = []

    try {
        if (!fs.existsSync(folderPath)) {
            console.error(`[Library] Folder does not exist: ${folderPath}`)
            return results
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const rjCode = extractRJCode(entry.name)
                if (rjCode) {
                    results.push({
                        rjCode,
                        folderPath: path.join(folderPath, entry.name),
                    })
                }
            }
        }

        console.log(`[Library] Found ${results.length} works with RJ codes in ${folderPath}`)
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
    onProgress?: (current: number, total: number, rjCode: string, status: string) => void
): Promise<ScanResult> {
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
        result.errors.push('RJコードを含むフォルダが見つかりませんでした')
        saveLibraryData(libraryData)
        return result
    }

    // 既存のデータにない作品をフィルタリング
    const newWorks = foundWorks.filter(w => !libraryData.works[w.rjCode])
    const existingWorks = foundWorks.filter(w => libraryData.works[w.rjCode])

    // 既存作品のパスを更新
    for (const work of existingWorks) {
        libraryData.works[work.rjCode].localPath = work.folderPath
    }

    console.log(`[Library] New works to scrape: ${newWorks.length}, Existing: ${existingWorks.length}`)

    // 設定を読み込んでディレイを取得
    const settings = loadSettings()

    // 新しい作品をスクレイピング
    for (let i = 0; i < newWorks.length; i++) {
        const { rjCode, folderPath } = newWorks[i]

        if (onProgress) {
            onProgress(i + 1, newWorks.length, rjCode, 'スクレイピング中...')
        }

        try {
            const workInfo = await scrapeWorkInfo(rjCode, folderPath)

            if (workInfo) {
                libraryData.works[rjCode] = workInfo
                result.success++
                result.newWorks.push(rjCode)
            } else {
                result.failed++
                result.errors.push(`${rjCode}: 情報を取得できませんでした`)
            }
        } catch (error) {
            result.failed++
            result.errors.push(`${rjCode}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

        // レート制限対策のディレイ
        if (i < newWorks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, settings.requestDelay))
        }
    }

    // ライブラリデータを保存
    saveLibraryData(libraryData)

    return result
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
