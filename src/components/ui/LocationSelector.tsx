/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { X } from "lucide-react";
import locationsData from "@/lib/locations.json";

export interface LocationSelectorProps {
    selectedStates: string[];
    onChangeStates: (states: string[]) => void;
    selectedLgas?: string[];
    onChangeLgas?: (lgas: string[]) => void;
    showLgas?: boolean;
}

export function LocationSelector({
    selectedStates,
    onChangeStates,
    selectedLgas = [],
    onChangeLgas,
    showLgas = false,
}: LocationSelectorProps) {
    const [stateSearch, setStateSearch] = useState("");
    const [lgaSearch, setLgaSearch] = useState("");

    const allStates = useMemo(() => locationsData.map((d: any) => d.state), []);

    const suggestedStates = useMemo(() => {
        if (!stateSearch.trim()) return [];
        return allStates
            .filter(
                (s: string) =>
                    s.toLowerCase().includes(stateSearch.trim().toLowerCase()) &&
                    !selectedStates.includes(s)
            )
            .slice(0, 10); // Show up to 10 suggestions
    }, [stateSearch, selectedStates, allStates]);

    const availableLgas = useMemo(() => {
        if (selectedStates.length === 0) return [];
        const lgas = new Set<string>();
        locationsData.forEach((d: any) => {
            if (selectedStates.includes(d.state)) {
                d.lgas.forEach((l: string) => lgas.add(l));
            }
        });
        return Array.from(lgas);
    }, [selectedStates]);

    const suggestedLgas = useMemo(() => {
        if (!lgaSearch.trim()) return [];
        return availableLgas
            .filter(
                (l: string) =>
                    l.toLowerCase().includes(lgaSearch.trim().toLowerCase()) &&
                    !selectedLgas.includes(l)
            )
            .slice(0, 10);
    }, [lgaSearch, selectedLgas, availableLgas]);

    const handleAddState = (state: string) => {
        if (!selectedStates.includes(state)) {
            onChangeStates([...selectedStates, state]);
        }
        setStateSearch("");
    };

    const handleRemoveState = (state: string) => {
        onChangeStates(selectedStates.filter((s) => s !== state));
        if (onChangeLgas && showLgas) {
            // Potentially remove LGAs that no longer belong to selected states
            const remainingStates = selectedStates.filter((s) => s !== state);
            const validLgas = new Set<string>();
            locationsData.forEach((d: any) => {
                if (remainingStates.includes(d.state)) {
                    d.lgas.forEach((l: string) => validLgas.add(l));
                }
            });
            const updatedLgas = selectedLgas.filter((lga) => validLgas.has(lga));
            if (updatedLgas.length !== selectedLgas.length) {
                onChangeLgas(updatedLgas);
            }
        }
    };

    const handleAddLga = (lga: string) => {
        if (onChangeLgas && !selectedLgas.includes(lga)) {
            onChangeLgas([...selectedLgas, lga]);
        }
        setLgaSearch("");
    };

    const handleRemoveLga = (lga: string) => {
        if (onChangeLgas) {
            onChangeLgas(selectedLgas.filter((l) => l !== lga));
        }
    };

    return (
        <div className="space-y-4">
            {/* State Selector */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">States</label>

                {/* Selected States Badges */}
                {selectedStates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {selectedStates.map((state) => (
                            <Badge key={state} variant="secondary" className="flex items-center gap-1">
                                {state}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveState(state)}
                                    className="hover:text-red-500 rounded-full focus:outline-none"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                {/* State Suggestions */}
                {suggestedStates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {suggestedStates.map((state) => (
                            <button
                                key={state}
                                type="button"
                                className="px-3 py-1 text-xs bg-orange-50 text-orange-700 rounded-full border border-orange-200 hover:bg-orange-100 transition-colors"
                                onClick={() => handleAddState(state)}
                            >
                                + {state}
                            </button>
                        ))}
                    </div>
                )}

                {/* State Input */}
                <input
                    type="text"
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder="Type to search and add states..."
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
            </div>

            {/* LGA Selector */}
            {showLgas && selectedStates.length > 0 && (
                <div className="space-y-2 pt-2">
                    <label className="block text-sm font-medium text-gray-700">Local Government Areas (LGAs)</label>

                    {/* Selected LGAs Badges */}
                    {selectedLgas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedLgas.map((lga) => (
                                <Badge key={lga} variant="secondary" className="flex items-center gap-1">
                                    {lga}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLga(lga)}
                                        className="hover:text-red-500 rounded-full focus:outline-none"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* LGA Suggestions */}
                    {suggestedLgas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {suggestedLgas.map((lga) => (
                                <button
                                    key={lga}
                                    type="button"
                                    className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                                    onClick={() => handleAddLga(lga)}
                                >
                                    + {lga}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* LGA Input */}
                    <input
                        type="text"
                        value={lgaSearch}
                        onChange={(e) => setLgaSearch(e.target.value)}
                        placeholder="Type to search and add LGAs..."
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                </div>
            )}
        </div>
    );
}
