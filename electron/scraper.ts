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

// 伏文字などの記号
const DLSITE_DOMAINS = ['maniax', 'home', 'girls', 'bl']

// タグから除外するメタデータワード
const EXCLUDED_TAG_WORDS = [
    'マンガ', '漫画', 'CG・イラスト', 'CG集', 'イラスト',
    'ゲーム', 'RPG', 'ADV', 'ノベル',
    'ボイス', 'ASMR', '音声',
    '動画', 'アニメ',
    '書籍', '雑誌', '電子書籍',
    '成人向け', '全年齢', 'R-18',
    'JPEG', 'PNG'
]

/**
 * タイトルが十分に近いか判定（特に数字の一致を重視）
 */
function isGoodMatch(query: string, target: string, fuzzyWords: string[] = []): boolean {
    const q = query.toLowerCase().trim()
    const t = target.toLowerCase().trim()

    // 全角英数字・記号を半角に変換、記号を平滑化
    const normalize = (s: string) => s
        .replace(/[！-～]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xfee0)) // 全角英数記号を半角に
        .replace(/[（）()\[\]【】{}<>]/g, ' ')
        .replace(/[\s\-_]/g, '')

    const nQ = normalize(q)
    const nT = normalize(t)

    // 数字を抽出して比較（全方位で一致を要求）
    const getNums = (s: string) => s.match(/\d+/g) || []
    const qNumStr = getNums(q).join('')
    const tNumStr = getNums(t).join('')

    // 数字が一つでも違う場合は別の作品（巻号違いなど）とみなす
    if (qNumStr !== tNumStr) return false

    // 伏字記号を正規表現の任意一文字 (.) として扱うための変換
    const symbolToWildcard = (s: string) => {
        let result = s.replace(/[〇○×✕●■＊\*]/g, '.')
        // ユーザー指定のワードもワイルドカード化（各文字をドットに）
        for (const word of fuzzyWords) {
            if (!word) continue
            const escapedWord = word.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
            const dots = '.'.repeat(word.length)
            result = result.replace(new RegExp(escapedWord, 'gi'), dots)
        }
        return result.replace(/[.+*?^${}()|[\]\\]/g, (m) => m === '.' ? '.' : '\\' + m) // ドット以外をエスケープ
    }

    const qPattern = symbolToWildcard(nQ)
    const tPattern = symbolToWildcard(nT)

    try {
        // クエリがターゲットにマッチするか、またはその逆
        const reQ = new RegExp(qPattern)
        const reT = new RegExp(tPattern)
        if (reQ.test(nT) || reT.test(nQ)) return true
    } catch (e) {
        // Regexエラー時は通常の包含判定へ
    }

    // 部分一致、または包含関係
    return nQ.includes(nT) || nT.includes(nQ)
}

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

    // タグ一覧の取得（「マンガ」「ボイス」などの形式タグを除外）
    const tags: string[] = []
    $('.main_genre a, .work_genre a, div.genre a').each((_, elem) => {
        const tag = $(elem).text().trim()
        if (tag && !tags.includes(tag) && !EXCLUDED_TAG_WORDS.includes(tag)) {
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

    // 作品形式の取得（マンガ、CG・イラスト、ゲームなど）
    let workType = 'その他'
    const workTypeSelectors = [
        '.work_genre .work_type',
        '#work_outline tr th:contains("作品形式") + td',
        '.work_type_icon',
    ]

    // タグから作品形式を判定
    const workTypeKeywords: Record<string, string> = {
        'マンガ': 'マンガ',
        '漫画': 'マンガ',
        'CG・イラスト': 'CG・イラスト',
        'CG集': 'CG・イラスト',
        'イラスト': 'CG・イラスト',
        'ゲーム': 'ゲーム',
        'RPG': 'ゲーム',
        'ADV': 'ゲーム',
        'ノベル': 'ノベル',
        'ボイス': 'ボイス',
        'ASMR': 'ボイス',
        '音声': 'ボイス',
        '動画': '動画',
        'アニメ': '動画',
    }

    // タグから作品形式を検出
    for (const tag of tags) {
        for (const [keyword, type] of Object.entries(workTypeKeywords)) {
            if (tag.includes(keyword)) {
                workType = type
                break
            }
        }
        if (workType !== 'その他') break
    }

    // HTMLからも取得を試みる
    for (const selector of workTypeSelectors) {
        const element = $(selector).first()
        if (element.length) {
            const text = element.text().trim()
            for (const [keyword, type] of Object.entries(workTypeKeywords)) {
                if (text.includes(keyword)) {
                    workType = type
                    break
                }
            }
        }
        if (workType !== 'その他') break
    }

    console.log(`[Scraper] Work type: ${workType}`)

    // サンプル画像の取得
    const sampleImages: string[] = []
    const sampleSelectors = [
        '.product-slider-data div[data-src]',
        '.work_slider .slider_item img',
        '#work_left .work_slider img',
        '.product-slide-item img',
    ]

    for (const selector of sampleSelectors) {
        $(selector).each((_, element) => {
            let imgUrl = $(element).attr('data-src') || $(element).attr('src') || ''
            if (imgUrl && !imgUrl.startsWith('http')) {
                imgUrl = `https:${imgUrl}`
            }
            if (imgUrl && !sampleImages.includes(imgUrl)) {
                sampleImages.push(imgUrl)
            }
        })
        if (sampleImages.length > 0) break
    }

    // スライダーのdata属性からも取得を試みる
    $('.product-slider-data div').each((_, element) => {
        const dataSrc = $(element).attr('data-src')
        if (dataSrc) {
            let imgUrl = dataSrc
            if (!imgUrl.startsWith('http')) {
                imgUrl = `https:${imgUrl}`
            }
            if (!sampleImages.includes(imgUrl)) {
                sampleImages.push(imgUrl)
            }
        }
    })

    console.log(`[Scraper] Found ${sampleImages.length} sample images`)

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
        workType,
        sampleImages: sampleImages.slice(0, 10), // 最大10枚まで
    }

    console.log(`[Scraper] Successfully scraped from DLsite: ${title} (${rjCode})`)
    return workInfo
}

/**
 * DLsiteでタイトル検索してスクレイピング（複数ドメインを試行）
 */
export async function scrapeByTitle(title: string, localPath: string, workId: string, fuzzyWords: string[] = []): Promise<WorkInfo | null> {
    const getSearchQuery = (t: string) => t.replace(/[〇○×✕●■＊\*]/g, ' ').trim()

    // 検索実行関数
    const performSearch = async (query: string): Promise<WorkInfo | null> => {
        for (const domain of DLSITE_DOMAINS) {
            const searchUrl = getDLsiteSearchUrl(query, domain)

            try {
                console.log(`[Scraper] Searching on ${domain} for: ${query}`)

                const response = await axios.get(searchUrl, {
                    headers: REQUEST_HEADERS,
                    timeout: 15000,
                    maxRedirects: 5,
                })

                const $ = cheerio.load(response.data)

                const selectors = [
                    '.search_result_img_box_inner a',
                    '.work_thumb_box a',
                    'a[href*="/work/=/product_id/RJ"]',
                    '.n_worklist a[href*="product_id"]',
                ]

                const candidateLinks = $(selectors.join(', ')).slice(0, 10)
                for (let i = 0; i < candidateLinks.length; i++) {
                    const link = $(candidateLinks[i])
                    const linkHref = link.attr('href') || ''
                    const linkTitle = link.attr('title') || link.find('img').attr('alt') || link.text() || ''

                    const rjMatch = linkHref.match(/RJ\d{6,8}/i)
                    if (rjMatch) {
                        const rjCode = rjMatch[0].toUpperCase()
                        if (isGoodMatch(title, linkTitle, fuzzyWords)) {
                            console.log(`[Scraper] Good match found: "${linkTitle}" -> ${rjCode}`)
                            const workInfo = await scrapeWorkInfo(rjCode, localPath)
                            if (workInfo) {
                                return workInfo
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`[Scraper] Search failed on ${domain}:`, error instanceof Error ? error.message : error)
            }
        }
        return null
    }

    // 1. 通常の検索を試行
    let result = await performSearch(getSearchQuery(title))
    if (result) return result

    // 2. ユーザー指定キーワードによる「穴あけ検索」
    let fuzzyFilterQuery = title
    let hasFuzzyWord = false
    for (const word of fuzzyWords) {
        if (word && title.toLowerCase().includes(word.toLowerCase())) {
            const escapedWord = word.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
            fuzzyFilterQuery = fuzzyFilterQuery.replace(new RegExp(escapedWord, 'gi'), ' ')
            hasFuzzyWord = true
        }
    }

    if (hasFuzzyWord) {
        const finalFuzzyQuery = fuzzyFilterQuery.replace(/[〇○×✕●■＊\*]/g, ' ').replace(/\s+/g, ' ').trim()
        if (finalFuzzyQuery && finalFuzzyQuery !== getSearchQuery(title)) {
            console.log(`[Scraper] Trying fuzzy word hole-punch query: "${finalFuzzyQuery}"`)
            result = await performSearch(finalFuzzyQuery)
            if (result) return result
        }
    }

    // 3. カタカナ部分をスペースに置き換えた「ゆるい検索」を試行
    const relaxedQuery = title.replace(/[ァ-ヶー]{2,}/g, ' ')
        .replace(/[〇○×✕●■＊\*]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (relaxedQuery && relaxedQuery !== getSearchQuery(title)) {
        console.log(`[Scraper] Trying relaxed katakana query: "${relaxedQuery}"`)
        result = await performSearch(relaxedQuery)
    }

    return result
}

/**
 * Google Books APIで書籍情報を検索
 */
export async function scrapeFromGoogleBooks(title: string, localPath: string, workId: string, fuzzyWords: string[] = []): Promise<WorkInfo | null> {
    const getSearchQuery = (t: string) => t.replace(/[〇○×✕●■＊\*]/g, ' ').trim()

    const performSearch = async (query: string): Promise<WorkInfo | null> => {
        const encodedTitle = encodeURIComponent(query)
        const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodedTitle}&maxResults=5&langRestrict=ja`

        try {
            console.log(`[Scraper] Searching Google Books for: ${query}`)

            const response = await axios.get(apiUrl, { timeout: 10000 })
            const data = response.data
            if (!data.items || data.items.length === 0) return null

            let selectedBook = null
            for (const item of data.items) {
                const bookTitle = item.volumeInfo.title || ''
                if (isGoodMatch(title, bookTitle, fuzzyWords)) {
                    selectedBook = item.volumeInfo
                    console.log(`[Scraper] Found good match on Google Books: ${bookTitle}`)
                    break
                }
            }

            if (!selectedBook) return null

            const book = selectedBook
            let thumbnailUrl = ''
            if (book.imageLinks) {
                thumbnailUrl = book.imageLinks.thumbnail || book.imageLinks.smallThumbnail || ''
                thumbnailUrl = thumbnailUrl.replace('http://', 'https://')
            }

            return {
                rjCode: workId,
                title: book.title || title,
                circle: book.publisher || 'Google Books',
                authors: book.authors || [],
                tags: (book.categories || []).filter((tag: string) => !EXCLUDED_TAG_WORDS.includes(tag)),
                description: book.description?.slice(0, 1000) || '',
                thumbnailUrl,
                localPath,
                fetchedAt: new Date().toISOString(),
                releaseDate: book.publishedDate || '',
                ageRating: '全年齢',
            }

        } catch (error) {
            console.error(`[Scraper] Google Books error for ${query}:`, error)
            return null
        }
    }

    let result = await performSearch(getSearchQuery(title))
    if (result) return result

    // ゆるい検索（穴あけ）
    let fuzzyFilterQuery = title
    let hasFuzzyWord = false
    for (const word of fuzzyWords) {
        if (word && title.toLowerCase().includes(word.toLowerCase())) {
            const escapedWord = word.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
            fuzzyFilterQuery = fuzzyFilterQuery.replace(new RegExp(escapedWord, 'gi'), ' ')
            hasFuzzyWord = true
        }
    }
    if (hasFuzzyWord) {
        const finalFuzzyQuery = fuzzyFilterQuery.replace(/[〇○×✕●■＊\*]/g, ' ').replace(/\s+/g, ' ').trim()
        result = await performSearch(finalFuzzyQuery)
    }

    return result
}

/**
 * タイトルから作品情報を取得（DLsite → Google Books の順で試行）
 */
export async function scrapeByTitleWithFallback(title: string, localPath: string, workId: string, onlyDLsite: boolean = false, fuzzyWords: string[] = []): Promise<WorkInfo | null> {
    const dlsiteResult = await scrapeByTitle(title, localPath, workId, fuzzyWords)
    if (dlsiteResult) return dlsiteResult

    if (onlyDLsite) {
        console.log(`[Scraper] DLsite only mode: Skipping fallback for ${title}`)
        return null
    }

    console.log(`[Scraper] DLsite not found. Falling back to Google Books for: ${title}`)
    return await scrapeFromGoogleBooks(title, localPath, workId, fuzzyWords)
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

        if (i < works.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    return results
}
