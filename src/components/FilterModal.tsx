import { useState } from 'react'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Select } from './ui/select'
import { ScrollArea } from './ui/scroll-area'
import {
    SearchIcon,
    TagIcon,
    UsersIcon,
    FilterIcon,
    XIcon,
} from './ui/icons'
import type { TagCount, CircleCount } from '../vite-env.d'

interface FilterModalProps {
    isOpen: boolean
    onClose: () => void
    searchQuery: string
    onSearchChange: (query: string) => void
    tags: TagCount[]
    selectedTags: string[]
    onTagToggle: (tag: string) => void
    circles: CircleCount[]
    selectedCircle: string
    onCircleChange: (circle: string) => void
    workTypes: { type: string; count: number }[]
    selectedWorkType: string
    onWorkTypeChange: (workType: string) => void
    onClearFilters: () => void
}

export function FilterModal({
    isOpen,
    onClose,
    searchQuery,
    onSearchChange,
    tags,
    selectedTags,
    onTagToggle,
    circles,
    selectedCircle,
    onCircleChange,
    workTypes,
    selectedWorkType,
    onWorkTypeChange,
    onClearFilters,
}: FilterModalProps) {
    if (!isOpen) return null

    const circleOptions = [
        { value: '', label: 'すべてのサークル' },
        ...circles.slice(0, 100).map((c) => ({
            value: c.circle,
            label: `${c.circle} (${c.count})`,
        })),
    ]

    const workTypeOptions = [
        { value: '', label: 'すべての形式' },
        ...workTypes.map((t) => ({
            value: t.type,
            label: `${t.type} (${t.count})`,
        })),
    ]

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Body */}
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <FilterIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">フィルター</h2>
                            <p className="text-xs text-slate-500">条件を指定して絞り込みます</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 p-8">
                    <div className="space-y-10 pb-8">
                        {/* Keyword Search */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <SearchIcon className="w-3.5 h-3.5" />
                                Keyword
                            </label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    placeholder="タイトル、サークル名、RJコード..."
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="bg-white/5 border-white/5 h-12 rounded-xl focus:border-purple-500/50 pr-10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Work Type */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <FilterIcon className="w-3.5 h-3.5" />
                                    Work Format
                                </label>
                                <Select
                                    value={selectedWorkType}
                                    onChange={(e) => onWorkTypeChange(e.target.value)}
                                    options={workTypeOptions}
                                    className="bg-white/5 border-white/5 h-12 rounded-xl"
                                />
                            </div>

                            {/* Circle */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <UsersIcon className="w-3.5 h-3.5" />
                                    Circle / Brand
                                </label>
                                <Select
                                    value={selectedCircle}
                                    onChange={(e) => onCircleChange(e.target.value)}
                                    options={circleOptions}
                                    className="bg-white/5 border-white/5 h-12 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <TagIcon className="w-3.5 h-3.5" />
                                    Popular Tags
                                </label>
                                {selectedTags.length > 0 && (
                                    <button
                                        onClick={() => selectedTags.forEach(onTagToggle)}
                                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300"
                                    >
                                        選択解除 ({selectedTags.length})
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.slice(0, 60).map(({ tag, count }) => {
                                    const isSelected = selectedTags.includes(tag)
                                    return (
                                        <Badge
                                            key={tag}
                                            variant={isSelected ? 'selected' : 'outline'}
                                            onClick={() => onTagToggle(tag)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isSelected
                                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20 active:scale-95'
                                                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {tag}
                                            <span className={`ml-1.5 opacity-50 ${isSelected ? 'text-white' : ''}`}>{count}</span>
                                        </Badge>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer Actions */}
                <div className="p-8 border-t border-white/5 flex items-center justify-between bg-slate-900/50">
                    <button
                        onClick={onClearFilters}
                        className="text-xs font-bold text-slate-500 hover:text-white transition-colors"
                    >
                        すべてのフィルターをリセット
                    </button>
                    <Button
                        onClick={onClose}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 px-10 py-6 rounded-2xl font-black shadow-xl shadow-purple-600/20"
                    >
                        適用する
                    </Button>
                </div>
            </div>
        </div>
    )
}
