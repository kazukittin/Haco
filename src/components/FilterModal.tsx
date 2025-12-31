import { useState, useMemo, useEffect } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Select } from './ui/select'
import { ScrollArea } from './ui/scroll-area'
import {
    SearchIcon,
    TagIcon,
    UsersIcon,
    FilterIcon,
    XIcon,
    CheckIcon,
    PencilIcon,
} from './ui/icons'
import type { TagCount, CircleCount } from '../vite-env.d'

interface FilterModalProps {
    isOpen: boolean
    onClose: () => void
    searchQuery: string
    onSearchChange: (query: string) => void
    tags: TagCount[]
    selectedTags: string[]
    onTagToggle: (tag: string) => void
    circles: CircleCount[]
    selectedCircle: string
    onCircleChange: (circle: string) => void
    workTypes: { type: string; count: number }[]
    selectedWorkType: string
    onWorkTypeChange: (workType: string) => void
    onClearFilters: () => void
}

// 五十音のカテゴリ定義
const HIRAGANA_CATEGORIES = [
    { id: 'a', label: 'あ', chars: ['あ', 'い', 'う', 'え', 'お', 'ア', 'イ', 'ウ', 'エ', 'オ'] },
    { id: 'ka', label: 'か', chars: ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご', 'カ', 'キ', 'ク', 'ケ', 'コ', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ'] },
    { id: 'sa', label: 'さ', chars: ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'] },
    { id: 'ta', label: 'た', chars: ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど', 'タ', 'チ', 'ツ', 'テ', 'ト', 'ダ', 'ヂ', 'ヅ', 'デ', 'ド'] },
    { id: 'na', label: 'な', chars: ['な', 'に', 'ぬ', 'ね', 'の', 'ナ', 'ニ', 'ヌ', 'ネ', 'ノ'] },
    { id: 'ha', label: 'は', chars: ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'パ', 'ピ', 'プ', 'ペ', 'ポ'] },
    { id: 'ma', label: 'ま', chars: ['ま', 'み', 'む', 'め', 'も', 'マ', 'ミ', 'ム', 'メ', 'モ'] },
    { id: 'ya', label: 'や', chars: ['や', 'ゆ', 'よ', 'ヤ', 'ユ', 'ヨ'] },
    { id: 'ra', label: 'ら', chars: ['ら', 'り', 'る', 'れ', 'ろ', 'ラ', 'リ', 'ル', 'レ', 'ロ'] },
    { id: 'wa', label: 'わ', chars: ['わ', 'を', 'ん', 'ワ', 'ヲ', 'ン'] },
    { id: 'alpha', label: 'A-Z', chars: [] }, // アルファベット用
    { id: 'other', label: '他', chars: [] }, // その他
]
// 漢字→訓読み（最初のひらがな）のマッピング
// よく使われる漢字を五十音順のカテゴリに対応（重複なし）
const KANJI_READING_MAP: Record<string, string> = {
    // あ行 - あ/い/う/え/お で始まる読みの漢字
    '愛': 'a', '悪': 'a', '甘': 'a', '姉': 'a', '兄': 'a', '妹': 'a', '新': 'a',
    '脚': 'a', '足': 'a', '汗': 'a', '穴': 'a', '遊': 'a', '雨': 'a',
    '淫': 'a', '色': 'a', '伊': 'a', '異': 'a', '医': 'a', '意': 'a', '居': 'a',
    '院': 'a', '陰': 'a', '隠': 'a', '後': 'a', '上': 'a', '薄': 'a', '受': 'a',
    '動': 'a', '生': 'a', '嘘': 'a', '歌': 'a', '裏': 'a', '売': 'a', '援': 'a',
    '演': 'a', '縁': 'a', '奥': 'a', '押': 'a', '幼': 'a', '俺': 'a', '温': 'a',
    '恩': 'a', '鬼': 'a',
    // か行 - か/き/く/け/こ で始まる読みの漢字
    '顔': 'ka', '書': 'ka', '飼': 'ka', '可': 'ka', '家': 'ka', '火': 'ka',
    '花': 'ka', '華': 'ka', '夏': 'ka', '河': 'ka', '科': 'ka', '加': 'ka',
    '彼': 'ka', '髪': 'ka', '紙': 'ka', '神': 'ka', '雷': 'ka', '体': 'ka',
    '狩': 'ka', '着': 'ka', '聞': 'ka', '汚': 'ka', '傷': 'ka', '北': 'ka',
    '切': 'ka', '木': 'ka', '気': 'ka', '黄': 'ka', '金': 'ka', '銀': 'ka',
    '筋': 'ka', '靴': 'ka', '空': 'ka', '腐': 'ka', '口': 'ka', '首': 'ka',
    '草': 'ka', '薬': 'ka', '黒': 'ka', '鎖': 'ka', '毛': 'ka', '蹴': 'ka',
    '獣': 'ka', '恋': 'ka', '声': 'ka', '心': 'ka', '氷': 'ka', '言': 'ka',
    '殺': 'ka', '壊': 'ka', '義': 'ka', '騎': 'ka', '吸': 'ka', '巨': 'ka',
    '強': 'ka', '虐': 'ka', '教': 'ka', '狂': 'ka', '胸': 'ka', '極': 'ka',
    '近': 'ka', '禁': 'ka', '緊': 'ka', '拘': 'ka', '拷': 'ka', '公': 'ka',
    '交': 'ka', '肛': 'ka', '高': 'ka', '鋼': 'ka',
    // さ行 - さ/し/す/せ/そ で始まる読みの漢字
    '逆': 'sa', '先': 'sa', '触': 'sa', '調': 'sa', '裂': 'sa', '寒': 'sa',
    '下': 'sa', '刺': 'sa', '冴': 'sa', '再': 'sa', '妻': 'sa', '才': 'sa',
    '最': 'sa', '歳': 'sa', '催': 'sa', '際': 'sa', '師': 'sa', '姿': 'sa',
    '紫': 'sa', '死': 'sa', '敷': 'sa', '縛': 'sa', '白': 'sa', '搾': 'sa',
    '写': 'sa', '射': 'sa', '車': 'sa', '雌': 'sa', '縮': 'sa', '瞬': 'sa',
    '純': 'sa', '処': 'sa', '初': 'sa', '所': 'sa', '娼': 'sa', '小': 'sa',
    '少': 'sa', '笑': 'sa', '丈': 'sa', '乗': 'sa', '城': 'sa',
    '場': 'sa', '嬢': 'sa', '常': 'sa', '情': 'sa', '条': 'sa', '蒸': 'sa',
    '精': 'sa', '性': 'sa', '聖': 'sa', '正': 'sa', '清': 'sa', '制': 'sa',
    '成': 'sa', '青': 'sa', '責': 'sa', '赤': 'sa', '石': 'sa', '節': 'sa',
    '雪': 'sa', '絶': 'sa', '舌': 'sa', '説': 'sa', '仙': 'sa', '占': 'sa',
    '戦': 'sa', '洗': 'sa', '船': 'sa', '選': 'sa', '相': 'sa', '双': 'sa',
    '挿': 'sa', '操': 'sa', '早': 'sa', '巣': 'sa', '創': 'sa', '走': 'sa',
    '送': 'sa', '蔵': 'sa', '増': 'sa', '束': 'sa', '速': 'sa', '側': 'sa',
    '即': 'sa', '息': 'sa', '続': 'sa', '存': 'sa', '孫': 'sa', '尊': 'sa',
    '村': 'sa',
    // た行 - た/ち/つ/て/と で始まる読みの漢字
    '対': 'ta', '大': 'ta', '太': 'ta', '多': 'ta', '他': 'ta', '打': 'ta',
    '唾': 'ta', '宝': 'ta', '達': 'ta', '堕': 'ta', '騙': 'ta', '黙': 'ta',
    '短': 'ta', '単': 'ta', '誕': 'ta', '淡': 'ta', '端': 'ta', '男': 'ta',
    '断': 'ta', '団': 'ta', '段': 'ta', '暖': 'ta', '痴': 'ta', '稚': 'ta',
    '地': 'ta', '池': 'ta', '知': 'ta', '治': 'ta', '置': 'ta', '築': 'ta',
    '畜': 'ta', '竹': 'ta', '秩': 'ta', '中': 'ta', '仲': 'ta', '宙': 'ta',
    '昼': 'ta', '注': 'ta', '虫': 'ta', '腸': 'ta', '挑': 'ta', '頂': 'ta',
    '朝': 'ta', '潮': 'ta', '町': 'ta', '跳': 'ta', '超': 'ta', '蝶': 'ta',
    '鳥': 'ta', '通': 'ta', '痛': 'ta', '貞': 'ta', '低': 'ta', '停': 'ta',
    '定': 'ta', '帝': 'ta', '底': 'ta', '庭': 'ta', '弟': 'ta', '提': 'ta',
    '泥': 'ta', '溺': 'ta', '敵': 'ta', '的': 'ta', '適': 'ta', '殿': 'ta',
    '唐': 'ta', '塔': 'ta', '堂': 'ta', '島': 'ta', '投': 'ta', '東': 'ta',
    '桃': 'ta', '湯': 'ta', '登': 'ta', '盗': 'ta', '等': 'ta', '答': 'ta',
    '統': 'ta', '踏': 'ta', '逃': 'ta', '透': 'ta', '道': 'ta', '頭': 'ta',
    '闘': 'ta', '同': 'ta', '導': 'ta', '童': 'ta', '洞': 'ta', '働': 'ta',
    '瞳': 'ta',
    // な行 - な/に/ぬ/ね/の で始まる読みの漢字
    '泣': 'na', '流': 'na', '長': 'na', '名': 'na', '那': 'na', '南': 'na',
    '肉': 'na', '二': 'na', '日': 'na', '入': 'na', '乳': 'na', '如': 'na',
    '尿': 'na', '妊': 'na', '忍': 'na', '寝': 'na', '認': 'na', '年': 'na',
    '念': 'na', '燃': 'na', '粘': 'na', '納': 'na', '能': 'na', '農': 'na',
    '濃': 'na', '脳': 'na',
    // は行 - は/ひ/ふ/へ/ほ で始まる読みの漢字
    '派': 'ha', '破': 'ha', '波': 'ha', '婆': 'ha', '覇': 'ha', '配': 'ha',
    '廃': 'ha', '拝': 'ha', '排': 'ha', '敗': 'ha', '杯': 'ha', '背': 'ha',
    '肺': 'ha', '倍': 'ha', '梅': 'ha', '買': 'ha', '伯': 'ha', '拍': 'ha',
    '泊': 'ha', '迫': 'ha', '博': 'ha', '爆': 'ha', '麦': 'ha', '箱': 'ha',
    '肌': 'ha', '半': 'ha', '反': 'ha', '坂': 'ha', '板': 'ha', '版': 'ha',
    '犯': 'ha', '班': 'ha', '繁': 'ha', '範': 'ha', '飯': 'ha', '晩': 'ha',
    '番': 'ha', '盤': 'ha', '判': 'ha', '否': 'ha', '妃': 'ha', '悲': 'ha',
    '扉': 'ha', '皮': 'ha', '秘': 'ha', '肥': 'ha', '被': 'ha', '費': 'ha',
    '飛': 'ha', '必': 'ha', '筆': 'ha', '媚': 'ha', '姫': 'ha', '百': 'ha',
    '標': 'ha', '表': 'ha', '評': 'ha', '描': 'ha', '病': 'ha', '品': 'ha',
    '浜': 'ha', '貧': 'ha', '瓶': 'ha', '夫': 'ha', '付': 'ha', '布': 'ha',
    '撫': 'ha', '浮': 'ha', '父': 'ha', '膚': 'ha', '負': 'ha',
    '武': 'ha', '舞': 'ha', '部': 'ha', '封': 'ha', '風': 'ha', '伏': 'ha',
    '服': 'ha', '副': 'ha', '復': 'ha', '幅': 'ha', '福': 'ha', '腹': 'ha',
    '複': 'ha', '覆': 'ha', '物': 'ha', '沸': 'ha', '仏': 'ha', '払': 'ha',
    '粉': 'ha', '噴': 'ha', '憤': 'ha', '奮': 'ha', '分': 'ha', '文': 'ha',
    '兵': 'ha', '併': 'ha', '並': 'ha', '平': 'ha', '閉': 'ha',
    '米': 'ha', '壁': 'ha', '別': 'ha', '片': 'ha', '辺': 'ha', '返': 'ha',
    '変': 'ha', '偏': 'ha', '編': 'ha', '便': 'ha', '勉': 'ha', '弁': 'ha',
    '保': 'ha', '補': 'ha', '捕': 'ha', '歩': 'ha', '墓': 'ha', '暮': 'ha',
    '母': 'ha', '募': 'ha', '包': 'ha', '報': 'ha', '放': 'ha', '方': 'ha',
    '法': 'ha', '泡': 'ha', '砲': 'ha', '縫': 'ha', '芳': 'ha', '訪': 'ha',
    '豊': 'ha', '邦': 'ha', '飽': 'ha', '亡': 'ha', '乏': 'ha', '傍': 'ha',
    '坊': 'ha', '牧': 'ha', '墨': 'ha', '撲': 'ha', '僕': 'ha', '堀': 'ha',
    '本': 'ha', '翻': 'ha', '凡': 'ha', '盆': 'ha',
    // ま行 - ま/み/む/め/も で始まる読みの漢字
    '魔': 'ma', '麻': 'ma', '摩': 'ma', '磨': 'ma', '魅': 'ma', '未': 'ma',
    '味': 'ma', '眉': 'ma', '脈': 'ma', '民': 'ma', '眠': 'ma', '務': 'ma',
    '霧': 'ma', '娘': 'ma', '婿': 'ma', '明': 'ma', '迷': 'ma', '銘': 'ma',
    '鳴': 'ma', '命': 'ma', '滅': 'ma', '免': 'ma', '綿': 'ma', '面': 'ma',
    '猛': 'ma', '盲': 'ma', '網': 'ma', '目': 'ma', '門': 'ma',
    '紋': 'ma', '問': 'ma', '前': 'ma', '幕': 'ma', '膜': 'ma', '枕': 'ma',
    '又': 'ma', '末': 'ma', '繭': 'ma', '満': 'ma', '慢': 'ma', '漫': 'ma',
    '万': 'ma', '女': 'ma', '落': 'ma',
    // や行 - や/ゆ/よ で始まる読みの漢字
    '夜': 'ya', '野': 'ya', '冶': 'ya', '厄': 'ya', '役': 'ya', '約': 'ya',
    '訳': 'ya', '躍': 'ya', '山': 'ya', '揺': 'ya', '揚': 'ya', '陽': 'ya',
    '養': 'ya', '擁': 'ya', '妖': 'ya', '容': 'ya', '洋': 'ya', '溶': 'ya',
    '用': 'ya', '窯': 'ya', '羊': 'ya', '葉': 'ya', '要': 'ya', '踊': 'ya',
    '抑': 'ya', '浴': 'ya', '翌': 'ya', '翼': 'ya', '読': 'ya',
    // ら行 - ら/り/る/れ/ろ で始まる読みの漢字
    '拉': 'ra', '裸': 'ra', '乱': 'ra', '欄': 'ra', '濫': 'ra', '卵': 'ra',
    '覧': 'ra', '利': 'ra', '里': 'ra', '理': 'ra', '璃': 'ra', '離': 'ra',
    '立': 'ra', '律': 'ra', '率': 'ra', '粒': 'ra', '慄': 'ra', '略': 'ra',
    '劉': 'ra', '留': 'ra', '硫': 'ra', '隆': 'ra', '竜': 'ra', '龍': 'ra',
    '旅': 'ra', '慮': 'ra', '虜': 'ra', '了': 'ra', '両': 'ra', '僚': 'ra',
    '寮': 'ra', '料': 'ra', '涼': 'ra', '猟': 'ra', '療': 'ra', '糧': 'ra',
    '良': 'ra', '量': 'ra', '陵': 'ra', '領': 'ra', '力': 'ra', '緑': 'ra',
    '倫': 'ra', '林': 'ra', '臨': 'ra', '輪': 'ra', '隣': 'ra', '塁': 'ra',
    '涙': 'ra', '累': 'ra', '類': 'ra', '令': 'ra', '冷': 'ra', '励': 'ra',
    '玲': 'ra', '礼': 'ra', '鈴': 'ra', '零': 'ra', '霊': 'ra', '麗': 'ra',
    '齢': 'ra', '暦': 'ra', '歴': 'ra', '列': 'ra', '劣': 'ra', '烈': 'ra',
    '廉': 'ra', '憐': 'ra', '練': 'ra', '連': 'ra', '錬': 'ra', '労': 'ra',
    '廊': 'ra', '弄': 'ra', '朗': 'ra', '楼': 'ra', '浪': 'ra', '漏': 'ra',
    '牢': 'ra', '狼': 'ra', '篭': 'ra', '老': 'ra', '郎': 'ra', '六': 'ra',
    '禄': 'ra', '録': 'ra', '論': 'ra',
    // わ行 - わ で始まる読みの漢字
    '和': 'wa', '話': 'wa', '湾': 'wa', '腕': 'wa', '割': 'wa', '枠': 'wa',
    '惑': 'wa', '若': 'wa', '脇': 'wa', '技': 'wa',
}

