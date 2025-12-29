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

// DLsiteのドメイン一覧（検索順序）
const DLSITE_DOMAINS = ['maniax', 'home', 'girls', 'bl']

/**
 * RJコードからDLsiteのURLを生成
 */
function getDLsiteUrl(rjCode: string, domain: string = 'maniax'): string {
    return `https://www.dlsite.com/${domain}/work/=/product_id/${rjCode}.html`
}

/**
 * DLsiteでタイトル検索を行うURLを生成
 */
function getDLsiteSearchUrl(title: string, domain: string = 'maniax'): string {
    const encodedTitle = encodeURIComponent(title)
    return `https://www.dlsite.com/${domain}/fsr/=/language/jp/keyword/${encodedTitle}/order%5B0%5D/trend/per_page/30/page/1`
}

/**
 * DLsiteから作品情報をスクレイピング（RJコード指定）
 */
export async function scrapeWorkInfo(rjCode: string, localPath: string): Promise<WorkInfo | null> {
    // RJコードがLOCAL_で始まる場合はスキップ
    if (rjCode.startsWith('LOCAL_')) {
        return null
    }

    // 複数のドメインを試行
    for (const domain of DLSITE_DOMAINS) {
        const url = getDLsiteUrl(rjCode, domain)

        try {
            console.log(`[Scraper] Fetching: ${url}`)

            const response = await axios.get(url, {
                headers: REQUEST_HEADERS,
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500, // 404もエラーにしない
            })

            if (response.status === 200) {
                const result = parseDLsitePage(response.data, rjCode, localPath)
                if (result) {
                    return result
                }
            }
        } catch (error) {
            // このドメインでは見つからなかった、次を試す
            continue
        }
    }

    console.log(`[Scraper] Work not found on any DLsite domain: ${rjCode}`)
    return null
}

/**
 * DLsiteのページHTMLをパースしてWorkInfoを生成
 */
function parseDLsitePage(html: string, rjCode: string, localPath: string): WorkInfo | null {
    const $ = cheerio.load(html)

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
        description = $('.work_parts_container').first().text().trim()
    }

    // サムネイル画像URLの取得（複数のセレクタを試行）
    let thumbnailUrl = ''
    const thumbnailSelectors = [
        'img[itemprop="image"]',
        '.work_slider_item img',
        '#work_left .work_img img',
        '.product-slider-data div[data-src]',
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
    ]

    for (const selector of thumbnailSelectors) {
        const element = $(selector).first()
        if (element.length) {
            if (selector.startsWith('meta')) {
                thumbnailUrl = element.attr('content') || ''
            } else if (element.attr('data-src')) {
                thumbnailUrl = element.attr('data-src') || ''
            } else {
                thumbnailUrl = element.attr('src') || ''
            }
            if (thumbnailUrl) break
        }
    }

    // 相対URLを絶対URLに変換
    if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
        thumbnailUrl = `https:${thumbnailUrl}`
    }

    console.log(`[Scraper] Thumbnail URL: ${thumbnailUrl}`)

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
    } else if ($('.age_18').length > 0 || $('div.work_category:contains("成人向け")').length > 0) {
        ageRating = '18禁'
    }

    const workInfo: WorkInfo = {
        rjCode,
        title,
        circle,
        authors,
        tags,
        description: description.slice(0, 1000),
        thumbnailUrl,
        localPath,
        fetchedAt: new Date().toISOString(),
        releaseDate,
        ageRating,
    }

    console.log(`[Scraper] Successfully scraped from DLsite: ${title} (${rjCode})`)
    return workInfo
}

/**
 * DLsiteでタイトル検索してスクレイピング（複数ドメインを試行）
 */
