"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type DocumentType } from "@/lib/api-client";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";

/* ─── Create/Edit Document Type Modal ──── */
function DocumentTypeModal({
    open,
    mode,
    initialData,
    onClose,
    onSaved,
}: {
    open: boolean;
    mode: "create" | "edit";
    initialData?: DocumentType | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open && mode === "edit" && initialData) {
            setTitle(initialData.title);
        } else if (open && mode === "create") {
            setTitle("");
        }
    }, [open, mode, initialData]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (mode === "create") {
                await api.documentTypes.create({ title });
            } else if (mode === "edit" && initialData) {
                await api.documentTypes.update(initialData._id, { title });
            }
            onSaved();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold">
                            {mode === "create" ? "Add Document Type" : "Edit Document Type"}
                        </h2>
                        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                        <Input
                            label="Title *"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 px-6 pb-6">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving…" : "Save"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Page ────────────────────────── */
export default function DocumentTypesPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [selectedType, setSelectedType] = useState<DocumentType | null>(null);

    const fetchTypes = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.documentTypes.list({ page: String(page), limit: "20" });
            setTypes(result.data);
            setTotalPages(result.pagination.totalPages);
            setTotal(result.pagination.total);
        } catch {
            /* no-op */
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchTypes();
    }, [fetchTypes]);

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Are you sure you want to delete ${title}?`)) return;
        try {
            await api.documentTypes.delete(id);
            fetchTypes();
        } catch (err) {
            alert((err as Error).message);
        }
    };

    if (user?.role !== "admin") {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    return (
        <>
            <Header title="Document Types" subtitle="Manage types of fellow documents" />

            <div className="p-6 space-y-4">
                <Card>
                    <CardContent className="pt-4 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                            {total} document type{total === 1 ? '' : 's'} defined
                        </p>
                        <Button onClick={() => {
                            setModalMode("create");
                            setSelectedType(null);
                            setModalOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-1" /> Add Type
                        </Button>
                    </CardContent>
                </Card>

                {/* Table */}
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Title</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Created At</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                                </tr>
                            ) : !types.length ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">No document types found.</td>
                                </tr>
                            ) : (
                                types.map((t) => (
                                    <tr key={t._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{t.title}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(t.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setModalMode("edit");
                                                    setSelectedType(t);
                                                    setModalOpen(true);
                                                }}
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4 text-gray-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(t._id, t.title)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <DocumentTypeModal
                open={modalOpen}
                mode={modalMode}
                initialData={selectedType}
                onClose={() => setModalOpen(false)}
                onSaved={fetchTypes}
            />
        </>
    );
}