// カスタム読みをlocalStorageから読み込む
const CUSTOM_READINGS_KEY = 'haco_custom_tag_readings'

function loadCustomReadings(): Record<string, string> {
    try {
        const stored = localStorage.getItem(CUSTOM_READINGS_KEY)
        return stored ? JSON.parse(stored) : {}
    } catch {
        return {}
    }
}

function saveCustomReadings(readings: Record<string, string>): void {
    try {
        localStorage.setItem(CUSTOM_READINGS_KEY, JSON.stringify(readings))
    } catch {
        console.error('Failed to save custom readings')
    }
}

// タグの最初の文字からカテゴリを判定（カスタム読みを優先）
function getTagCategory(tag: string, customReadings: Record<string, string>): string {
    // カスタム読みがあれば優先
    if (customReadings[tag]) {
        return customReadings[tag]
    }

    const firstChar = tag.charAt(0)

    // アルファベット判定
    if (/^[a-zA-Z]/.test(firstChar)) {
        return 'alpha'
    }

    // 五十音判定（ひらがな・カタカナ）
    for (const cat of HIRAGANA_CATEGORIES) {
        if (cat.chars.includes(firstChar)) {
            return cat.id
        }
    }

    // 漢字の訓読みから判定
    if (KANJI_READING_MAP[firstChar]) {
        return KANJI_READING_MAP[firstChar]
    }

    // それ以外は「その他」に分類
    return 'other'
}

