"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type BulkMentorInput, type Coordinator } from "@/lib/api-client";
import { Upload, Download, Trash2 } from "lucide-react";
import Papa from "papaparse";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

/* ─── CSV Columns ──────────────────────────── */
const EXPECTED_HEADERS = ["Name of Mentor", "Email", "Phone Number", "States", "Assigned L.G.As"];

export default function BulkUploadMentorsPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const [mentors, setMentors] = useState<BulkMentorInput[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [page, setPage] = useState(1);
    const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("");
    const itemsPerPage = 10;
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user?.role === "admin") {
            api.coordinators.list({ limit: "100" })
                .then(res => setCoordinators(res.data))
                .catch(console.error);
        }
    }, [user?.role]);

    if (user?.role !== "admin" && user?.role !== "coordinator") {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    const handleDownloadTemplate = () => {
        const csvContent = EXPECTED_HEADERS.join(",") + "\n" +
            "John Doe,john.doe@example.com,08012345678,Lagos,\"Ikeja, Surulere\"";

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "mentor_bulk_upload_template.csv");
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
                const parsedMentors: BulkMentorInput[] = [];

                for (const row of results.data) {
                    const name = row["Name of Mentor"] || row["name"] || "";
                    const email = row["Email"] || row["email"] || "";
                    const phone = row["Phone Number"] || row["phone"] || "";
                    const states = row["States"] || row["State"] || row["state"] || row["states"] || "";
                    const lgas = row["Assigned L.G.As"] || row["lgas"] || "";

                    if (name && email) {
                        parsedMentors.push({ name, email, phone, states, lgas });
                    }
                }

                if (parsedMentors.length === 0) {
                    setError("No valid mentor records found. Ensure columns match the template.");
                    return;
                }

                if (parsedMentors.length > 500) {
                    setError(`Maximum 500 records allowed. Found ${parsedMentors.length}.`);
                    return;
                }

                setMentors(parsedMentors);
                setPage(1);
            },
            error: (err) => {
                setError(`Failed to parse CSV: ${err.message}`);
            }
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDeleteMentor = (index: number) => {
        const newMentors = [...mentors];
        const realIndex = (page - 1) * itemsPerPage + index;
        newMentors.splice(realIndex, 1);
        setMentors(newMentors);

        // Adjust page if necessary
        const totalPages = Math.ceil(newMentors.length / itemsPerPage);
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        } else if (newMentors.length === 0) {
            setPage(1);
        }
    };

    const handleEditMentor = (index: number, field: keyof BulkMentorInput, value: string) => {
        const newMentors = [...mentors];
        const realIndex = (page - 1) * itemsPerPage + index;
        newMentors[realIndex] = { ...newMentors[realIndex], [field]: value };
        setMentors(newMentors);
    };

    const handleUploadToBackend = async () => {
        if (mentors.length === 0) return;
        if (user?.role === "admin" && !selectedCoordinatorId) {
            setError("Please select a Coordinator to assign these mentors to.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccessMsg("");

        try {
            const response = await api.mentors.bulkCreate({
                mentors,
                coordinatorId: user?.role === "admin" ? selectedCoordinatorId : undefined
            });

            let msg = `Successfully uploaded ${response.successful} mentors.`;
            if (response.failed > 0) {
                msg += ` Failed to upload ${response.failed} mentors.`;
            }
            setSuccessMsg(msg);

            if (response.errors.length > 0) {
                setError(response.errors.join("\\n"));
            }

            // Clear the current list if all successful
            if (response.failed === 0) {
                setMentors([]);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(mentors.length / itemsPerPage);
    const currentMentors = mentors.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <>
            <Header title="Bulk Upload Mentors" subtitle="Import via CSV, auto-generate passwords & email" />

            <div className="p-6 space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-md">
                        {successMsg}
                    </div>
                )}

                {/* Upload Controls */}
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

                        {mentors.length > 0 && (
                            <>
                                {user?.role === "admin" && (
                                    <div className="w-64">
                                        <SearchableSelect
                                            options={coordinators.map(c => ({ value: c._id, label: c.name }))}
                                            value={selectedCoordinatorId}
                                            onChange={setSelectedCoordinatorId}
                                            placeholder="Assign to Coordinator..."
                                        />
                                    </div>
                                )}
                                <Button onClick={handleUploadToBackend} disabled={loading || (user?.role === "admin" && !selectedCoordinatorId)}>
                                    {loading ? "Processing..." : `Upload to Server (${mentors.length})`}
                                </Button>
                                <Button variant="outline" onClick={() => setMentors([])} disabled={loading}>
                                    Clear All
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Preview Table */}
                {mentors.length > 0 && (
                    <div className="bg-white rounded-lg border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-600">Name *</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">Email *</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">States</th>
                                    <th className="px-4 py-3 font-medium text-gray-600">LGAs</th>
                                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {currentMentors.map((m, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">
                                            <Input
                                                value={m.name}
                                                onChange={(e) => handleEditMentor(idx, "name", e.target.value)}
                                                className="h-8"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={m.email}
                                                onChange={(e) => handleEditMentor(idx, "email", e.target.value)}
                                                className="h-8"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={m.phone || ""}
                                                onChange={(e) => handleEditMentor(idx, "phone", e.target.value)}
                                                className="h-8"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={m.states || ""}
                                                onChange={(e) => handleEditMentor(idx, "states", e.target.value)}
                                                className="h-8 w-24"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={m.lgas || ""}
                                                onChange={(e) => handleEditMentor(idx, "lgas", e.target.value)}
                                                className="h-8 w-32"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteMentor(idx)}
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

                {/* Pagination Controls */}
                {mentors.length > 0 && totalPages > 1 && (
                    <div className="flex justify-between items-center text-sm text-gray-500 mt-4">
                        <p>
                            Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, mentors.length)} of {mentors.length} entries
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
