import { useState } from 'react'
import type { WorkInfo } from '@/vite-env.d'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { XIcon, BookOpenIcon, FolderIcon, TrashIcon, EyeOffIcon, EyeIcon } from '@/components/ui/icons'

interface WorkDetailModalProps {
    work: WorkInfo | null
    onClose: () => void
    onTagClick?: (tag: string) => void
    onPlay?: (work: WorkInfo) => void
    onRefresh?: () => void
}

export function WorkDetailModal({ work, onClose, onTagClick, onPlay, onRefresh }: WorkDetailModalProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    if (!work) return null

    const handlePlayClick = () => {
        if (onPlay) {
            onPlay(work)
        }
    }

    const handleOpenFolder = () => {
        // 将来的には electronAPI.openFolder(work.localPath) などを実装
        console.log('Open folder:', work.localPath)
    }

    const handleToggleVisibility = async () => {
        const success = await window.electronAPI.toggleWorkVisibility(work.rjCode)
        if (success) {
            onRefresh?.()
            onClose()
        }
    }

    const handleDelete = async (withFiles: boolean) => {
        setIsDeleting(true)
        try {
            if (withFiles) {
                const result = await window.electronAPI.deleteWorkWithFiles(work.rjCode)
                if (result.success) {
                    onRefresh?.()
                    onClose()
                } else {
                    alert(`削除に失敗しました: ${result.error}`)
                }
            } else {
                const success = await window.electronAPI.removeWork(work.rjCode)
                if (success) {
                    onRefresh?.()
                    onClose()
                }
            }
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* モーダル本体 */}
            <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                    <XIcon className="w-5 h-5 text-white" />
                </button>

                {/* 削除確認ダイアログ */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md mx-4">
                            <h3 className="text-lg font-bold text-white mb-4">削除の確認</h3>
                            <p className="text-slate-300 mb-6">
                                「{work.title}」を削除しますか？
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleDelete(true)}
                                    disabled={isDeleting}
                                >
                                    <TrashIcon className="w-4 h-4 mr-2" />
                                    ファイルも削除
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full border-white/20 text-slate-300 hover:bg-white/5"
                                    onClick={() => handleDelete(false)}
                                    disabled={isDeleting}
                                >
                                    ライブラリからのみ削除
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full text-slate-400 hover:text-white"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* コンテンツ */}
                <div className="flex flex-col md:flex-row overflow-hidden">
                    {/* 左：サムネイル */}
                    <div className="md:w-1/3 flex-shrink-0">
                        <div className="aspect-[3/4] relative bg-slate-800">
                            {work.thumbnailUrl ? (
                                <img
                                    src={work.thumbnailUrl}
                                    alt={work.title}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-slate-900">
                                    <span className="text-6xl font-bold text-white/20">
                                        {work.title.charAt(0)}
                                    </span>
                                </div>
                            )}

                            {/* グラデーションオーバーレイ */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent md:bg-gradient-to-r" />

                            {/* 非表示バッジ */}
                            {work.isHidden && (
                                <div className="absolute top-2 left-2 px-2 py-1 bg-slate-800/80 rounded text-xs text-slate-400 flex items-center gap-1">
                                    <EyeOffIcon className="w-3 h-3" />
                                    非表示
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右：詳細情報 */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {/* RJコード */}
                        <Badge variant="secondary" className="mb-3 bg-purple-600/20 text-purple-300 border-purple-500/30">
                            {work.rjCode}
                        </Badge>

                        {/* タイトル */}
                        <h2 className="text-2xl font-bold text-white mb-2">{work.title}</h2>

                        {/* サークル・作者 */}
                        <div className="space-y-1 mb-4">
                            {work.circle && (
                                <p className="text-slate-400">
                                    <span className="text-slate-500">サークル: </span>
                                    {work.circle}
                                </p>
                            )}
                            {work.authors.length > 0 && (
                                <p className="text-slate-400">
                                    <span className="text-slate-500">作者: </span>
                                    {work.authors.join(', ')}
                                </p>
                            )}
                            {work.releaseDate && (
                                <p className="text-slate-400">
                                    <span className="text-slate-500">発売日: </span>
                                    {work.releaseDate}
                                </p>
                            )}
                            {work.workType && (
                                <p className="text-slate-400">
                                    <span className="text-slate-500">形式: </span>
                                    {work.workType}
                                </p>
                            )}
                        </div>

                        {/* タグ一覧 */}
                        <div className="mb-4">
                            <p className="text-xs text-slate-500 mb-2">タグ</p>
                            <div className="flex flex-wrap gap-1.5">
                                {work.tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="outline"
                                        onClick={() => onTagClick?.(tag)}
                                        className="text-xs bg-white/5 border-white/10 text-slate-300 hover:bg-purple-600 hover:border-purple-600 hover:text-white transition-colors cursor-pointer"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* あらすじ */}
                        {work.description && (
                            <div className="mb-4">
                                <p className="text-xs text-slate-500 mb-2">あらすじ</p>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {work.description}
                                </p>
                            </div>
                        )}

                        {/* サンプル画像ギャラリー */}
                        {work.sampleImages && work.sampleImages.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs text-slate-500 mb-2">サンプル画像</p>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                    {work.sampleImages.map((imageUrl, index) => (
                                        <a
                                            key={index}
                                            href={imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 group"
                                        >
                                            <div className="w-24 h-32 relative rounded-lg overflow-hidden bg-slate-800 ring-1 ring-white/10 group-hover:ring-purple-500/50 transition-all">
                                                <img
                                                    src={imageUrl}
                                                    alt={`サンプル ${index + 1}`}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <span className="text-white/0 group-hover:text-white/80 text-xs font-medium transition-colors">
                                                        拡大
                                                    </span>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* アクションボタン */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25"
                                onClick={handlePlayClick}
                            >
                                <BookOpenIcon className="w-5 h-5 mr-2" />
                                読む
                            </Button>
                            <Button
                                variant="outline"
                                className="bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                                onClick={handleOpenFolder}
                            >
                                <FolderIcon className="w-4 h-4 mr-2" />
                                フォルダを開く
                            </Button>
                        </div>

                        {/* 管理ボタン */}
                        <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-500 hover:text-white hover:bg-white/5"
                                onClick={handleToggleVisibility}
                            >
                                {work.isHidden ? (
                                    <>
                                        <EyeIcon className="w-4 h-4 mr-1" />
                                        表示する
                                    </>
                                ) : (
                                    <>
                                        <EyeOffIcon className="w-4 h-4 mr-1" />
                                        非表示にする
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <TrashIcon className="w-4 h-4 mr-1" />
                                削除
                            </Button>
                        </div>

                        {/* ローカルパス */}
                        <p className="mt-4 text-xs text-slate-600 truncate">
                            {work.localPath}
                        </p>
                    </div>
                </div>
            </div>
        </div >
    )
}
