import type { WorkInfo } from '@/vite-env.d'
import { WorkCard } from './WorkCard'

interface WorkGridProps {
    works: WorkInfo[]
    onWorkClick?: (work: WorkInfo) => void
    isLoading?: boolean
}

export function WorkGrid({ works, onWorkClick, isLoading = false }: WorkGridProps) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400">読み込み中...</p>
                </div>
            </div>
        )
    }

    if (works.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-800/50 flex items-center justify-center">
                        <svg
                            className="w-12 h-12 text-slate-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium text-slate-300">作品が見つかりません</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                            フィルター条件に一致する作品がありません。<br />
                            条件を変更するか、設定からライブラリをスキャンしてください。
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                {works.map((work) => (
                    <WorkCard key={work.rjCode} work={work} onClick={onWorkClick} />
                ))}
            </div>
        </div>
    )
}
