import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { XIcon, FolderIcon, RefreshIcon } from '@/components/ui/icons'
import type { AppSettings, ScanProgress, ScanResult } from '@/vite-env.d'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    onScanComplete: () => void
}

export function SettingsModal({ isOpen, onClose, onScanComplete }: SettingsModalProps) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
    const [scanResult, setScanResult] = useState<ScanResult | null>(null)
    const [newPath, setNewPath] = useState('')

    // 設定を読み込む
    useEffect(() => {
        if (isOpen) {
            window.electronAPI.getSettings().then(setSettings)
        }
    }, [isOpen])

    // スキャン進行状況のリスナー
    useEffect(() => {
        if (isScanning) {
            const cleanup = window.electronAPI.onScanProgress((data) => {
                setScanProgress(data)
            })
            return cleanup
        }
    }, [isScanning])

    // フォルダ選択
    const handleSelectFolder = async () => {
        const path = await window.electronAPI.selectFolder()
        if (path) {
            setNewPath(path)
        }
    }

    // スキャン開始
    const handleStartScan = async () => {
        if (!newPath) return

        setIsScanning(true)
        setScanProgress(null)
        setScanResult(null)

        try {
            const result = await window.electronAPI.scanLibrary(newPath)
            setScanResult(result)

            // 設定にパスを追加
            if (settings && !settings.libraryPaths.includes(newPath)) {
                const updatedSettings = {
                    ...settings,
                    libraryPaths: [...settings.libraryPaths, newPath],
                }
                await window.electronAPI.saveSettings(updatedSettings)
                setSettings(updatedSettings)
            }

            onScanComplete()
        } catch (error) {
            console.error('Scan error:', error)
        } finally {
            setIsScanning(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* オーバーレイ */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* モーダル本体 */}
            <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">設定</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <XIcon className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-4 space-y-6">
                    {/* ライブラリパス */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-slate-300">ライブラリフォルダ</h3>

                        {/* 登録済みパス */}
                        {settings?.libraryPaths && settings.libraryPaths.length > 0 && (
                            <div className="space-y-2">
                                {settings.libraryPaths.map((path) => (
                                    <div
                                        key={path}
                                        className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-white/5"
                                    >
                                        <FolderIcon className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm text-slate-300 truncate flex-1">{path}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 新しいパス選択 */}
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <div className="flex-1 p-2 bg-slate-800/50 rounded-lg border border-white/5">
                                    <span className="text-sm text-slate-400">
                                        {newPath || 'フォルダを選択してください...'}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectFolder}
                                    className="bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                                >
                                    <FolderIcon className="w-4 h-4 mr-2" />
                                    選択
                                </Button>
                            </div>

                            {/* スキャンボタン */}
                            <Button
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={handleStartScan}
                                disabled={!newPath || isScanning}
                            >
                                <RefreshIcon className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                                {isScanning ? 'スキャン中...' : 'スキャン開始'}
                            </Button>
                        </div>
                    </div>

                    {/* スキャン進行状況 */}
                    {isScanning && scanProgress && (
                        <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">進行状況</span>
                                <span className="text-white">
                                    {scanProgress.current} / {scanProgress.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
                                    style={{
                                        width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                                    }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                                {scanProgress.rjCode}: {scanProgress.status}
                            </p>
                        </div>
                    )}

                    {/* スキャン結果 */}
                    {scanResult && (
                        <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                            <h4 className="text-sm font-medium text-slate-300">スキャン完了</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-slate-700/50 rounded-lg">
                                    <p className="text-lg font-bold text-white">{scanResult.totalFolders}</p>
                                    <p className="text-xs text-slate-400">検出</p>
                                </div>
                                <div className="p-2 bg-green-900/30 rounded-lg">
                                    <p className="text-lg font-bold text-green-400">{scanResult.success}</p>
                                    <p className="text-xs text-slate-400">成功</p>
                                </div>
                                <div className="p-2 bg-red-900/30 rounded-lg">
                                    <p className="text-lg font-bold text-red-400">{scanResult.failed}</p>
                                    <p className="text-xs text-slate-400">失敗</p>
                                </div>
                            </div>
                            {scanResult.newWorks.length > 0 && (
                                <p className="text-xs text-purple-400">
                                    ✨ {scanResult.newWorks.length} 件の新規作品を追加しました
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-white/10">
                    <Button
                        variant="outline"
                        className="w-full bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={onClose}
                    >
                        閉じる
                    </Button>
                </div>
            </div>
        </div>
    )
}
