import { useState, useEffect, useMemo, useCallback } from 'react'
import type { WorkInfo, LibraryData, TagCount, CircleCount } from './vite-env.d'
import { Sidebar } from './components/Sidebar'
import { WorkGrid } from './components/WorkGrid'
import { SettingsPage } from './components/SettingsPage'
import { WorkDetailModal } from './components/WorkDetailModal'
import { ViewerModal } from './components/ViewerModal'
import { ScanStatus } from './components/ScanStatus'
import { SettingsIcon, RefreshIcon } from './components/ui/icons'
import { Button } from '@/components/ui/button'

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

    // タグ一覧（使用頻度順）
    const tags: TagCount[] = useMemo(() => {
        const tagCounts = new Map<string, number>()
        allWorks.forEach((work) => {
            work.tags.forEach((tag) => {
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

    // データがまだない場合のウェルカム画面
    if (!isLoading && allWorks.length === 0 && currentView !== 'settings') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                {/* 背景エフェクト */}
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 text-center space-y-6 px-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                        <span className="text-3xl font-bold text-white">H</span>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold text-white">Hacoへようこそ</h1>
                        <p className="text-slate-400 max-w-md">
                            ライブラリを始めるには、設定から作品フォルダを登録してください。
                        </p>
                    </div>

                    <button
                        onClick={() => setCurrentView('settings')}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105"
                    >
                        設定を開く
                    </button>
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
        <div className="h-screen flex bg-slate-950 overflow-hidden">
            {/* サイドバー */}
            <Sidebar
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
                // サイドバーの更新ボタンは表示のみの更新にする
                onRefresh={loadLibraryData}
                onOpenSettings={() => setCurrentView('settings')}
                totalWorks={allWorks.length}
                filteredWorks={filteredWorks.length}
                isLoading={isLoading}
            />

            {/* メインコンテンツ */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* ヘッダーバー */}
                <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-white">ライブラリ</h2>
                        {selectedTags.length > 0 || selectedCircle ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span>フィルター適用中</span>
                                <span className="text-purple-400">({filteredWorks.length}件)</span>
                            </div>
                        ) : null}
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleHeaderScan}
                            disabled={isHeaderScanning}
                            className="text-slate-400 hover:text-white hover:bg-white/5"
                            title="ライブラリを更新（新規フォルダをスキャン）"
                        >
                            <RefreshIcon className={`w-4 h-4 mr-2 ${isHeaderScanning ? 'animate-spin' : ''}`} />
                            {isHeaderScanning ? '更新中...' : '更新'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentView('settings')}
                            className="text-slate-400 hover:text-white hover:bg-white/5"
                        >
                            <SettingsIcon className="w-5 h-5" />
                        </Button>
                    </div>
                </header>

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
                />
            )}

            {/* スキャンステータス (グローバル) */}
            <ScanStatus />
        </div>
    )
}

export default App