export function FilterModal({
    isOpen,
    onClose,
    searchQuery,
    onSearchChange,
    tags,
    selectedTags,
    onTagToggle,
    circles,
    selectedCircle,
    onCircleChange,
    workTypes,
    selectedWorkType,
    onWorkTypeChange,
    onClearFilters,
}: FilterModalProps) {
    const [tagSearchQuery, setTagSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<string | null>(null)

    // カスタム読みの管理
    const [customReadings, setCustomReadings] = useState<Record<string, string>>({})
    const [editingTag, setEditingTag] = useState<string | null>(null)

    // 初期読み込み
    useEffect(() => {
        setCustomReadings(loadCustomReadings())
    }, [])

    // カスタム読みを保存
    const handleSetReading = (tag: string, categoryId: string) => {
        const newReadings = { ...customReadings, [tag]: categoryId }
        setCustomReadings(newReadings)
        saveCustomReadings(newReadings)
        setEditingTag(null)
    }

    // カスタム読みを削除
    const handleRemoveReading = (tag: string) => {
        const newReadings = { ...customReadings }
        delete newReadings[tag]
        setCustomReadings(newReadings)
        saveCustomReadings(newReadings)
        setEditingTag(null)
    }

    // circleOptionsをメモ化
    const circleOptions = useMemo(() => [
        { value: '', label: 'すべてのサークル' },
        ...circles.slice(0, 100).map((c) => ({
            value: c.circle,
            label: `${c.circle} (${c.count})`,
        })),
    ], [circles])

    // workTypeOptionsをメモ化
    const workTypeOptions = useMemo(() => [
        { value: '', label: 'すべての形式' },
        ...workTypes.map((t) => ({
            value: t.type,
            label: `${t.type} (${t.count})`,
        })),
    ], [workTypes])

    // タグを検索でフィルタリング
    const filteredTags = useMemo(() => {
        if (!tagSearchQuery.trim()) return tags
        const query = tagSearchQuery.toLowerCase()
        return tags.filter(({ tag }) => tag.toLowerCase().includes(query))
    }, [tags, tagSearchQuery])

    // タグをカテゴリ別にグループ化
    const groupedTags = useMemo(() => {
        const groups: Record<string, TagCount[]> = {}

        HIRAGANA_CATEGORIES.forEach(cat => {
            groups[cat.id] = []
        })

        filteredTags.forEach((tagItem) => {
            const category = getTagCategory(tagItem.tag, customReadings)
            if (groups[category]) {
                groups[category].push(tagItem)
            } else {
                groups['other'].push(tagItem)
            }
        })

        return groups
    }, [filteredTags, customReadings])

    // 存在するカテゴリのみ取得
    const availableCategories = useMemo(() => {
        return HIRAGANA_CATEGORIES.filter(cat => groupedTags[cat.id]?.length > 0)
    }, [groupedTags])

    // カテゴリへスクロール
    const scrollToCategory = (categoryId: string) => {
        setActiveCategory(categoryId)
        const element = document.getElementById(`tag-category-${categoryId}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    // 早期リターンはすべてのフックの後に配置
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Body */}
            <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <FilterIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">フィルター</h2>
                            <p className="text-xs text-slate-500">条件を指定して絞り込みます</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-white/5 space-y-4 flex-shrink-0">
                        {/* Keyword Search */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <SearchIcon className="w-3.5 h-3.5" />
                                Keyword
                            </label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    placeholder="タイトル、サークル名、RJコード..."
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="bg-white/5 border-white/5 h-10 rounded-lg focus:border-purple-500/50 pr-10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Work Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <FilterIcon className="w-3.5 h-3.5" />
                                    Work Format
                                </label>
                                <Select
                                    value={selectedWorkType}
                                    onChange={(e) => onWorkTypeChange(e.target.value)}
                                    options={workTypeOptions}
                                    className="bg-white/5 border-white/5 h-10 rounded-lg"
                                />
                            </div>

                            {/* Circle */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <UsersIcon className="w-3.5 h-3.5" />
                                    Circle / Brand
                                </label>
                                <Select
                                    value={selectedCircle}
                                    onChange={(e) => onCircleChange(e.target.value)}
                                    options={circleOptions}
                                    className="bg-white/5 border-white/5 h-10 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tags Section */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Tag Header */}
                        <div className="px-6 py-3 border-b border-white/5 flex-shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <TagIcon className="w-3.5 h-3.5" />
                                    ジャンルを選択
                                </label>
                                {selectedTags.length > 0 && (
                                    <button
                                        onClick={() => selectedTags.forEach(onTagToggle)}
                                        className="text-xs font-bold text-purple-400 hover:text-purple-300"
                                    >
                                        選択解除 ({selectedTags.length})
                                    </button>
                                )}
                            </div>

                            {/* Tag Search */}
                            <div className="relative mb-3">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    type="text"
                                    placeholder="お探しのジャンルはなんですか？"
                                    value={tagSearchQuery}
                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                    className="bg-white/5 border-white/5 h-10 rounded-lg pl-10 pr-10"
                                />
                                {tagSearchQuery && (
                                    <button
                                        onClick={() => setTagSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Category Tabs */}
                            {!tagSearchQuery && (
                                <div className="flex flex-wrap gap-1">
                                    {availableCategories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => scrollToCategory(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeCategory === cat.id
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {cat.label}
                                            <span className="ml-1 opacity-50">({groupedTags[cat.id]?.length || 0})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tags List */}
                        <ScrollArea className="flex-1 px-6 py-4">
                            {tagSearchQuery ? (
                                // 検索結果表示
                                <div className="space-y-2">
                                    {filteredTags.length === 0 ? (
                                        <p className="text-center text-slate-500 py-8">
                                            キーワードに一致するジャンルは見つかりませんでした。
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {filteredTags.map(({ tag, count }) => {
                                                const isSelected = selectedTags.includes(tag)
                                                return (
                                                    <label
                                                        key={tag}
                                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${isSelected
                                                            ? 'bg-purple-500/20 text-white'
                                                            : 'hover:bg-white/5 text-slate-300'
                                                            }`}
                                                        onClick={() => onTagToggle(tag)}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected
                                                            ? 'bg-purple-500 border-purple-500'
                                                            : 'border-slate-600'
                                                            }`}>
                                                            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="text-sm truncate flex-1">{tag}</span>
                                                        <span className="text-xs text-slate-500">{count}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // カテゴリ別表示
                                <div className="space-y-6">
                                    {availableCategories.map((cat) => (
                                        <div key={cat.id} id={`tag-category-${cat.id}`}>
                                            <h3 className="text-sm font-bold text-slate-400 mb-3 pb-2 border-b border-white/5 sticky top-0 bg-slate-900 flex items-center justify-between">
                                                <span>{cat.label}</span>
                                                {cat.id === 'other' && (
                                                    <span className="text-xs text-slate-500 font-normal">
                                                        鉛筆アイコンで読みを設定
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {groupedTags[cat.id]?.map(({ tag, count }) => {
                                                    const isSelected = selectedTags.includes(tag)
                                                    const isEditing = editingTag === tag
                                                    const hasCustomReading = !!customReadings[tag]

                                                    return (
                                                        <div key={tag} className="relative">
                                                            <label
                                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${isSelected
                                                                    ? 'bg-purple-500/20 text-white'
                                                                    : 'hover:bg-white/5 text-slate-300'
                                                                    } ${cat.id === 'other' || hasCustomReading ? 'pr-8' : ''}`}
                                                                onClick={() => onTagToggle(tag)}
                                                            >
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected
                                                                    ? 'bg-purple-500 border-purple-500'
                                                                    : 'border-slate-600'
                                                                    }`}>
                                                                    {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                                                                </div>
                                                                <span className="text-sm truncate flex-1">{tag}</span>
                                                                <span className="text-xs text-slate-500">{count}</span>
                                                            </label>

                                                            {/* 「他」カテゴリまたはカスタム読みがあるタグには編集ボタンを表示 */}
                                                            {(cat.id === 'other' || hasCustomReading) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditingTag(isEditing ? null : tag)
                                                                    }}
                                                                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${hasCustomReading
                                                                            ? 'text-purple-400 hover:text-purple-300'
                                                                            : 'text-slate-500 hover:text-slate-300'
                                                                        }`}
                                                                    title="読みを設定"
                                                                >
                                                                    <PencilIcon className="w-3 h-3" />
                                                                </button>
                                                            )}

                                                            {/* 読み仮名選択ポップアップ */}
                                                            {isEditing && (
                                                                <div className="absolute z-50 right-0 top-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl p-2 min-w-[200px]">
                                                                    <p className="text-xs text-slate-400 mb-2 px-1">「{tag}」の読み</p>
                                                                    <div className="grid grid-cols-5 gap-1 mb-2">
                                                                        {HIRAGANA_CATEGORIES.filter(c => c.id !== 'other').map((c) => (
                                                                            <button
                                                                                key={c.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    handleSetReading(tag, c.id)
                                                                                }}
                                                                                className={`px-2 py-1.5 rounded text-xs font-bold transition-all ${customReadings[tag] === c.id
                                                                                        ? 'bg-purple-500 text-white'
                                                                                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                                                                    }`}
                                                                            >
                                                                                {c.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    {hasCustomReading && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleRemoveReading(tag)
                                                                            }}
                                                                            className="w-full px-2 py-1 rounded text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                                        >
                                                                            設定を削除
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
                    <button
                        onClick={onClearFilters}
                        className="px-4 py-2 rounded-lg bg-white/5 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        リセット
                    </button>
                    <Button
                        onClick={onClose}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-5 rounded-xl font-black shadow-xl shadow-purple-600/20"
                    >
                        指定する
                    </Button>
                </div>
            </div>
        </div>
    )
}
