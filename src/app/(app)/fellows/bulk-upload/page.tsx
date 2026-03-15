"use client";

import { useState, useRef } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type BulkFellowInput } from "@/lib/api-client";
import { Upload, Download, Trash2, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/Input";

/* ─── CSV Columns ──────────────────────────── */
const EXPECTED_HEADERS = ["Name", "State", "LGA", "Phone Number", "Gender", "Profession"];

export default function BulkUploadFellowsPage() {
    const { data: session, status } = useSession();
    const user = session?.user;

    const [fellows, setFellows] = useState<BulkFellowInput[]>([]);

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (status === "loading") {
        return (
            <div className="p-6 flex items-center space-x-2">
                <Loader2 className="animate-spin w-5 h-5 text-gray-500" />
                <span>Loading...</span>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    if (user.role !== "mentor") {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    const handleDownloadTemplate = () => {
        const csvContent = EXPECTED_HEADERS.join(",") + "\n" +
            "Fatimah Ahmad Abdullahi,Lagos,Ikeja,08012345678,Female,Teacher";

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "fellow_bulk_upload_template.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError("");
        setSuccessMsg("");
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
            setError("Please upload a valid CSV file.");
            return;
        }

        Papa.parse<{ [key: string]: string }>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedFellows: BulkFellowInput[] = [];

                for (const row of results.data) {
                    const name = row["Name"] || row["name"] || "";
                    const state = row["State"] || row["state"] || "";
                    const lga = row["LGA"] || row["lga"] || "";
                    const phone = row["Phone Number"] || row["phone"] || "";
                    const gender = row["Gender"] || row["gender"] || "";
                    const profession = row["Profession"] || row["profession"] || "";

                    if (name && lga) {
                        parsedFellows.push({ name, state, lga, phone, gender, profession, mentorId: "self" });
                    }
                }

                if (parsedFellows.length === 0) {
                    setError("No valid fellow records found. Ensure columns match the template (needs at least Name and LGA).");
                    return;
                }

                if (parsedFellows.length > 500) {
                    setError(`Maximum 500 records allowed. Found ${parsedFellows.length}.`);
                    return;
                }

                setFellows(parsedFellows);
                setPage(1);
            },
            error: (err) => {
                setError(`Failed to parse CSV: ${err.message}`);
            }
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDeleteFellow = (index: number) => {
        const newFellows = [...fellows];
        const realIndex = (page - 1) * itemsPerPage + index;
        newFellows.splice(realIndex, 1);
        setFellows(newFellows);

        const totalPages = Math.ceil(newFellows.length / itemsPerPage);
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        } else if (newFellows.length === 0) {
            setPage(1);
        }
    };

    const handleEditFellow = (index: number, field: keyof BulkFellowInput, value: string) => {
        const newFellows = [...fellows];
        const realIndex = (page - 1) * itemsPerPage + index;
        newFellows[realIndex] = { ...newFellows[realIndex], [field]: value };

        setFellows(newFellows);
    };

    const handleUploadToBackend = async () => {
        if (fellows.length === 0) return;

        setLoading(true);
        setError("");
        setSuccessMsg("");

        try {
            const response = await api.fellows.bulkCreate({ fellows });

            let msg = `Successfully uploaded ${response.successful} fellows.`;
            if (response.failed > 0) {
                msg += ` Failed to upload ${response.failed} fellows.`;
            }
            setSuccessMsg(msg);

            if (response.errors.length > 0) {
                setError(response.errors.join("\\n"));
            }

            if (response.failed === 0) {
                setFellows([]);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(fellows.length / itemsPerPage);
    const currentFellows = fellows.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <>
            <Header title="Bulk Upload Fellows" subtitle="Import via CSV" />

            <div className="p-6 space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div className="bg-orange-50 text-orange-700 p-4 rounded-md">
                        {successMsg}
                    </div>
                )}

                <Card>
                    <CardContent className="pt-4 flex flex-wrap items-center gap-4">
                        <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="h-4 w-4 mr-1" /> Download CSV Template
                        </Button>

                        <div className="flex-1"></div>

                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                            <Upload className="h-4 w-4 mr-1" /> Select CSV File
                        </Button>

                        {fellows.length > 0 && (
                            <>
                                <Button onClick={handleUploadToBackend} disabled={loading}>
                                    {loading ? "Processing..." : `Upload to Server (${fellows.length})`}
                                </Button>
                                <Button variant="outline" onClick={() => setFellows([])} disabled={loading}>
                                    Clear All
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>

                {fellows.length > 0 && (
                    <div className="bg-white rounded-lg border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">Gender</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">State</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">LGA</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">Profession</th>
                                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {currentFellows.map((f, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.name}
                                                onChange={(e) => handleEditFellow(idx, "name", e.target.value)}
                                                className="h-8 min-w-[120px]"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.gender}
                                                onChange={(e) => handleEditFellow(idx, "gender", e.target.value)}
                                                className="h-8 w-20"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.state}
                                                onChange={(e) => handleEditFellow(idx, "state", e.target.value)}
                                                className="h-8 w-24"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.lga}
                                                onChange={(e) => handleEditFellow(idx, "lga", e.target.value)}
                                                className="h-8 w-28"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.phone}
                                                onChange={(e) => handleEditFellow(idx, "phone", e.target.value)}
                                                className="h-8 w-32"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={f.profession || ""}
                                                onChange={(e) => handleEditFellow(idx, "profession", e.target.value)}
                                                className="h-8 w-28"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteFellow(idx)}
                                                title="Delete Row"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {fellows.length > 0 && totalPages > 1 && (
                    <div className="flex justify-between items-center text-sm text-gray-500 mt-4">
                        <p>
                            Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, fellows.length)} of {fellows.length} entries
                        </p>
                        <div className="flex space-x-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
