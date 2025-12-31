import { useState, useEffect, useMemo } from 'react'
import type { WorkInfo } from '@/vite-env.d'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    XIcon,
    BookOpenIcon,
    FolderIcon,
    TrashIcon,
    EyeOffIcon,
    EyeIcon,
    HeartIcon,
    PencilIcon,
    CheckIcon,
    CalendarIcon,
    UsersIcon,
    TagIcon,
    LibraryIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@/components/ui/icons'

interface WorkDetailModalProps {
    work: WorkInfo | null
    onClose: () => void
    onTagClick?: (tag: string) => void
    onCircleClick?: (circle: string) => void
    onAuthorClick?: (author: string) => void
    onWorkTypeClick?: (type: string) => void
    onPlay?: (work: WorkInfo) => void
    onRefresh?: () => void
}

export function WorkDetailModal({
    work,
    onClose,
    onTagClick,
    onCircleClick,
    onAuthorClick,
    onWorkTypeClick,
    onPlay,
    onRefresh
}: WorkDetailModalProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState<Partial<WorkInfo>>({})
    const [animateShow, setAnimateShow] = useState(false)

    // 画像ギャラリー用のステート
    const [currentImageIndex, setCurrentImageIndex] = useState(0)

    // 表示する画像リスト（サンプルのみ）
    const sampleImages = useMemo(() => {
        if (!work) return []
        return work.sampleImages || []
    }, [work])

    useEffect(() => {
        if (work) {
            setTimeout(() => setAnimateShow(true), 10)
            setCurrentImageIndex(0) // 作品が変わったらインデックスをリセット
            // 作品が変わったら編集状態もリセット
            setIsEditing(false)
            setEditData({})
            setShowDeleteConfirm(false)
        } else {
            setAnimateShow(false)
        }
    }, [work])

    if (!work) return null

    const handleToggleFavorite = async () => {
        const favorite = !work.isFavorite
        const success = await window.electronAPI.updateWorkInfo(work.rjCode, { isFavorite: favorite })
        if (success) {
            onRefresh?.()
        }
    }

    const handleChangeStatus = async (status: 'unread' | 'reading' | 'completed') => {
        const success = await window.electronAPI.updateWorkInfo(work.rjCode, { readingStatus: status })
        if (success) {
            onRefresh?.()
        }
    }

    const startEditing = () => {
        setEditData({
            rjCode: work.rjCode,
            title: work.title,
            circle: work.circle,
            authors: work.authors,
            tags: work.tags,
            description: work.description,
            bindingDirection: work.bindingDirection || 'rtl'
        })
        setIsEditing(true)
    }

    const saveEditing = async () => {
        const success = await window.electronAPI.updateWorkInfo(work.rjCode, editData)
        if (success) {
            setIsEditing(false)
            onRefresh?.()
        }
    }

    const handlePlayClick = () => {
        if (onPlay) {
            onPlay(work)
        }
    }

    const handleOpenFolder = () => {
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
                    alert(`削除に失敗しました: ${result.error} `)
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

    // ギャラリーナビゲーション
    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (sampleImages.length > 0) {
            setCurrentImageIndex((prev) => (prev + 1) % sampleImages.length)
        }
    }

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (sampleImages.length > 0) {
            setCurrentImageIndex((prev) => (prev - 1 + sampleImages.length) % sampleImages.length)
        }
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${animateShow ? 'opacity-100' : 'opacity-0'}`}>
            {/* 没入型オーバーレイ */}
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
                onClick={onClose}
            >
                {/* 背景ビジュアル（ぼかした画像など） */}
                {work.thumbnailUrl && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <img src={work.thumbnailUrl} className="w-full h-full object-cover blur-3xl scale-110" alt="" />
                    </div>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-5xl aspect-video bg-purple-600/10 blur-[150px] rounded-full opacity-50" />
            </div>

            {/* モーダル本体 */}
            <div className={`relative w-full max-w-5xl bg-slate-900 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transition-all duration-500 delay-75 ${animateShow ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}>

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="absolute top-6 left-6 z-[70] p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-white/70 hover:text-white transition-all backdrop-blur-md shadow-xl"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                {/* 削除確認ダイアログ */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
                        <div className="bg-slate-900/50 border border-red-500/20 rounded-3xl p-10 max-w-md mx-4 text-center shadow-2xl">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <TrashIcon className="w-10 h-10 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">作品の削除</h3>
                            <p className="text-slate-400 mb-8">
                                「{work.title}」を削除しますか？<br />この操作は取り消せません。
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold"
                                    onClick={() => handleDelete(true)}
                                    disabled={isDeleting}
                                >
                                    ファイルを完全に削除
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full h-12 border-white/10 text-slate-300 hover:bg-white/5 rounded-2xl"
                                    onClick={() => handleDelete(false)}
                                    disabled={isDeleting}
                                >
                                    ライブラリから消す（ファイルは残す）
                                </Button>
                                <button
                                    className="mt-2 text-slate-500 hover:text-white transition-colors text-sm font-medium"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* メインレイアウト */}
                <div className="flex flex-col md:flex-row overflow-hidden flex-1">

                    {/* 左側：ビジュアルセクション (画像スライダー) */}
                    <div className="md:w-[42%] flex-shrink-0 relative group p-6 md:p-10 select-none flex flex-col bg-black/20">
                        <div className="relative aspect-[3/4] w-full mb-6">
                            {/* 背景発光 */}
                            <div className="absolute -inset-4 bg-purple-500/10 blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

                            <div className="h-full w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 relative z-10 bg-slate-950">
                                {sampleImages.length === 0 ? (
                                    // サンプル画像がない場合はサムネイルを表示
                                    <img
                                        src={work.thumbnailUrl}
                                        alt={work.title}
                                        className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
                                    />
                                ) : (
                                    // サンプル画像がある場合はギャラリーを表示
                                    <div className="w-full h-full relative">
                                        <img
                                            key={currentImageIndex}
                                            src={sampleImages[currentImageIndex]}
                                            alt={`Sample ${currentImageIndex + 1}`}
                                            className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
                                        />

                                        {/* ギャラリーナビゲーション */}
                                        <div className="absolute inset-0 z-20 flex items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <button
                                                onClick={prevImage}
                                                className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-90 border border-white/10 shadow-xl"
                                            >
                                                <ChevronLeftIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={nextImage}
                                                className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-90 border border-white/10 shadow-xl"
                                            >
                                                <ChevronRightIcon className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* インジケーター */}
                                        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1">
                                            {sampleImages.slice(0, 15).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`h-1 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-4 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'w-1 bg-white/30'}`}
                                                />
                                            ))}
                                        </div>

                                        {/* 画像カウンター */}
                                        <div className="absolute top-4 right-4 z-20 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-bold text-white/90 border border-white/10">
                                            {currentImageIndex + 1} / {sampleImages.length}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* クイックステータスバッジ */}
                            <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
                                {work.readingStatus && (
                                    <Badge className={`px-3 py-1 text-[10px] font-black tracking-wider uppercase border-none shadow-lg ${work.readingStatus === 'completed' ? 'bg-green-500 text-white' :
                                        work.readingStatus === 'reading' ? 'bg-blue-500 text-white' : 'hidden'
                                        }`}>
                                        {work.readingStatus === 'completed' ? 'Read' : 'Reading'}
                                    </Badge>
                                )}
                                {work.isFavorite && (
                                    <div className="bg-red-500 text-white p-2 rounded-xl shadow-lg animate-bounce-subtle">
                                        <HeartIcon className="w-4 h-4" fill="currentColor" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ローカルパス - コンテンツと被らないよう配置 */}
                        <div className="mt-auto pt-4 bg-slate-950/20 p-4 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 opacity-60">Local Path</p>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 group/path cursor-pointer hover:text-white transition-colors">
                                <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate break-all select-all">{work.localPath}</span>
                            </div>
                        </div>
                    </div>

                    {/* 右側：コンテンツセクション */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-8 md:p-12 md:pl-8 bg-gradient-to-br from-white/[0.03] to-transparent relative">

                        {/* ツールバー (最上部固定ではないが最初の方) */}
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <div className="relative">
                                        <span className="absolute -top-4 left-0 text-[10px] text-purple-400 font-bold tracking-widest uppercase">ID Editor</span>
                                        <input
                                            value={editData.rjCode || ''}
                                            onChange={(e) => setEditData({ ...editData, rjCode: e.target.value.toUpperCase() })}
                                            className="bg-purple-500/10 border border-purple-500/50 rounded-xl px-3 py-2 text-sm font-bold text-purple-300 w-32 outline-none focus:ring-4 ring-purple-500/10 transition-all font-mono"
                                            placeholder="RJ000000"
                                        />
                                    </div>
                                ) : (
                                    <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 px-4 py-1.5 rounded-full font-mono text-xs tracking-wider transition-colors">
                                        {work.rjCode}
                                    </Badge>
                                )}

                                <div className="h-4 w-px bg-white/10 mx-1" />

                                <div className="relative group/sel">
                                    <select
                                        value={work.readingStatus || 'unread'}
                                        onChange={(e) => handleChangeStatus(e.target.value as any)}
                                        className="appearance-none bg-white/5 border border-white/10 rounded-full px-5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer outline-none font-bold pr-8"
                                    >
                                        <option value="unread" className="bg-slate-900">未読</option>
                                        <option value="reading" className="bg-slate-900">読書中</option>
                                        <option value="completed" className="bg-slate-900">読了</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover/sel:text-white transition-colors">
                                        <TagIcon className="w-3 h-3 opacity-50" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={isEditing ? saveEditing : startEditing}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${isEditing ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20'}`}
                                >
                                    {isEditing ? <CheckIcon className="w-6 h-6" /> : <PencilIcon className="w-6 h-6" />}
                                </button>
                                <button
                                    onClick={handleToggleFavorite}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${work.isFavorite ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20 scale-105' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-red-400 hover:border-red-400/30'}`}
                                >
                                    <HeartIcon className="w-6 h-6" fill={work.isFavorite ? "currentColor" : "none"} />
                                </button>
                            </div>
                        </div>

                        {/* メインタイトル */}
                        <div className="mb-10 group/title">
                            {isEditing ? (
                                <textarea
                                    value={editData.title || ''}
                                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-purple-500/30 rounded-2xl px-6 py-5 text-2xl font-bold text-white outline-none focus:ring-4 ring-purple-500/10 min-h-[120px] resize-none leading-normal"
                                    placeholder="作品名を入力..."
                                />
                            ) : (
                                <h2 className="text-2xl md:text-3xl font-black text-white leading-snug tracking-tight transition-all duration-300">{work.title}</h2>
                            )}
                        </div>

                        {/* スペーサーを兼ねたメタ情報 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                            <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group/card hover:bg-white/10 transition-all">
                                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover/card:opacity-10 transition-opacity rotate-12">
                                    <LibraryIcon className="w-20 h-20" />
                                </div>
                                <p className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em] mb-2">Circle</p>
                                {isEditing ? (
                                    <input
                                        value={editData.circle || ''}
                                        onChange={(e) => setEditData({ ...editData, circle: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                    />
                                ) : (
                                    <button
                                        onClick={() => work.circle && onCircleClick?.(work.circle)}
                                        className="text-xl font-bold text-slate-100 truncate hover:text-purple-400 transition-colors text-left"
                                    >
                                        {work.circle || '---'}
                                    </button>
                                )}
                            </div>

                            <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group/card hover:bg-white/10 transition-all">
                                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover/card:opacity-10 transition-opacity -rotate-12">
                                    <UsersIcon className="w-20 h-20" />
                                </div>
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-2">Author / CV</p>
                                {isEditing ? (
                                    <input
                                        value={editData.authors?.join(', ') || ''}
                                        onChange={(e) => setEditData({ ...editData, authors: e.target.value.split(',').map(s => s.trim()) })}
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                        placeholder="カンマ区切り"
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-x-2">
                                        {work.authors.length > 0 ? work.authors.map((author, i) => (
                                            <button
                                                key={i}
                                                onClick={() => onAuthorClick?.(author)}
                                                className="text-xl font-bold text-slate-100 hover:text-indigo-400 transition-colors"
                                            >
                                                {author}{i < work.authors.length - 1 ? ',' : ''}
                                            </button>
                                        )) : <p className="text-xl font-bold text-slate-100">---</p>}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group/card hover:bg-white/10 transition-all">
                                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover/card:opacity-10 transition-opacity rotate-12">
                                    <CalendarIcon className="w-20 h-20" />
                                </div>
                                <p className="text-[10px] text-orange-400 font-black uppercase tracking-[0.2em] mb-2">Released</p>
                                <p className="text-xl font-bold text-slate-100">{work.releaseDate || 'Unknown'}</p>
                            </div>

                            <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group/card hover:bg-white/10 transition-all">
                                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover/card:opacity-10 transition-opacity -rotate-12">
                                    <TagIcon className="w-20 h-20" />
                                </div>
                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-2">Category</p>
                                <button
                                    onClick={() => work.workType && onWorkTypeClick?.(work.workType)}
                                    className="text-xl font-bold text-slate-100 hover:text-blue-400 transition-colors text-left"
                                >
                                    {work.workType || 'Standard'}
                                </button>
                            </div>

                            {/* 綴じ方向設定 (編集時のみ目立つ) */}
                            {isEditing && (
                                <div className="bg-purple-900/20 rounded-2xl p-4 border border-purple-500/30 flex items-center justify-between">
                                    <p className="text-[10px] text-purple-300 font-black uppercase tracking-widest">Binding Orientation</p>
                                    <select
                                        value={editData.bindingDirection || 'rtl'}
                                        onChange={(e) => setEditData({ ...editData, bindingDirection: e.target.value as any })}
                                        className="bg-slate-900 border border-purple-500/50 rounded-lg px-3 py-1 text-xs text-white outline-none"
                                    >
                                        <option value="rtl">右開き (和風)</option>
                                        <option value="ltr">左開き (洋風)</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* タグクラウド */}
                        <div className="mb-12">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-5 border-l-2 border-purple-500 pl-3">Keywords</p>
                            {isEditing ? (
                                <textarea
                                    value={editData.tags?.join(', ') || ''}
                                    onChange={(e) => setEditData({ ...editData, tags: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white h-24 resize-none leading-relaxed focus:border-purple-500/50 outline-none transition-all"
                                    placeholder="タグをカンマ区切りで入力..."
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2.5">
                                    {work.tags.map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => onTagClick?.(tag)}
                                            className="px-5 py-2 rounded-xl text-xs font-black bg-white/5 border border-white/10 text-slate-300 hover:bg-gradient-to-br hover:from-purple-600 hover:to-indigo-600 hover:text-white hover:border-transparent hover:shadow-[0_8px_16px_rgba(139,92,246,0.3)] transition-all active:scale-95 uppercase tracking-wide"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* あらすじ/説明文 */}
                        <div className="mb-16">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-5 border-l-2 border-indigo-500 pl-3">Storyline</p>
                            {isEditing ? (
                                <textarea
                                    value={editData.description || ''}
                                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-5 text-sm text-white h-60 leading-relaxed resize-none focus:border-indigo-500/50 outline-none transition-all"
                                />
                            ) : (
                                <div className="relative group/desc">
                                    <div className="text-sm md:text-base text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar-mini pr-6 font-medium selection:bg-purple-500/40">
                                        {work.description || <p className="text-slate-600 italic">No description provided for this work.</p>}
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none group-hover/desc:opacity-0 transition-opacity duration-500" />
                                </div>
                            )}
                        </div>

                        {/* サンプル */}
                        {/* Removed sample images section as they are now integrated into the main image area */}

                        {/* アクションフッター (ここに背景とブラーを追加して被りを解消) */}
                        <div className="sticky bottom-0 -mx-8 md:-mx-12 px-8 md:px-12 py-8 mt-auto z-[40]">
                            {/* ブラー背景 */}
                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]" />

                            <div className="relative flex flex-col sm:flex-row gap-4 items-stretch">
                                <Button
                                    className="h-20 flex-[3] bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_auto] hover:bg-right transition-all duration-700 text-white rounded-[1.5rem] text-xl font-black shadow-[0_15px_30px_rgba(139,92,246,0.4)] active:scale-[0.98] flex items-center justify-center group/play"
                                    onClick={handlePlayClick}
                                >
                                    <BookOpenIcon className="w-7 h-7 mr-4 group-hover/play:scale-110 transition-transform" />
                                    今すぐ読む
                                </Button>

                                <div className="flex gap-2 flex-1">
                                    <button
                                        className="flex-1 h-20 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-[1.5rem] transition-all active:scale-95 group/btn flex items-center justify-center"
                                        onClick={handleOpenFolder}
                                        title="フォルダを開く"
                                    >
                                        <FolderIcon className="w-8 h-8 group-hover/btn:scale-110 group-hover/btn:text-white transition-all" />
                                    </button>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            className="w-14 h-[38px] flex items-center justify-center hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-all active:scale-95 group/del border border-transparent hover:border-red-500/20"
                                            onClick={() => setShowDeleteConfirm(true)}
                                            title="削除"
                                        >
                                            <TrashIcon className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                                        </button>

                                        <button
                                            className="w-14 h-[38px] flex items-center justify-center hover:bg-white/10 text-slate-500 hover:text-white rounded-xl transition-all active:scale-95 group/vis border border-transparent hover:border-white/10"
                                            onClick={handleToggleVisibility}
                                            title={work.isHidden ? "表示" : "非表示"}
                                        >
                                            {work.isHidden ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
