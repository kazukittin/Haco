import { useState } from 'react'
import type { WorkInfo } from '@/vite-env.d'
import { Badge } from '@/components/ui/badge'
import { PlayIcon } from '@/components/ui/icons'

interface WorkCardProps {
    work: WorkInfo
    onClick?: (work: WorkInfo) => void
}

export function WorkCard({ work, onClick }: WorkCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)

    const handleClick = () => {
        if (onClick) {
            onClick(work)
        }
    }

    return (
        <div
            className="group relative rounded-xl overflow-hidden bg-slate-900/50 border border-white/5 hover:border-purple-500/50 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
            onClick={handleClick}
        >
            {/* サムネイル画像 */}
            <div className="aspect-[3/4] relative overflow-hidden bg-slate-800">
                {!imageError && work.thumbnailUrl ? (
                    <>
                        {!imageLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        <img
                            src={work.thumbnailUrl}
                            alt={work.title}
                            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                                }`}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setImageError(true)}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-slate-900">
                        <span className="text-4xl font-bold text-white/20">
                            {work.title.charAt(0)}
                        </span>
                    </div>
                )}

                {/* ホバー時のオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center transform scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-lg shadow-purple-500/50">
                            <PlayIcon className="w-6 h-6 text-white ml-1" />
                        </div>
                    </div>
                </div>

                {/* RJコードバッジ */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm text-xs">
                        {work.rjCode}
                    </Badge>
                </div>
            </div>

            {/* 情報エリア */}
            <div className="p-3 space-y-2">
                {/* タイトル */}
                <h3 className="font-medium text-sm text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                    {work.title}
                </h3>

                {/* サークル名 */}
                <p className="text-xs text-slate-400 truncate">
                    {work.circle}
                </p>

                {/* タグ（最大3つ） */}
                <div className="flex flex-wrap gap-1">
                    {work.tags.slice(0, 3).map((tag) => (
                        <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 bg-white/5 border-white/10 text-slate-400"
                        >
                            {tag}
                        </Badge>
                    ))}
                    {work.tags.length > 3 && (
                        <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 bg-white/5 border-white/10 text-slate-500"
                        >
                            +{work.tags.length - 3}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    )
}
