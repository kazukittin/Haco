import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    FolderIcon,
    RefreshIcon,
    XIcon,
    SettingsIcon,
    ChevronLeftIcon
} from '@/components/ui/icons'
import type { AppSettings, ScanProgress, ScanResult } from '@/vite-env.d'

interface SettingsPageProps {
    onBack: () => void
    onScanComplete: () => void
}

export function SettingsPage({ onBack, onScanComplete }: SettingsPageProps) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
    const [scanResult, setScanResult] = useState<ScanResult | null>(null)
    const [currentScanPath, setCurrentScanPath] = useState<string>('')

    // 設定を読み込む
    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings)
    }, [])

    // スキャン進行状況のリスナー
    useEffect(() => {
        if (isScanning) {
            const cleanup = window.electronAPI.onScanProgress((data) => {
                setScanProgress(data)
            })
            return cleanup
        }
    }, [isScanning])

    // フォルダを追加
    const handleAddFolder = async () => {
        const path = await window.electronAPI.selectFolder()
        if (path && settings) {
            // 重複チェック
            if (!settings.libraryPaths.includes(path)) {
                const newSettings = {
                    ...settings,
                    libraryPaths: [...settings.libraryPaths, path]
                }
                await window.electronAPI.saveSettings(newSettings)
                setSettings(newSettings)

                // 追加したフォルダをすぐにスキャンするか確認してもいいが、
                // ここではユーザーが明示的に「更新」ボタンを押す運用にする
            }
        }
    }

    // フォルダを削除
    const handleRemoveFolder = async (pathToRemove: string) => {
        if (!settings) return

        // 確認ダイアログなどは省略（即削除）
        const newSettings = {
            ...settings,
            libraryPaths: settings.libraryPaths.filter(p => p !== pathToRemove)
        }
        await window.electronAPI.saveSettings(newSettings)
        setSettings(newSettings)
    }

    // ライブラリ更新（全フォルダスキャン）
    const handleUpdateLibrary = async () => {
        if (!settings || settings.libraryPaths.length === 0) return

        setIsScanning(true)
        setScanResult(null)

        const combinedResult: ScanResult = {
            success: 0,
            failed: 0,
            totalFolders: 0,
            newWorks: [],
            errors: []
        }

        try {
            for (const path of settings.libraryPaths) {
                setCurrentScanPath(path)
                const result = await window.electronAPI.scanLibrary(path)

                // 結果をマージ
                combinedResult.success += result.success
                combinedResult.failed += result.failed
                combinedResult.totalFolders += result.totalFolders
                combinedResult.newWorks.push(...result.newWorks)
                combinedResult.errors.push(...result.errors)
            }

            setScanResult(combinedResult)
            onScanComplete()
        } catch (error) {
            console.error('Scan error:', error)
        } finally {
            setIsScanning(false)
            setCurrentScanPath('')
        }
    }

    if (!settings) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2" />
                設定を読み込み中...
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* ヘッダー */}
            <div className="h-14 flex items-center px-6 border-b border-white/5 bg-slate-900/30">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="mr-4 text-slate-400 hover:text-white hover:bg-white/5"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-1" />
                    戻る
                </Button>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-purple-400" />
                    設定
                </h1>
            </div>

            <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full">
                <div className="space-y-8">

                    {/* ライブラリ管理セクション */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold mb-1">ライブラリ管理</h2>
                                <p className="text-sm text-slate-400">作品が保存されているフォルダを管理します。</p>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h3 className="font-medium text-slate-200">監視フォルダ</h3>
                                <Button
                                    size="sm"
                                    onClick={handleAddFolder}
                                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"
                                >
                                    <FolderIcon className="w-4 h-4 mr-2" />
                                    フォルダを追加
                                </Button>
                            </div>

                            {settings.libraryPaths.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    フォルダが登録されていません。<br />
                                    「フォルダを追加」ボタンから作品フォルダを登録してください。
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {settings.libraryPaths.map((path) => (
                                        <div key={path} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                    <FolderIcon className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <span className="font-mono text-sm truncate text-slate-300">{path}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveFolder(path)}
                                                className="text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* スキャンアクション */}
                        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-medium text-slate-200 mb-1">ライブラリの更新</h3>
                                    <p className="text-sm text-slate-400">設定されたフォルダを再スキャンし、新しい作品を追加します。</p>
                                </div>
                                <Button
                                    onClick={handleUpdateLibrary}
                                    disabled={isScanning || settings.libraryPaths.length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
                                >
                                    <RefreshIcon className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                                    {isScanning ? '更新中...' : 'ライブラリを更新'}
                                </Button>
                            </div>

                            {/* スキャン進行状況 */}
                            {isScanning && (
                                <div className="space-y-3 mt-4 p-4 bg-slate-800/50 rounded-lg border border-white/5">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span className="truncate max-w-[70%]">スキャン中: {currentScanPath}</span>
                                        {scanProgress && (
                                            <span>{scanProgress.current} / {scanProgress.total}</span>
                                        )}
                                    </div>

                                    {scanProgress && (
                                        <>
                                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                                                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                {scanProgress.rjCode}: {scanProgress.status}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* スキャン結果 */}
                            {!isScanning && scanResult && (
                                <div className="mt-4 p-4 bg-green-900/10 border border-green-500/20 rounded-lg">
                                    <h4 className="text-sm font-medium text-green-400 mb-2">更新完了</h4>
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-slate-300">検出: <strong className="text-white">{scanResult.totalFolders}</strong></span>
                                        <span className="text-slate-300">追加: <strong className="text-green-400">{scanResult.success}</strong></span>
                                        <span className="text-slate-300">失敗: <strong className="text-red-400">{scanResult.failed}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* その他の設定（プレースホルダー） */}
                    <section className="space-y-4 pt-4 border-t border-white/5 opacity-50 pointer-events-none">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold mb-1">一般設定</h2>
                                <p className="text-sm text-slate-400">アプリケーションの表示や動作を設定します（未実装）。</p>
                            </div>
                        </div>
                        {/* テーマ設定など */}
                    </section>
                </div>
            </div>
        </div>
    )
}
