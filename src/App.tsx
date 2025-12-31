import { useState, useEffect, useMemo, useCallback } from 'react'
import type { WorkInfo, LibraryData, TagCount, CircleCount } from './vite-env.d'
import { WorkGrid } from './components/WorkGrid'
import { SettingsPage } from './components/SettingsPage'
import { WorkDetailModal } from './components/WorkDetailModal'
import { ViewerModal } from './components/ViewerModal'
import { FilterModal } from './components/FilterModal'
import { ScanStatus } from './components/ScanStatus'
import { SettingsIcon, RefreshIcon, FilterIcon, XIcon, PlayIcon } from './components/ui/icons'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'

function App() {
    // 画面状態
    const [currentView, setCurrentView] = useState<'library' | 'settings'>('library')

    // ライブラリデータ
    const [libraryData, setLibraryData] = useState<LibraryData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // フィルター状態
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [selectedCircle, setSelectedCircle] = useState('')
    const [selectedWorkType, setSelectedWorkType] = useState('')

    // ソート状態
    type SortOption = 'title' | 'releaseDate' | 'addedDate' | 'lastRead' | 'circle'
    const [sortOption, setSortOption] = useState<SortOption>('addedDate')

    // モーダル状態
    const [selectedWork, setSelectedWork] = useState<WorkInfo | null>(null)
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

    // ビューア状態
    const [viewerWork, setViewerWork] = useState<WorkInfo | null>(null)

    // スキャン状態（ヘッダーからの簡易スキャン用）
    const [isHeaderScanning, setIsHeaderScanning] = useState(false)

    // ライブラリデータを読み込む
    const loadLibraryData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        try {
            const data = await window.electronAPI.getLibraryData()
            setLibraryData(data)
        } catch (error) {
            console.error('Failed to load library:', error)
        } finally {
            if (!silent) setIsLoading(false)
        }
    }, [])

    // 初回読み込みと更新イベントのリッスン
    useEffect(() => {
        loadLibraryData()

        const cleanup = window.electronAPI.onLibraryUpdated(() => {
            console.log('[App] Library update detected, reloading...')
            // バックグラウンドでの更新はisLoadingを表示しない（スクロール位置を維持するため）
            loadLibraryData(true)
        })

        return cleanup
    }, [loadLibraryData])

    // 全作品リスト
    const allWorks = useMemo(() => {
        if (!libraryData) return []
        return Object.values(libraryData.works)
    }, [libraryData])

    // 最近読んだ作品（上位5件）
    const recentlyReadWorks = useMemo(() => {
        return allWorks
            .filter(work => work.lastReadAt && !work.isHidden)
            .sort((a, b) => {
                const dateA = new Date(a.lastReadAt || 0).getTime()
                const dateB = new Date(b.lastReadAt || 0).getTime()
                return dateB - dateA
            })
            .slice(0, 5)
    }, [allWorks])

    // タグ除外ワード
    const excludedTags = ['PDF同梱']

    // タグ一覧（使用頻度順）
    const tags: TagCount[] = useMemo(() => {
        const tagCounts = new Map<string, number>()
        allWorks.forEach((work) => {
            work.tags.forEach((tag) => {
                // 除外ワードに含まれるタグはスキップ
                if (excludedTags.includes(tag)) return
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
            })
        })
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
    }, [allWorks])

    // サークル一覧（作品数順）
    const circles: CircleCount[] = useMemo(() => {
        const circleCounts = new Map<string, number>()
        allWorks.forEach((work) => {
            if (work.circle) {
                circleCounts.set(work.circle, (circleCounts.get(work.circle) || 0) + 1)
            }
        })
        return Array.from(circleCounts.entries())
            .map(([circle, count]) => ({ circle, count }))
            .sort((a, b) => b.count - a.count)
    }, [allWorks])

    // 作品形式一覧（作品数順）
    const workTypes = useMemo(() => {
        const typeCounts = new Map<string, number>()
        allWorks.forEach((work) => {
            const type = work.workType || 'その他'
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
        })
        return Array.from(typeCounts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
    }, [allWorks])

    // フィルタリングされた作品リスト
    const filteredWorks = useMemo(() => {
        let works = allWorks

        // 非表示作品を除外
        works = works.filter((work) => !work.isHidden)

        // キーワード検索
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            works = works.filter(
                (work) =>
                    work.title.toLowerCase().includes(query) ||
                    work.circle.toLowerCase().includes(query) ||
                    work.rjCode.toLowerCase().includes(query) ||
                    work.authors.some((a) => a.toLowerCase().includes(query))
            )
        }

        // タグフィルター（AND条件）
        if (selectedTags.length > 0) {
            works = works.filter((work) =>
                selectedTags.every((tag) => work.tags.includes(tag))
            )
        }

        // サークルフィルター
        if (selectedCircle) {
            works = works.filter((work) => work.circle === selectedCircle)
        }

        // 作品形式フィルター
        if (selectedWorkType) {
            works = works.filter((work) => (work.workType || 'その他') === selectedWorkType)
        }

        // ソート
        works = [...works].sort((a, b) => {
            switch (sortOption) {
                case 'title':
                    return a.title.localeCompare(b.title, 'ja')
                case 'releaseDate':
                    // 発売日が新しい順
                    const dateA = a.releaseDate || ''
                    const dateB = b.releaseDate || ''
                    return dateB.localeCompare(dateA)
                case 'addedDate':
                    // 追加日が新しい順
                    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
                case 'lastRead':
                    // 最後に読んだ日が新しい順
                    const lastA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0
                    const lastB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0
                    return lastB - lastA
                case 'circle':
                    return a.circle.localeCompare(b.circle, 'ja')
                default:
                    return 0
            }
        })

        return works
    }, [allWorks, searchQuery, selectedTags, selectedCircle, selectedWorkType, sortOption])

    // タグ選択/解除
    const handleTagToggle = useCallback((tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        )
    }, [])

    // フィルターをクリア
    const handleClearFilters = useCallback(() => {
        setSearchQuery('')
        setSelectedTags([])
        setSelectedCircle('')
        setSelectedWorkType('')
    }, [])

    // 作品クリック時
    const handleWorkClick = useCallback((work: WorkInfo) => {
        setSelectedWork(work)
    }, [])

    // 作品の右クリック時
    const handleWorkContextMenu = useCallback((work: WorkInfo) => {
        setSelectedWork(work)
    }, [])

    // ビューアを開く
    const handleOpenViewer = useCallback((work: WorkInfo) => {
        setSelectedWork(null)
        setViewerWork(work)
    }, [])

    // 詳細モーダルからタグをクリック
    const handleDetailTagClick = useCallback((tag: string) => {
        setSelectedWork(null)
        setSelectedTags([tag])
    }, [])

    // 詳細モーダルからサークルをクリック
    const handleDetailCircleClick = useCallback((circle: string) => {
        setSelectedWork(null)
        setSelectedCircle(circle)
        // 他のフィルターはリセット
        setSearchQuery('')
        setSelectedTags([])
        setSelectedWorkType('')
    }, [])

    // 詳細モーダルから作者をクリック
    const handleDetailAuthorClick = useCallback((author: string) => {
        setSelectedWork(null)
        setSearchQuery(author)
        // 他のフィルターはリセット
        setSelectedTags([])
        setSelectedCircle('')
        setSelectedWorkType('')
    }, [])

    // 詳細モーダルから形式をクリック
    const handleDetailWorkTypeClick = useCallback((type: string) => {
        setSelectedWork(null)
        setSelectedWorkType(type)
        // 他のフィルターはリセット
        setSearchQuery('')
        setSelectedTags([])
        setSelectedCircle('')
    }, [])

    // ヘッダーからのライブラリ更新（簡易スキャン）
    const handleHeaderScan = async () => {
        try {
            const settings = await window.electronAPI.getSettings()
            if (settings.libraryPaths.length === 0) {
                setCurrentView('settings')
                return
            }

            setIsHeaderScanning(true)

            // 全パスを順次スキャン
            for (const p of settings.libraryPaths) {
                const scanPath = typeof p === 'string' ? p : p.path
                const onlyDLsite = typeof p === 'string' ? false : p.onlyDLsite
                await window.electronAPI.scanLibrary(scanPath, onlyDLsite)
            }

            await loadLibraryData()
        } catch (error) {
            console.error('Quick scan failed:', error)
        } finally {
            setIsHeaderScanning(false)
        }
    }

    // ローディング中
    if (isLoading && !libraryData) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-medium">Haco 起動中...</p>
                </div>
            </div>
        )
    }

    // データがまだない場合のウェルカム画面
    if (!isLoading && (!libraryData || allWorks.length === 0) && currentView !== 'settings') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
                {/* 背景グラデーションエフェクト */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.15),transparent_70%)]" />
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full" />

                <div className="relative z-10 text-center space-y-8 px-4 max-w-lg">
                    <div className="w-24 h-24 mx-auto rounded-[2rem] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.3)] animate-in zoom-in duration-700">
                        <span className="text-4xl font-bold text-white tracking-tighter">H</span>
                    </div>

                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                        <h1 className="text-5xl font-bold text-white tracking-tight font-outfit">Hacoへようこそ</h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            ライブラリを始めるには、設定から作品フォルダを登録してください。
                        </p>
                    </div>

                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                        <Button
                            onClick={() => setCurrentView('settings')}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-[0_10px_25px_rgba(139,92,246,0.25)] px-10 py-6 text-lg rounded-2xl transition-all hover:scale-105 active:scale-95"
                        >
                            設定を開く
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // 設定画面
    if (currentView === 'settings') {
        return (
            <SettingsPage
                onBack={() => setCurrentView('library')}
                onScanComplete={() => loadLibraryData(true)}
            />
        )
    }

    // ライブラリ画面（メイン）
    return (
        <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
            {/* フィルターモーダル */}
            <FilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                tags={tags}
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
                circles={circles}
                selectedCircle={selectedCircle}
                onCircleChange={setSelectedCircle}
                workTypes={workTypes}
                selectedWorkType={selectedWorkType}
                onWorkTypeChange={setSelectedWorkType}
                onClearFilters={handleClearFilters}
            />

            {/* ヘッダーバー */}
            <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/30 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    {(selectedTags.length > 0 || selectedCircle || searchQuery) ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase tracking-widest font-black">Filtered</span>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3">
                                    {filteredWorks.length} works
                                </Badge>
                                <button
                                    onClick={handleClearFilters}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                                    title="フィルターを全解除"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <Badge variant="outline" className="border-white/10 text-slate-400">
                            {allWorks.length} items
                        </Badge>
                    )}
                </div>

                {/* ヘッダー右側のアクション */}
                <div className="flex items-center gap-3">
                    {/* ソートセレクタ */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">並び替え:</span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                            className="bg-slate-800/50 border border-white/10 rounded-md px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-purple-500/50 cursor-pointer"
                        >
                            <option value="addedDate">追加日（新しい順）</option>
                            <option value="lastRead">最近読んだ順</option>
                            <option value="releaseDate">発売日順</option>
                            <option value="title">タイトル順</option>
                            <option value="circle">サークル順</option>
                        </select>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    {/* フィルターボタン */}
                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`relative p-2 rounded-lg flex items-center justify-center transition-all ${isFilterModalOpen || selectedTags.length > 0 || searchQuery || selectedCircle ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                        title="フィルター"
                    >
                        <FilterIcon className="w-5 h-5" />
                        {(selectedTags.length > 0 || searchQuery || selectedCircle) && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                        )}
                    </button>

                    {/* 更新ボタン */}
                    <button
                        onClick={handleHeaderScan}
                        disabled={isHeaderScanning}
                        className={`p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all ${isHeaderScanning ? 'opacity-50' : ''}`}
                        title="ライブラリを更新"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isHeaderScanning ? 'animate-spin' : ''}`} />
                    </button>

                    {/* 設定ボタン */}
                    <button
                        onClick={() => setCurrentView('settings')}
                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all"
                        title="設定"
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-1 flex flex-col overflow-hidden">

                {/* コンテンツエリア */}
                <div className="flex-1 overflow-y-auto">
                    {/* 最近読んだ作品（フィルター未適用時のみ表示） */}
                    {recentlyReadWorks.length > 0 && !searchQuery && selectedTags.length === 0 && !selectedCircle && !selectedWorkType && (
                        <section className="p-6 border-b border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                                続きから読む
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {recentlyReadWorks.map((work) => (
                                    <div
                                        key={work.rjCode}
                                        className="flex-shrink-0 w-36 group cursor-pointer"
                                        onClick={() => handleWorkClick(work)}
                                        onContextMenu={(e) => {
                                            e.preventDefault()
                                            handleWorkContextMenu(work)
                                        }}
                                    >
                                        <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-slate-800 mb-2 ring-2 ring-purple-500/30 group-hover:ring-purple-500/60 transition-all">
                                            {work.thumbnailUrl ? (
                                                <img
                                                    src={work.thumbnailUrl}
                                                    alt={work.title}
                                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white/20">
                                                    {work.title.charAt(0)}
                                                </div>
                                            )}
                                            {/* 読むボタン (ホバー時に表示) */}
                                            <div
                                                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center"
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenViewer(work);
                                                    }}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2"
                                                >
                                                    <PlayIcon className="w-4 h-4" />
                                                    読む
                                                </button>
                                            </div>

                                            {/* 進捗バー */}
                                            {work.totalPages && work.lastReadPage !== undefined && (
                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                    <div
                                                        className="h-full bg-purple-500"
                                                        style={{ width: `${((work.lastReadPage + 1) / work.totalPages) * 100}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">
                                            {work.title}
                                        </p>
                                        {work.totalPages && work.lastReadPage !== undefined && (
                                            <p className="text-xs text-slate-500">
                                                {work.lastReadPage + 1} / {work.totalPages} ページ
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 作品グリッド */}
                    <WorkGrid
                        works={filteredWorks}
                        onWorkClick={handleWorkClick}
                        onWorkContextMenu={handleWorkContextMenu}
                        onPlay={handleOpenViewer}
                        isLoading={isLoading}
                    />
                </div>
            </main>

            {/* 作品詳細モーダル */}
            <WorkDetailModal
                work={selectedWork}
                onClose={() => setSelectedWork(null)}
                onTagClick={handleDetailTagClick}
                onCircleClick={handleDetailCircleClick}
                onAuthorClick={handleDetailAuthorClick}
                onWorkTypeClick={handleDetailWorkTypeClick}
                onPlay={handleOpenViewer}
                onRefresh={loadLibraryData}
            />

            {/* ビューアモーダル */}
            {viewerWork && (
                <ViewerModal
                    isOpen={true}
                    onClose={() => setViewerWork(null)}
                    workPath={viewerWork.localPath}
                    title={viewerWork.title}
                    rjCode={viewerWork.rjCode}
                    initialPage={viewerWork.lastReadPage || 0}
                    thumbnailUrl={viewerWork.thumbnailUrl}
                    bindingDirection={viewerWork.bindingDirection}
                />
            )}

            {/* スキャンステータス (グローバル) */}
            <ScanStatus />
        </div>
    )
}

export default App
