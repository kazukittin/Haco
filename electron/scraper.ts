import axios from 'axios'
import * as cheerio from 'cheerio'
import type { WorkInfo } from './types'

// DLsiteへのリクエストに使用するヘッダー
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

/**
 * RJコードからDLsiteのURLを生成
 */
function getDLsiteUrl(rjCode: string): string {
    // 一般向け作品ページのURL
    return `https://www.dlsite.com/home/work/=/product_id/${rjCode}.html`
}

/**
 * DLsiteから作品情報をスクレイピング
 */
export async function scrapeWorkInfo(rjCode: string, localPath: string): Promise<WorkInfo | null> {
    const url = getDLsiteUrl(rjCode)

    try {
        console.log(`[Scraper] Fetching: ${url}`)

        const response = await axios.get(url, {
            headers: REQUEST_HEADERS,
            timeout: 15000,
            // リダイレクトを許可（成人向けページへのリダイレクトなど）
            maxRedirects: 5,
        })

        const $ = cheerio.load(response.data)

        // 作品タイトルの取得
        const title = $('#work_name').text().trim() ||
            $('h1[itemprop="name"]').text().trim() ||
            $('.work_name').text().trim()

        if (!title) {
            console.log(`[Scraper] Title not found for ${rjCode}`)
            return null
        }

        // サークル名の取得
        const circle = $('span[itemprop="brand"]').text().trim() ||
            $('.maker_name a').text().trim() ||
            $('#work_maker .maker_name a').text().trim()

        // 作者名の取得（複数の場合あり）
        const authors: string[] = []
        $('#work_outline tr').each((_, row) => {
            const header = $(row).find('th').text().trim()
            if (header === '作者' || header === '声優' || header === 'イラスト' || header === 'シナリオ') {
                $(row).find('td a').each((_, link) => {
                    const author = $(link).text().trim()
                    if (author && !authors.includes(author)) {
                        authors.push(author)
                    }
                })
            }
        })

        // タグ一覧の取得
        const tags: string[] = []
        $('.main_genre a, .work_genre a, div.genre a').each((_, elem) => {
            const tag = $(elem).text().trim()
            if (tag && !tags.includes(tag)) {
                tags.push(tag)
            }
        })

        // あらすじの取得
        let description = ''
        const descElement = $('[itemprop="description"]')
        if (descElement.length) {
            description = descElement.text().trim()
        } else {
            // 代替: work_parts内のテキスト
            description = $('.work_parts_container').first().text().trim()
        }

        // サムネイル画像URLの取得
        let thumbnailUrl = ''
        const imgElement = $('img[itemprop="image"]').first()
        if (imgElement.length) {
            thumbnailUrl = imgElement.attr('src') || imgElement.attr('data-src') || ''
        }
        // 相対URLを絶対URLに変換
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
            thumbnailUrl = `https:${thumbnailUrl}`
        }

        // 発売日の取得
        let releaseDate = ''
        $('#work_outline tr').each((_, row) => {
            const header = $(row).find('th').text().trim()
            if (header === '販売日') {
                releaseDate = $(row).find('td a').text().trim()
            }
        })

        // 年齢レーティングの取得
        let ageRating = '全年齢'
        const ageIcon = $('.work_genre .icon_ADL, .work_genre .icon_GEN')
        if (ageIcon.hasClass('icon_ADL')) {
            ageRating = '18禁'
        } else if ($('.age_18').length > 0) {
            ageRating = '18禁'
        }

        const workInfo: WorkInfo = {
            rjCode,
            title,
            circle,
            authors,
            tags,
            description: description.slice(0, 1000), // 長すぎる場合は切り詰め
            thumbnailUrl,
            localPath,
            fetchedAt: new Date().toISOString(),
            releaseDate,
            ageRating,
        }

        console.log(`[Scraper] Successfully scraped: ${title} (${rjCode})`)
        return workInfo

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                console.log(`[Scraper] Work not found: ${rjCode}`)
            } else {
                console.error(`[Scraper] HTTP Error for ${rjCode}:`, error.response?.status, error.message)
            }
        } else {
            console.error(`[Scraper] Error scraping ${rjCode}:`, error)
        }
        return null
    }
}

/**
 * 複数の作品を順番にスクレイピング（レート制限対策）
 */
export async function scrapeMultipleWorks(
    works: Array<{ rjCode: string; localPath: string }>,
    delayMs: number = 1000,
    onProgress?: (current: number, total: number, rjCode: string) => void
): Promise<Map<string, WorkInfo>> {
    const results = new Map<string, WorkInfo>()

    for (let i = 0; i < works.length; i++) {
        const { rjCode, localPath } = works[i]

        if (onProgress) {
            onProgress(i + 1, works.length, rjCode)
        }

        const workInfo = await scrapeWorkInfo(rjCode, localPath)
        if (workInfo) {
            results.set(rjCode, workInfo)
        }

        // 最後の作品以外はディレイを入れる
        if (i < works.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    return results
}
