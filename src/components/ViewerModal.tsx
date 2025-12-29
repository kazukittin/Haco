import { useState, useEffect, useRef, useCallback } from 'react'
import type { ViewerData } from '@/vite-env.d'
import { Button } from '@/components/ui/button'
import {
    XIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    BookOpenIcon,
    SinglePageIcon,
} from '@/components/ui/icons'

interface ViewerModalProps {
    isOpen: boolean
    onClose: () => void
    workPath: string
    title: string
    rjCode: string
    initialPage?: number
}

export function ViewerModal({ isOpen, onClose, workPath, title, rjCode, initialPage = 0 }: ViewerModalProps) {
    const [viewerData, setViewerData] = useState<ViewerData | null>(null)
    const [currentPage, setCurrentPage] = useState(initialPage)
    const [initialLoading, setInitialLoading] = useState(true)
    const [imageLoading, setImageLoading] = useState(false)
    const [imageUrls, setImageUrls] = useState<Record<number, string>>({})
    const [isSpreadMode, setIsSpreadMode] = useState(false)
    const [overlayVisible, setOverlayVisible] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // オートハイド用のタイマー
    const overlayTimerRef = useRef<NodeJS.Timeout | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 進捗保存用のデバウンスタイマー
    const progressSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 進捗を保存する関数（デバウンス付き）
    const saveProgress = useCallback((page: number, total: number) => {
        if (progressSaveTimerRef.current) {
            clearTimeout(progressSaveTimerRef.current)
        }
        progressSaveTimerRef.current = setTimeout(() => {
            window.electronAPI.updateReadingProgress(rjCode, page, total)
        }, 1000) // 1秒のデバウンス
    }, [rjCode])

    // ビューアデータを読み込む
    useEffect(() => {
        if (isOpen && workPath) {
            setInitialLoading(true)
            setError(null)

            window.electronAPI.getViewerData(workPath)
                .then(data => {
                    if (data && data.totalImages > 0) {
                        setViewerData(data)
                        // 初期ページを設定（前回の続きから）
                        const startPage = Math.min(initialPage, data.totalImages - 1)
                        setCurrentPage(startPage)
                        setImageUrls({})
                    } else {
                        setError('画像が見つかりませんでした')
                    }
                    setInitialLoading(false)
                })
                .catch(err => {
                    console.error("Failed to load viewer data", err)
                    setError('ビューアの初期化に失敗しました')
                    setInitialLoading(false)
                })
        }

        return () => {
            // クリーンアップ
            if (!isOpen) {
                setViewerData(null)
                setImageUrls({})
                setCurrentPage(0)
            }
        }
    }, [isOpen, workPath])

    // 画像を読み込む（現在ページ周辺をプリロード）
    useEffect(() => {
        if (!viewerData || viewerData.totalImages === 0) return

        const loadImages = async () => {
            const pagesToLoad = new Set<number>()

            // 現在のページ
            pagesToLoad.add(currentPage)

            // 見開きモードなら次のページも
            if (isSpreadMode && currentPage + 1 < viewerData.totalImages) {
                pagesToLoad.add(currentPage + 1)
            }

            // 前後5ページをプリロード（高速読み込みのため）
            for (let i = 1; i <= 5; i++) {
                if (currentPage - i >= 0) pagesToLoad.add(currentPage - i)
                if (currentPage + i < viewerData.totalImages) pagesToLoad.add(currentPage + i)
            }

            // 現在のページがまだ読み込まれていない場合はローディング表示
            if (!imageUrls[currentPage]) {
                setImageLoading(true)
            }

            // 未読み込みの画像のみ取得
            const newUrls: Record<number, string> = {}
            let hasNew = false

            await Promise.all(Array.from(pagesToLoad).map(async (pageIndex) => {
                if (!imageUrls[pageIndex]) {
                    const imageInfo = viewerData.images[pageIndex]
                    if (imageInfo) {
                        try {
                            const data = await window.electronAPI.getImageData(
                                imageInfo.sourceType,
                                imageInfo.source,
                                viewerData.archivePath
                            )
                            if (data) {
                                newUrls[pageIndex] = data
                                hasNew = true
                            }
                        } catch (err) {
                            console.error(`Failed to load image ${pageIndex}`, err)
                        }
                    }
                }
            }))

            if (hasNew) {
                setImageUrls(prev => ({ ...prev, ...newUrls }))
            }
            setImageLoading(false)
        }

        loadImages()
    }, [viewerData, currentPage, isSpreadMode]) // imageUrlsを依存から除外（無限ループ防止）

    // マウス移動でオーバーレイ表示
    const handleMouseMove = useCallback(() => {
        setOverlayVisible(true)

        if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current)
        }

        overlayTimerRef.current = setTimeout(() => {
            setOverlayVisible(false)
        }, 3000)
    }, [])

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (overlayTimerRef.current) {
                clearTimeout(overlayTimerRef.current)
            }
        }
    }, [])

    // ページ移動
    const goToPage = useCallback((page: number) => {
        if (!viewerData) return
        const newPage = Math.max(0, Math.min(page, viewerData.totalImages - 1))
        setCurrentPage(newPage)
        saveProgress(newPage, viewerData.totalImages)
    }, [viewerData, saveProgress])

    const nextPage = useCallback(() => {
        if (!viewerData) return
        const increment = isSpreadMode ? 2 : 1
        const newPage = Math.min(currentPage + increment, viewerData.totalImages - 1)
        setCurrentPage(newPage)
        saveProgress(newPage, viewerData.totalImages)
    }, [currentPage, isSpreadMode, viewerData, saveProgress])

    const prevPage = useCallback(() => {
        if (!viewerData) return
        const increment = isSpreadMode ? 2 : 1
        const newPage = Math.max(currentPage - increment, 0)
        setCurrentPage(newPage)
        saveProgress(newPage, viewerData.totalImages)
    }, [currentPage, isSpreadMode, viewerData, saveProgress])

    // 画面クリックでページ送り（左右エリア判定）
    const handleImageAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const width = rect.width

        // 中央20%はオーバーレイ切り替え
        const centerStart = width * 0.4
        const centerEnd = width * 0.6

        if (clickX < centerStart) {
            // 左エリア → 前のページ
            prevPage()
        } else if (clickX > centerEnd) {
            // 右エリア → 次のページ
            nextPage()
        } else {
            // 中央エリア → オーバーレイ切り替え
            setOverlayVisible(prev => !prev)
        }
    }, [prevPage, nextPage])

    // キーボード操作
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            switch (e.key) {
                case 'ArrowRight':
                case ' ': // Space
                    e.preventDefault()
                    nextPage()
                    break
                case 'ArrowLeft':
                case 'Backspace':
                    e.preventDefault()
                    prevPage()
                    break
                case 'Escape':
                    onClose()
                    break
                case 'f':
                case 'F':
                    setIsSpreadMode(prev => !prev)
                    break
                case 'Home':
                    goToPage(0)
                    break
                case 'End':
                    if (viewerData) goToPage(viewerData.totalImages - 1)
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, nextPage, prevPage, onClose, goToPage, viewerData])

    // ホイール操作
    const handleWheel = useCallback((e: React.WheelEvent) => {
        // スクロール量に応じてページ送り
        if (Math.abs(e.deltaY) > 30) {
            if (e.deltaY > 0) {
                nextPage()
            } else {
                prevPage()
            }
        }
    }, [nextPage, prevPage])

    if (!isOpen) return null

    // ページ情報
    const currentImageInfo = viewerData?.images[currentPage]

    return (
        <div
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            onMouseMove={handleMouseMove}
        >
            {/* 画像表示エリア */}
            <div
                ref={containerRef}
                className="flex-1 w-full h-full flex items-center justify-center relative select-none cursor-pointer"
                onClick={handleImageAreaClick}
                onWheel={handleWheel}
            >
                {initialLoading ? (
                    // 初期ローディング
                    <div className="flex flex-col items-center gap-4 text-white">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-lg">読み込み中...</p>
                    </div>
                ) : error ? (
                    // エラー表示
                    <div className="flex flex-col items-center gap-4 text-white">
                        <div className="text-6xl">📁</div>
                        <p className="text-lg text-red-400">{error}</p>
                        <Button variant="outline" onClick={onClose}>
                            閉じる
                        </Button>
                    </div>
                ) : viewerData ? (
                    // 画像表示
                    <div className={`flex items-center justify-center gap-1 w-full h-full p-4 ${isSpreadMode ? 'flex-row-reverse' : ''}`}>
                        {/* 左ページ（見開きモード時） */}
                        {isSpreadMode && currentPage + 1 < viewerData.totalImages && (
                            <div className="flex-1 h-full flex items-center justify-end">
                                {imageUrls[currentPage + 1] ? (
                                    <img
                                        src={imageUrls[currentPage + 1]}
                                        className="max-h-full max-w-full object-contain"
                                        alt={`Page ${currentPage + 2}`}
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full">
                                        <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 現在ページ（右ページ） */}
                        <div className={`h-full flex items-center ${isSpreadMode ? 'flex-1 justify-start' : 'justify-center w-full'}`}>
                            {imageLoading && !imageUrls[currentPage] ? (
                                // 現在ページのローディング
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-white/60 text-sm">
                                        {currentImageInfo?.filename || 'Loading...'}
                                    </p>
                                </div>
                            ) : imageUrls[currentPage] ? (
                                <img
                                    src={imageUrls[currentPage]}
                                    className="max-h-full max-w-full object-contain"
                                    alt={`Page ${currentPage + 1}`}
                                    draggable={false}
                                />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-white/40">
                                    画像を読み込めませんでした
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* ナビゲーションヒント（ホバー時） */}
                {viewerData && overlayVisible && (
                    <>
                        {/* 左エリアヒント */}
                        {currentPage > 0 && (
                            <div className="absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <ChevronLeftIcon className="w-10 h-10 text-white/50" />
                            </div>
                        )}
                        {/* 右エリアヒント */}
                        {currentPage < viewerData.totalImages - 1 && (
                            <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <ChevronRightIcon className="w-10 h-10 text-white/50" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* オーバーレイUI（ヘッダー） */}
            <div
                className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                        <h2 className="text-white font-medium truncate">{title}</h2>
                        {currentImageInfo && (
                            <p className="text-white/50 text-xs truncate mt-1">
                                {currentImageInfo.filename}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSpreadMode(!isSpreadMode)}
                            className="text-white hover:bg-white/10"
                            title={isSpreadMode ? "単ページ表示 (F)" : "見開き表示 (F)"}
                        >
                            {isSpreadMode ? <SinglePageIcon className="mr-2" /> : <BookOpenIcon className="mr-2" />}
                            {isSpreadMode ? "単ページ" : "見開き"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-white hover:bg-white/10 rounded-full"
                        >
                            <XIcon />
                        </Button>
                    </div>
                </div>
            </div>

            {/* オーバーレイUI（フッター・シークバー） */}
            <div
                className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                    {/* シークバー */}
                    {viewerData && (
                        <div className="flex items-center gap-4">
                            <span className="text-white text-sm font-mono whitespace-nowrap min-w-[4rem] text-right">
                                {currentPage + 1}
                            </span>
                            <input
                                type="range"
                                min="0"
                                max={viewerData.totalImages - 1}
                                value={currentPage}
                                onChange={(e) => goToPage(parseInt(e.target.value))}
                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:bg-white/30 transition-colors"
                            />
                            <span className="text-white text-sm font-mono whitespace-nowrap min-w-[4rem]">
                                {viewerData.totalImages}
                            </span>
                        </div>
                    )}

                    {/* コントロールボタン */}
                    <div className="flex items-center justify-center gap-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={prevPage}
                            disabled={!viewerData || currentPage === 0}
                            className="text-white hover:bg-white/10 rounded-full w-12 h-12 disabled:opacity-30"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </Button>

                        <div className="text-white/60 text-sm px-4 py-1 bg-white/5 rounded-full">
                            {isSpreadMode ? "見開き" : "単ページ"} • ← → で移動 • F で切替
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={nextPage}
                            disabled={!viewerData || currentPage >= viewerData.totalImages - 1}
                            className="text-white hover:bg-white/10 rounded-full w-12 h-12 disabled:opacity-30"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
