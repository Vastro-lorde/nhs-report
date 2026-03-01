/* ──────────────────────────────────────────
   Fellows Management Page (Mentors only)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { UserRole } from "@/lib/constants";
import { api, type Fellow } from "@/lib/api-client";
import { Plus, UserMinus, Upload, FileCheck, FileDown, Loader2, FileUp } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import Link from "next/link";

/* ─── Add Fellow Modal ──────────────────── */
function AddFellowModal({
    open,
    onClose,
    onAdded,
}: {
    open: boolean;
    onClose: () => void;
    onAdded: () => void;
}) {
    const [form, setForm] = useState({ name: "", gender: "Male", lga: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.fellows.create(form);
            onAdded();
            onClose();
            setForm({ name: "", gender: "Male", lga: "" });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Add New Fellow</h2>
                        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                        <Input
                            label="Full Name *"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                        <Select
                            label="Gender *"
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            options={[
                                { label: "Male", value: "Male" },
                                { label: "Female", value: "Female" },
                                { label: "Other", value: "Other" },
                            ]}
                            required
                        />
                        <Input
                            label="LGA *"
                            value={form.lga}
                            onChange={(e) => setForm({ ...form, lga: e.target.value })}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 px-6 pb-6">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Adding…" : "Add Fellow"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Page ─────────────────────────── */
export default function FellowsPage() {
    const { data: session } = useSession();
    const [fellows, setFellows] = useState<Fellow[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [showAdd, setShowAdd] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeUploadFellow, setActiveUploadFellow] = useState<string | null>(null);

    const fetchFellows = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.fellows.list({ limit: "100" });
            setFellows(result.data);
            setTotal(result.pagination.total);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFellows();
    }, [fetchFellows]);

    // Mentors only
    if (session?.user && session.user.role !== UserRole.MENTOR) {
        return (
            <div className="p-12 text-center text-gray-500">
                You do not have permission to view this page. Fellows are managed directly by Mentors.
            </div>
        );
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this fellow?")) return;
        try {
            await api.fellows.delete(id);
            fetchFellows();
        } catch {
            alert("Failed to delete fellow");
        }
    };

    const triggerUpload = (fellowId: string) => {
        setActiveUploadFellow(fellowId);
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const fellowId = activeUploadFellow;
        if (!file || !fellowId) return;

        setUploadingId(fellowId);
        try {
            // Upload file to Cloudinary
            const { url } = await api.upload.file(file);

            // Save URL to Fellow record
            await api.fellows.update(fellowId, { newQuarterlyReportUrl: url } as any);

            // Refresh list
            fetchFellows();
        } catch (err) {
            alert(`Upload failed: ${(err as Error).message}`);
        } finally {
            setUploadingId(null);
            setActiveUploadFellow(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <>
            <Header title="My Fellows" subtitle={`Managing ${total} assigned fellow${total === 1 ? "" : "s"}`} />

            <div className="p-6 space-y-4">
                <Card>
                    <CardContent className="pt-4 flex justify-between items-center">
                        <div className="text-sm text-gray-600 max-w-2xl">
                            Keep track of your assigned mentees here. You can also securely attach their latest Quarterly Report directly to their profile for administrators and coordinators to review.
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const data = fellows.map((f) => ({
                                        Name: f.name,
                                        Gender: f.gender,
                                        LGA: f.lga,
                                        QuarterlyReportSubmitted: f.quarterlyReports.length > 0 ? "Yes" : "No",
                                    }));
                                    exportToCSV(data, "my-fellows");
                                }}
                            >
                                <FileDown className="h-4 w-4 mr-1" /> Export CSV
                            </Button>
                            <Button size="sm" onClick={() => setShowAdd(true)}>
                                <Plus className="h-4 w-4 mr-1" /> Add Fellow
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Gender</th>
                                <th className="px-4 py-3 font-medium text-gray-600">LGA</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Quarterly Report</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                                </tr>
                            ) : !fellows.length ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No fellows added yet.</td>
                                </tr>
                            ) : (
                                fellows.map((f) => (
                                    <tr key={f._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{f.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.gender}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.lga}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                {f.quarterlyReports.map((r, i) => (
                                                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-green-600 hover:underline text-xs">
                                                        <FileCheck className="h-3 w-3 mr-1" /> View Report ({new Date(r.uploadedAt).toLocaleDateString()})
                                                    </a>
                                                ))}
                                                {f.quarterlyReports.length === 0 && (
                                                    <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Missing</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={uploadingId === f._id}
                                                onClick={() => triggerUpload(f._id)}
                                            >
                                                {uploadingId === f._id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Upload className="h-3 w-3 mr-1" /> Upload
                                                    </>
                                                )}
                                            </Button>
                                            <Link href={`/fellows/${f._id}/documents/upload`}>
                                                <Button variant="secondary" size="sm">
                                                    <FileUp className="h-3 w-3 mr-1" /> Documents
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(f._id)}
                                            >
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf,image/*"
                className="hidden"
            />

            <AddFellowModal
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onAdded={fetchFellows}
            />
        </>
    );
}
