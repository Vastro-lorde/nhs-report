"use client";

import { useEffect, useState } from "react";
import { Bug } from "lucide-react";

interface DebugSeederProps {
    onFill: () => void;
    label?: string;
}

export function DebugSeeder({ onFill, label = "Fill Fake Data" }: DebugSeederProps) {
    const [isDev, setIsDev] = useState(false);

    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            setIsDev(true);
        }
    }, []);

    if (!isDev) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                type="button"
                onClick={onFill}
                className="flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-purple-700 transition-colors"
            >
                <Bug className="h-4 w-4" />
                {label}
            </button>
        </div>
    );
}
