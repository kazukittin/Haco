import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'
import type { ViewerData, ImageInfo } from './types'

// サポートする画像拡張子
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']

// サポートするアーカイブ拡張子
const ARCHIVE_EXTENSIONS = ['.zip', '.cbz']

/**
 * 画像ファイルかどうかを判定
 */
function isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * アーカイブファイルかどうかを判定
 */
function isArchiveFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    return ARCHIVE_EXTENSIONS.includes(ext)
}

/**
 * 自然順ソート
 */
function naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * フォルダ内の画像ファイルを取得
 */
function getImagesFromFolder(folderPath: string): ImageInfo[] {
    const images: ImageInfo[] = []

    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        // 画像ファイルをフィルタリング
        const imageFiles = entries
            .filter(entry => entry.isFile() && isImageFile(entry.name))
            .map(entry => entry.name)
            .sort(naturalSort)

        imageFiles.forEach((filename, index) => {
            images.push({
                index,
                filename,
                source: path.join(folderPath, filename),
                sourceType: 'folder',
            })
        })
    } catch (error) {
        console.error(`[Viewer] Error reading folder ${folderPath}:`, error)
    }

    return images
}

/**
 * フォルダ内のアーカイブファイルを検索
 */
function findArchiveInFolder(folderPath: string): string | null {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        for (const entry of entries) {
            if (entry.isFile() && isArchiveFile(entry.name)) {
                return path.join(folderPath, entry.name)
            }
        }

        // サブフォルダも検索（1階層のみ）
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = path.join(folderPath, entry.name)
                const subEntries = fs.readdirSync(subPath, { withFileTypes: true })

                for (const subEntry of subEntries) {
                    if (subEntry.isFile() && isArchiveFile(subEntry.name)) {
                        return path.join(subPath, subEntry.name)
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[Viewer] Error searching for archives in ${folderPath}:`, error)
    }

    return null
}

/**
 * ZIPファイルから画像エントリを取得
 */
function getImagesFromZip(zipPath: string): ImageInfo[] {
    const images: ImageInfo[] = []

    try {
        const zip = new AdmZip(zipPath)
        const entries = zip.getEntries()

        // 画像エントリをフィルタリングしてソート
        const imageEntries = entries
            .filter(entry => !entry.isDirectory && isImageFile(entry.entryName))
            .sort((a, b) => naturalSort(a.entryName, b.entryName))

        imageEntries.forEach((entry, index) => {
            images.push({
                index,
                filename: path.basename(entry.entryName),
                source: entry.entryName,
                sourceType: 'zip',
            })
        })
    } catch (error) {
        console.error(`[Viewer] Error reading ZIP ${zipPath}:`, error)
    }

    return images
}

/**
 * 作品フォルダからビューアデータを取得
 */
export function getViewerData(workPath: string): ViewerData | null {
    try {
        if (!fs.existsSync(workPath)) {
            console.error(`[Viewer] Path does not exist: ${workPath}`)
            return null
        }

        const stat = fs.statSync(workPath)

        if (stat.isDirectory()) {
            // フォルダの場合：まず画像を探す
            let images = getImagesFromFolder(workPath)

            // 画像が見つからない場合、アーカイブを探す
            if (images.length === 0) {
                const archivePath = findArchiveInFolder(workPath)
                if (archivePath) {
                    images = getImagesFromZip(archivePath)
                    return {
                        workPath,
                        totalImages: images.length,
                        images,
                        sourceType: 'zip',
                        archivePath,
                    }
                }

                // サブフォルダ内の画像を再帰的に探す
                const entries = fs.readdirSync(workPath, { withFileTypes: true })
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subImages = getImagesFromFolder(path.join(workPath, entry.name))
                        if (subImages.length > 0) {
                            return {
                                workPath: path.join(workPath, entry.name),
                                totalImages: subImages.length,
                                images: subImages,
                                sourceType: 'folder',
                            }
                        }
                    }
                }
            }

            return {
                workPath,
                totalImages: images.length,
                images,
                sourceType: 'folder',
            }
        } else if (isArchiveFile(workPath)) {
            // アーカイブファイルの場合
            const images = getImagesFromZip(workPath)
            return {
                workPath: path.dirname(workPath),
                totalImages: images.length,
                images,
                sourceType: 'zip',
                archivePath: workPath,
            }
        }

        return null
    } catch (error) {
        console.error(`[Viewer] Error getting viewer data for ${workPath}:`, error)
        return null
    }
}

/**
 * 画像データを取得（Base64エンコード）
 */
export function getImageData(
    sourceType: 'folder' | 'zip',
    source: string,
    archivePath?: string
): string | null {
    try {
        let buffer: Buffer

        if (sourceType === 'folder') {
            // フォルダから直接読み込み
            buffer = fs.readFileSync(source)
        } else if (sourceType === 'zip' && archivePath) {
            // ZIPから読み込み
            const zip = new AdmZip(archivePath)
            const entry = zip.getEntry(source)

            if (!entry) {
                console.error(`[Viewer] Entry not found in ZIP: ${source}`)
                return null
            }

            buffer = entry.getData()
        } else {
            console.error(`[Viewer] Invalid source type or missing archive path`)
            return null
        }

        // MIMEタイプを判定
        const ext = path.extname(source).toLowerCase()
        let mimeType = 'image/jpeg'
        if (ext === '.png') mimeType = 'image/png'
        else if (ext === '.webp') mimeType = 'image/webp'
        else if (ext === '.gif') mimeType = 'image/gif'
        else if (ext === '.bmp') mimeType = 'image/bmp'

        // Base64エンコード
        const base64 = buffer.toString('base64')
        return `data:${mimeType};base64,${base64}`

    } catch (error) {
        console.error(`[Viewer] Error getting image data:`, error)
        return null
    }
}
