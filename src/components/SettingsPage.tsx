import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    FolderIcon,
    RefreshIcon,
    XIcon,
    SettingsIcon,
    ChevronLeftIcon,
    TrashIcon
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
    const [isResetting, setIsResetting] = useState(false)

    // 設定とスキャン状態を読み込む
    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings)
        window.electronAPI.isScanning().then(setIsScanning)

        const cleanup = window.electronAPI.onScanStateChanged((state) => {
            setIsScanning(state)
        })

        return cleanup
    }, [])

    // スキャン進行状況のリスナー
    useEffect(() => {
        const cleanup = window.electronAPI.onScanProgress((data) => {
            setScanProgress(data)
        })
        return cleanup
    }, [])

    // フォルダを追加
    const handleAddFolder = async (onlyDLsite: boolean = false) => {
        if (isScanning || !settings) return

        const path = await window.electronAPI.selectFolder()
        if (path) {
            // 重複チェック
            const exists = settings.libraryPaths.some(p => (typeof p === 'string' ? p : p.path) === path)
            if (!exists) {
                const newSettings = {
                    ...settings,
                    libraryPaths: [...settings.libraryPaths, { path, onlyDLsite }]
                }
                await window.electronAPI.saveSettings(newSettings)
                setSettings(newSettings)

                // 追加したフォルダをすぐにスキャン
                setIsScanning(true)
                setScanResult(null)
                setCurrentScanPath(path)
                try {
                    const result = await window.electronAPI.scanLibrary(path, onlyDLsite)
                    setScanResult(result)
                    onScanComplete()
                } catch (error) {
                    console.error('Scan error:', error)
                } finally {
                    setIsScanning(false)
                    setCurrentScanPath('')
                }
            }
        }
    }

    // フォルダを削除
    const handleRemoveFolder = async (pathToRemove: string) => {
        if (isScanning || !settings) return

        const newSettings = {
            ...settings,
            libraryPaths: settings.libraryPaths.filter(p => (typeof p === 'string' ? p : p.path) !== pathToRemove)
        }
        await window.electronAPI.saveSettings(newSettings)
        setSettings(newSettings)
    }

    // ライブラリ更新（全フォルダスキャン）
    const handleUpdateLibrary = async () => {
        if (isScanning || !settings || settings.libraryPaths.length === 0) return

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
            for (const p of settings.libraryPaths) {
                const path = typeof p === 'string' ? p : p.path
                const onlyDLsite = typeof p === 'string' ? false : p.onlyDLsite

                setCurrentScanPath(path)
                const result = await window.electronAPI.scanLibrary(path, onlyDLsite)

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

    // アプリデータをリセット
    const handleResetApp = async () => {
        const confirmed = window.confirm('すべての設定、ライブラリデータ、キャッシュを完全に削除しますか？\nこの操作は取り消せません。実行後、アプリは自動的に再起動します。')

        if (confirmed) {
            setIsResetting(true)
            try {
                // ファイル削除
                await window.electronAPI.resetApp()

                // 少し待ってから画面を再読み込み（リセットをメインプロセスに反映させる）
                setTimeout(() => {
                    window.location.reload()
                }, 500)
            } catch (error) {
                console.error('Reset error:', error)
                alert('リセット中にエラーが発生しました。')
                setIsResetting(false)
            }
        }
    }


    if (!settings || isResetting) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-lg font-medium text-white mb-2">
                    {isResetting ? 'データを初期化中...' : '設定を読み込み中...'}
                </div>
                {isResetting && <p className="text-sm">間もなくアプリを再起動します。</p>}
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
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
                            <div className="p-4 border-b border-white/5 flex flex-wrap gap-2 justify-between items-center bg-white/5">
                                <h3 className="font-medium text-slate-200">監視フォルダ</h3>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddFolder(true)}
                                        disabled={isScanning}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                    >
                                        <FolderIcon className="w-3.5 h-3.5 mr-1.5" />
                                        DLsiteフォルダを追加
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddFolder(false)}
                                        disabled={isScanning}
                                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                    >
                                        <FolderIcon className="w-3.5 h-3.5 mr-1.5" />
                                        フォルダを追加
                                    </Button>
                                </div>
                            </div>

                            {settings.libraryPaths.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    フォルダが登録されていません。<br />
                                    「フォルダを追加」ボタンから作品フォルダを登録してください。
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {settings.libraryPaths.map((p) => {
                                        const pathStr = typeof p === 'string' ? p : p.path
                                        const onlyDLsite = typeof p === 'string' ? false : p.onlyDLsite
                                        return (
                                            <div key={pathStr} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                        <FolderIcon className={`w-4 h-4 ${onlyDLsite ? 'text-blue-400' : 'text-slate-400'}`} />
                                                    </div>
                                                    <div className="flex flex-col overflow-hidden">
                                                        <span className="font-mono text-sm truncate text-slate-300">{pathStr}</span>
                                                        {onlyDLsite && <span className="text-[10px] text-blue-400 font-bold tracking-wider">DLsite ONLY</span>}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveFolder(pathStr)}
                                                    disabled={isScanning}
                                                    className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <XIcon className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )
                                    })}
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

                    {/* 自動スキャン・動作設定セクション */}
                    <section className="space-y-4 pt-4 border-t border-white/5">
                        <div>
                            <h2 className="text-xl font-bold mb-1">動作設定</h2>
                            <p className="text-sm text-slate-400">ライブラリの同期方法や挙動を設定します。</p>
                        </div>

                        <div className={`bg-slate-900/50 border border-white/10 rounded-xl divide-y divide-white/5 transition-opacity ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* 自動スキャン */}
                            <div className="p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-slate-200 mb-1">リアルタイム・フォルダ監視</h3>
                                    <p className="text-sm text-slate-400">フォルダ内の変更を検知して自動的にライブラリを更新します。</p>
                                </div>
                                <div
                                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${settings.autoScan ? 'bg-purple-600' : 'bg-slate-700'}`}
                                    onClick={async () => {
                                        if (isScanning) return
                                        const newSettings = { ...settings, autoScan: !settings.autoScan }
                                        await window.electronAPI.saveSettings(newSettings)
                                        setSettings(newSettings)
                                    }}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${settings.autoScan ? 'left-7' : 'left-1'}`} />
                                </div>
                            </div>

                            {/* リクエスト間隔 */}
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-medium text-slate-200 mb-1">スクレイピング間隔</h3>
                                        <p className="text-sm text-slate-400">作品情報を取得する際の間隔（ミリ秒）。サーバー負荷を考慮して設定してください。</p>
                                    </div>
                                    <span className="text-sm font-mono text-purple-400">{settings.requestDelay}ms</span>
                                </div>
                                <input
                                    type="range"
                                    min="500"
                                    max="5000"
                                    step="100"
                                    value={settings.requestDelay}
                                    disabled={isScanning}
                                    onChange={async (e) => {
                                        const val = parseInt(e.target.value)
                                        const newSettings = { ...settings, requestDelay: val }
                                        setSettings(newSettings)
                                    }}
                                    onMouseUp={async () => {
                                        if (settings && !isScanning) {
                                            await window.electronAPI.saveSettings(settings)
                                        }
                                    }}
                                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:accent-slate-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>速い (500ms)</span>
                                    <span>遅い (5000ms)</span>
                                </div>
                            </div>
                        </div>
                    </section>


                    {/* メンテナンスセクション */}
                    <section className="space-y-4 pt-4 border-t border-white/5">
                        <div>
                            <h2 className="text-xl font-bold mb-1 text-red-500">メンテナンス</h2>
                            <p className="text-sm text-slate-400">データの初期化やトラブルシューティングを行います。</p>
                        </div>

                        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-red-400 mb-1">アプリケーションデータの初期化</h3>
                                    <p className="text-sm text-slate-400">すべての設定、ライブラリ情報、キャッシュを初期状態に戻します。</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={handleResetApp}
                                    disabled={isScanning}
                                    className="text-red-400 hover:text-white hover:bg-red-600 shadow-sm disabled:opacity-30"
                                >
                                    <TrashIcon className="w-4 h-4 mr-2" />
                                    データを初期化
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