export async function scrapeByTitle(title: string, localPath: string, workId: string): Promise<WorkInfo | null> {
    console.log(`[Scraper] Searching DLsite for: ${title}`)

    // 複数のドメインで検索を試行
    for (const domain of DLSITE_DOMAINS) {
        const searchUrl = getDLsiteSearchUrl(title, domain)

        try {
            console.log(`[Scraper] Searching on ${domain}: ${title}`)

            const response = await axios.get(searchUrl, {
                headers: REQUEST_HEADERS,
                timeout: 15000,
                maxRedirects: 5,
            })

            const $ = cheerio.load(response.data)

            // 検索結果から作品を探す（複数のセレクタを試行）
            const selectors = [
                '.search_result_img_box_inner a',
                '.work_thumb_box a',
                'a[href*="/work/=/product_id/RJ"]',
                '.n_worklist a[href*="product_id"]',
            ]

            let foundHref = ''
            for (const selector of selectors) {
                const element = $(selector).first()
                if (element.length) {
                    foundHref = element.attr('href') || ''
                    if (foundHref.includes('RJ')) {
                        break
                    }
                }
            }

            if (foundHref) {
                const rjMatch = foundHref.match(/RJ\d{6,8}/i)
                if (rjMatch) {
                    const foundRjCode = rjMatch[0].toUpperCase()
                    console.log(`[Scraper] Found on DLsite (${domain}): ${foundRjCode}`)

                    // 見つかったRJコードで詳細をスクレイピング
                    const workInfo = await scrapeWorkInfo(foundRjCode, localPath)
                    if (workInfo) {
                        // 元のworkIdを維持（ライブラリの一貫性のため）
                        workInfo.rjCode = workId
                        return workInfo
                    }
                }
            }
        } catch (error) {
            console.log(`[Scraper] Search failed on ${domain}:`, error instanceof Error ? error.message : error)
            continue
        }
    }

    console.log(`[Scraper] Not found on DLsite (all domains): ${title}`)
    return null
}

/**
 * Google Books APIで書籍情報を検索
 */
export async function scrapeFromGoogleBooks(title: string, localPath: string, workId: string): Promise<WorkInfo | null> {
    const encodedTitle = encodeURIComponent(title)
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodedTitle}&maxResults=1&langRestrict=ja`

    try {
        console.log(`[Scraper] Searching Google Books for: ${title}`)

        const response = await axios.get(apiUrl, {
            timeout: 10000,
        })

        const data = response.data
        if (!data.items || data.items.length === 0) {
            console.log(`[Scraper] Not found on Google Books: ${title}`)
            return null
        }

        const book = data.items[0].volumeInfo

        // サムネイル画像を取得（HTTPSに変換）
        let thumbnailUrl = ''
        if (book.imageLinks) {
            thumbnailUrl = book.imageLinks.thumbnail || book.imageLinks.smallThumbnail || ''
            thumbnailUrl = thumbnailUrl.replace('http://', 'https://')
        }

        const workInfo: WorkInfo = {
            rjCode: workId,
            title: book.title || title,
            circle: book.publisher || 'Google Books',
            authors: book.authors || [],
            tags: book.categories || ['書籍'],
            description: book.description?.slice(0, 1000) || '',
            thumbnailUrl,
            localPath,
            fetchedAt: new Date().toISOString(),
            releaseDate: book.publishedDate || '',
            ageRating: '全年齢',
        }

        console.log(`[Scraper] Successfully scraped from Google Books: ${workInfo.title}`)
        return workInfo

    } catch (error) {
        console.error(`[Scraper] Google Books error for ${title}:`, error)
        return null
    }
}

/**
 * タイトルから作品情報を取得（DLsite → Google Books の順で試行）
 */
export async function scrapeByTitleWithFallback(title: string, localPath: string, workId: string): Promise<WorkInfo | null> {
    // 1. まずDLsiteでタイトル検索（複数ドメイン）
    const dlsiteResult = await scrapeByTitle(title, localPath, workId)
    if (dlsiteResult) {
        return dlsiteResult
    }

    // 2. DLsiteで見つからなければGoogle Booksで検索
    const googleBooksResult = await scrapeFromGoogleBooks(title, localPath, workId)
    if (googleBooksResult) {
        return googleBooksResult
    }

    // 3. どちらでも見つからなかった
    console.log(`[Scraper] Could not find info for: ${title}`)
    return null
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
