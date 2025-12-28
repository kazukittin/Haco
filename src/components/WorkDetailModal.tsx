import type { WorkInfo } from '@/vite-env.d'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { XIcon, BookOpenIcon, FolderIcon } from '@/components/ui/icons'

interface WorkDetailModalProps {
    work: WorkInfo | null
    onClose: () => void
    onTagClick?: (tag: string) => void
    onPlay?: (work: WorkInfo) => void
}

export function WorkDetailModal({ work, onClose, onTagClick, onPlay }: WorkDetailModalProps) {
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

                {/* コンテンツ */}
                <div className="flex flex-col md:flex-row overflow-hidden">
                    {/* 左：サムネイル */}
                    <div className="md:w-1/3 flex-shrink-0">
                        <div className="aspect-[3/4] relative bg-slate-800">
                            {work.thumbnailUrl ? (
                                <img
                                    src={work.thumbnailUrl}
                                    alt={work.title}
                                    className="w-full h-full object-cover"
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
                            <p className="text-sm text-slate-300">
                                <span className="text-slate-500 mr-2">サークル:</span>
                                {work.circle}
                            </p>
                            {work.authors.length > 0 && (
                                <p className="text-sm text-slate-300">
                                    <span className="text-slate-500 mr-2">作者:</span>
                                    {work.authors.join(', ')}
                                </p>
                            )}
                            {work.releaseDate && (
                                <p className="text-sm text-slate-300">
                                    <span className="text-slate-500 mr-2">販売日:</span>
                                    {work.releaseDate}
                                </p>
                            )}
                        </div>

                        {/* タグ */}
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

                        {/* ローカルパス */}
                        <p className="mt-4 text-xs text-slate-600 truncate">
                            {work.localPath}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
