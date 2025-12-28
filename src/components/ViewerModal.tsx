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
}

export function ViewerModal({ isOpen, onClose, workPath, title }: ViewerModalProps) {
    const [viewerData, setViewerData] = useState<ViewerData | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [imageUrls, setImageUrls] = useState<Record<number, string>>({})
    const [isSpreadMode, setIsSpreadMode] = useState(false)
    const [overlayVisible, setOverlayVisible] = useState(true)

    // オートハイド用のタイマー
    const overlayTimerRef = useRef<NodeJS.Timeout | null>(null)

    // ビューアデータを読み込む
    useEffect(() => {
        if (isOpen && workPath) {
            setLoading(true)
            window.electronAPI.getViewerData(workPath)
                .then(data => {
                    setViewerData(data)
                    setCurrentPage(0)
                    setImageUrls({})
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Failed to load viewer data", err)
                    setLoading(false)
                })
        }

        return () => {
            // クリーンアップ
            setViewerData(null)
            setImageUrls({})
        }
    }, [isOpen, workPath])

    // 画像を読み込む（現在ページ周辺をプリロード）
    useEffect(() => {
        if (!viewerData) return

        const loadImages = async () => {
            const pagesToLoad = new Set<number>()

            // 現在のページ
            pagesToLoad.add(currentPage)

            // 見開きモードなら次のページも
            if (isSpreadMode && currentPage + 1 < viewerData.totalImages) {
                pagesToLoad.add(currentPage + 1)
            }

            // 前後3ページをプリロード
            for (let i = 1; i <= 3; i++) {
                if (currentPage - i >= 0) pagesToLoad.add(currentPage - i)
                if (currentPage + i < viewerData.totalImages) pagesToLoad.add(currentPage + i)
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
        }

        loadImages()
    }, [viewerData, currentPage, isSpreadMode, imageUrls])

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
    }, [viewerData])

    const nextPage = useCallback(() => {
        if (!viewerData) return
        const increment = isSpreadMode ? 2 : 1
        goToPage(currentPage + increment)
    }, [currentPage, isSpreadMode, viewerData, goToPage])

    const prevPage = useCallback(() => {
        if (!viewerData) return
        const increment = isSpreadMode ? 2 : 1
        goToPage(currentPage - increment)
    }, [currentPage, isSpreadMode, viewerData, goToPage])

    // キーボード操作
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            switch (e.key) {
                case 'ArrowRight':
                case ' ': // Space
                    nextPage()
                    break
                case 'ArrowLeft':
                case 'Backspace':
                    prevPage()
                    break
                case 'Escape':
                    onClose()
                    break
                case 'f':
                    setIsSpreadMode(prev => !prev)
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, nextPage, prevPage, onClose])

    // ホイール操作
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!isOpen) return

            // 横スクロールまたは強い縦スクロールでページ移動
            if (Math.abs(e.deltaY) > 50 || Math.abs(e.deltaX) > 50) {
                if (e.deltaY > 0 || e.deltaX > 0) {
                    nextPage()
                } else {
                    prevPage()
                }
            }
        }

        // イベントリスナーをパッシブでない設定で追加する必要がある場合があるが、
        // ここではReactのイベントではなくwindowイベントを使用
        // ただし、Reactコンポーネント内でのホイールイベントの方が制御しやすいので
        // ここではコンポーネントのdivにonWheelを設定する方式をとる
    }, [isOpen, nextPage, prevPage])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            onMouseMove={handleMouseMove}
            onClick={() => setOverlayVisible(prev => !prev)}
        >
            {/* 画像表示エリア */}
            <div
                className="flex-1 w-full h-full flex items-center justify-center relative select-none"
                onWheel={(e) => {
                    // コンテンツがスクロール可能でない場合のみページ送り
                    if (e.currentTarget.scrollHeight <= e.currentTarget.clientHeight) {
                        if (e.deltaY > 0) nextPage()
                        else if (e.deltaY < 0) prevPage()
                    }
                }}
            >
                {loading ? (
                    <div className="flex flex-col items-center gap-4 text-white">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p>Loading...</p>
                    </div>
                ) : viewerData ? (
                    <div className={`flex items-center justify-center gap-0 w-full h-full p-4 ${isSpreadMode ? 'flex-row-reverse' : ''}`}>
                        {/* 左ページ（見開きモード時のみ） */}
                        {isSpreadMode && currentPage + 1 < viewerData.totalImages && (
                            <div className="flex-1 h-full flex items-center justify-end">
                                {imageUrls[currentPage + 1] ? (
                                    <img
                                        src={imageUrls[currentPage + 1]}
                                        className="max-h-full max-w-full object-contain shadow-2xl"
                                        alt={`Page ${currentPage + 2}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-900/50 text-slate-500">
                                        Loading...
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 現在ページ（右ページ） */}
                        <div className={`h-full flex items-center ${isSpreadMode ? 'flex-1 justify-start' : 'justify-center w-full'}`}>
                            {imageUrls[currentPage] ? (
                                <img
                                    src={imageUrls[currentPage]}
                                    className="max-h-full max-w-full object-contain shadow-2xl"
                                    alt={`Page ${currentPage + 1}`}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900/50 text-slate-500">
                                    Loading...
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-white">Failed to load images</p>
                )}
            </div>

            {/* オーバーレイUI（ヘッダー） */}
            <div
                className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-medium truncate max-w-2xl text-shadow">{title}</h2>
                    <div className="flex items-center gap-2">
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
                            <span className="text-white text-xs whitespace-nowrap min-w-[3rem] text-right">
                                {currentPage + 1}
                            </span>
                            <input
                                type="range"
                                min="0"
                                max={viewerData.totalImages - 1}
                                value={currentPage}
                                onChange={(e) => goToPage(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                            />
                            <span className="text-white text-xs whitespace-nowrap min-w-[3rem]">
                                {viewerData.totalImages}
                            </span>
                        </div>
                    )}

                    {/* コントロールボタン */}
                    <div className="flex items-center justify-center gap-8">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={prevPage}
                            disabled={!viewerData || currentPage === 0}
                            className="text-white hover:bg-white/10 rounded-full w-12 h-12"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </Button>

                        <div className="text-slate-400 text-xs">
                            {isSpreadMode ? "見開きモード" : "単ページモード"}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={nextPage}
                            disabled={!viewerData || currentPage >= viewerData.totalImages - 1}
                            className="text-white hover:bg-white/10 rounded-full w-12 h-12"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
