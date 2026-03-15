/* ──────────────────────────────────────────
   UI Component: Searchable Select
   ────────────────────────────────────────── */
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, X } from "lucide-react";

export interface SearchableSelectProps {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchableSelect({
    label,
    error,
    options,
    value,
    onChange,
    placeholder = "Search...",
    className,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-1 relative" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
            <div
                className={cn(
                    "flex min-h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer focus-within:ring-2 focus-within:ring-orange-600 focus-within:border-transparent",
                    error && "border-red-500 focus-within:ring-red-500",
                    className
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate relative">
                    {!isOpen && (
                        <span className={selectedOption ? "text-gray-900" : "text-gray-400"}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    {isOpen && (
                        <input
                            type="text"
                            autoFocus
                            className="w-full h-full bg-transparent outline-none placeholder-gray-400"
                            placeholder={placeholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                    {value && !isOpen && (
                        <X
                            className="h-4 w-4 cursor-pointer hover:text-gray-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                                setSearch("");
                            }}
                        />
                    )}
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-md">
                    {filteredOptions.length === 0 ? (
                        <p className="px-3 py-2 text-gray-500 text-center">No options found</p>
                    ) : (
                        filteredOptions.map((opt) => (
                            <div
                                key={opt.value}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center py-2 pl-3 pr-9 hover:bg-orange-50 hover:text-orange-900",
                                    value === opt.value ? "bg-orange-50 font-medium text-orange-900" : "text-gray-900"
                                )}
                                onClick={() => {
                                    onChange(opt.value);
                                    setSearch("");
                                    setIsOpen(false);
                                }}
                            >
                                <span className="block truncate">{opt.label}</span>
                                {value === opt.value ? (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-orange-600">
                                        <Check className="h-4 w-4" />
                                    </span>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}
