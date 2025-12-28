import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    SearchIcon,
    TagIcon,
    UsersIcon,
    FilterIcon,
    XIcon,
    RefreshIcon,
    SettingsIcon,
    LibraryIcon,
} from '@/components/ui/icons'
import type { TagCount, CircleCount } from '@/vite-env.d'

interface SidebarProps {
    searchQuery: string
    onSearchChange: (query: string) => void
    tags: TagCount[]
    selectedTags: string[]
    onTagToggle: (tag: string) => void
    circles: CircleCount[]
    selectedCircle: string
    onCircleChange: (circle: string) => void
    onClearFilters: () => void
    onRefresh: () => void
    onOpenSettings: () => void
    totalWorks: number
    filteredWorks: number
    isLoading?: boolean
}

export function Sidebar({
    searchQuery,
    onSearchChange,
    tags,
    selectedTags,
    onTagToggle,
    circles,
    selectedCircle,
    onCircleChange,
    onClearFilters,
    onRefresh,
    onOpenSettings,
    totalWorks,
    filteredWorks,
    isLoading = false,
}: SidebarProps) {
    const hasActiveFilters = searchQuery || selectedTags.length > 0 || selectedCircle

    // サークルのオプションを生成
    const circleOptions = [
        { value: '', label: 'すべてのサークル' },
        ...circles.slice(0, 50).map((c) => ({
            value: c.circle,
            label: `${c.circle} (${c.count})`,
        })),
    ]

    return (
        <aside className="w-80 h-full flex flex-col bg-slate-900/50 border-r border-white/5 backdrop-blur-sm">
            {/* ヘッダー */}
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <span className="text-lg font-bold text-white">H</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Haco</h1>
                        <p className="text-xs text-slate-400">ライブラリ管理</p>
                    </div>
                </div>

                {/* 統計 */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <LibraryIcon className="w-4 h-4" />
                    <span>
                        {filteredWorks === totalWorks
                            ? `${totalWorks} 作品`
                            : `${filteredWorks} / ${totalWorks} 作品`}
                    </span>
                </div>
            </div>

            {/* フィルターエリア */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* キーワード検索 */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <SearchIcon className="w-4 h-4" />
                            キーワード検索
                        </label>
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="タイトル、サークル名..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="bg-slate-800/50 border-white/10 focus:border-purple-500/50 pr-8"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => onSearchChange('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* サークルフィルター */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <UsersIcon className="w-4 h-4" />
                            サークル
                        </label>
                        <div className="relative">
                            <Select
                                value={selectedCircle}
                                onChange={(e) => onCircleChange(e.target.value)}
                                options={circleOptions}
                                className="bg-slate-800/50 border-white/10 focus:border-purple-500/50"
                            />
                        </div>
                    </div>

                    {/* タグフィルター */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <TagIcon className="w-4 h-4" />
                                タグ
                            </label>
                            {selectedTags.length > 0 && (
                                <button
                                    onClick={() => selectedTags.forEach(onTagToggle)}
                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    クリア ({selectedTags.length})
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                            {tags.slice(0, 30).map(({ tag, count }) => {
                                const isSelected = selectedTags.includes(tag)
                                return (
                                    <Badge
                                        key={tag}
                                        variant={isSelected ? 'selected' : 'outline'}
                                        onClick={() => onTagToggle(tag)}
                                        className={`text-xs transition-all duration-200 ${isSelected
                                                ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {tag}
                                        <span className="ml-1 opacity-60">({count})</span>
                                    </Badge>
                                )
                            })}
                            {tags.length > 30 && (
                                <Badge
                                    variant="outline"
                                    className="text-xs bg-white/5 border-white/10 text-slate-500 cursor-default"
                                >
                                    +{tags.length - 30} more
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* フッター */}
            <div className="p-4 border-t border-white/5 space-y-2">
                {/* フィルタークリアボタン */}
                {hasActiveFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={onClearFilters}
                    >
                        <FilterIcon className="w-4 h-4 mr-2" />
                        フィルターをクリア
                    </Button>
                )}

                {/* アクションボタン */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={onRefresh}
                        disabled={isLoading}
                    >
                        <RefreshIcon className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        更新
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={onOpenSettings}
                    >
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        設定
                    </Button>
                </div>
            </div>
        </aside>
    )
}
