/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { X } from "lucide-react";
import rawLocationsData from "../../../nigerian-states-lga.json";

// Normalize LGAs from objects (nigerian-states-lga.json) to flat string arrays
const locationsData = rawLocationsData.map((d: any) => ({
    state: d.state,
    lgas: d.lgas.map((l: any) => (typeof l === "string" ? l : l.name)),
}));

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

    /**
     * LGAs of the selected states, each carrying the state(s) it came from.
     * LGA names repeat across Nigeria (SURULERE in Lagos and Oyo, OBI in Benue
     * and Nasarawa, …), so a bare name is ambiguous once a mentor covers more
     * than one state — every option is labelled with its state.
     */
    const availableLgas = useMemo(() => {
        if (selectedStates.length === 0) return [];
        const byName = new Map<string, string[]>();
        locationsData.forEach((d: any) => {
            if (!selectedStates.includes(d.state)) return;
            d.lgas.forEach((l: string) => {
                const states = byName.get(l);
                if (states) {
                    if (!states.includes(d.state)) states.push(d.state);
                } else {
                    byName.set(l, [d.state]);
                }
            });
        });
        return Array.from(byName, ([lga, states]) => ({ lga, states }));
    }, [selectedStates]);

    const lgaStates = useMemo(
        () => new Map(availableLgas.map(({ lga, states }) => [lga, states])),
        [availableLgas]
    );

    /** Selected LGA names that exist in more than one of the selected states. */
    const ambiguousSelectedLgas = useMemo(
        () =>
            selectedLgas
                .map((lga) => ({ lga, states: lgaStates.get(lga) ?? [] }))
                .filter(({ states }) => states.length > 1),
        [selectedLgas, lgaStates]
    );

    const suggestedLgas = useMemo(() => {
        if (!lgaSearch.trim()) return [];
        const needle = lgaSearch.trim().toLowerCase();
        return availableLgas
            .filter(
                ({ lga, states }) =>
                    (lga.toLowerCase().includes(needle) ||
                        states.some((s) => s.toLowerCase().includes(needle))) &&
                    !selectedLgas.includes(lga)
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
                    <div className="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto">
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
                                    <span className="text-[10px] text-gray-500">
                                        {(lgaStates.get(lga) ?? []).join(" / ")}
                                    </span>
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
                        <div className="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto">
                            {suggestedLgas.map(({ lga, states }) => (
                                <button
                                    key={lga}
                                    type="button"
                                    className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                                    onClick={() => handleAddLga(lga)}
                                >
                                    + {lga}
                                    <span className="ml-1 text-blue-500">({states.join(" / ")})</span>
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

                    {ambiguousSelectedLgas.length > 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            {ambiguousSelectedLgas
                                .map(({ lga, states }) => `${lga} (${states.join(" & ")})`)
                                .join(", ")}{" "}
                            {ambiguousSelectedLgas.length === 1 ? "exists" : "exist"} in more than one
                            of the selected states, so this assignment covers all of them.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
