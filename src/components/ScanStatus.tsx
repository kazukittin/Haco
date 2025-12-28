import { useEffect, useState } from 'react'
import type { ScanProgress } from '@/vite-env.d'

export function ScanStatus() {
    const [progress, setProgress] = useState<ScanProgress | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // スキャン進捗を監視
        const cleanup = window.electronAPI.onScanProgress((data) => {
            setProgress(data)
            setIsVisible(true)

            // 前回のタイマーをクリア
            if (timer) clearTimeout(timer)

            // スキャン完了時（100%）またはエラー停止を検知しにくいので
            // 更新が止まって3秒後に非表示にするタイマーを毎回リセット
            const newTimer = setTimeout(() => {
                if (data.current >= data.total) {
                    setIsVisible(false)
                }
            }, 5000)

            setTimer(newTimer)
        })

        return () => {
            cleanup()
            if (timer) clearTimeout(timer)
        }
    }, [timer])

    // 完了したら少し待って消す
    useEffect(() => {
        if (progress && progress.current === progress.total) {
            const doneTimer = setTimeout(() => {
                setIsVisible(false)
                setProgress(null)
            }, 3000)
            return () => clearTimeout(doneTimer)
        }
    }, [progress])

    if (!isVisible || !progress) return null

    const percentage = Math.round((progress.current / progress.total) * 100) || 0

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* プログレスバー背景 */}
            <div className="h-1 w-full bg-slate-800">
                <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white">スキャン実行中</h4>
                        <span className="text-xs font-bold text-purple-400">{percentage}%</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                        {progress.status}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 truncate font-mono">
                        {progress.rjCode}
                    </p>
                </div>
            </div>
        </div>
    )
}
