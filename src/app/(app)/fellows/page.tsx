/* ──────────────────────────────────────────
   Fellows Management Page (Mentors only)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { UserRole } from "@/lib/constants";
import { api, type Fellow } from "@/lib/api-client";
import { Plus, UserMinus, FileDown, Trash2, FileUp, ChevronLeft, ChevronRight, Search, Pencil } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import Link from "next/link";

/* ─── Add Fellow Modal ──────────────────── */
function AddFellowModal({
    open,
    onClose,
    onAdded,
    mentorLGAs,
}: {
    open: boolean;
    onClose: () => void;
    onAdded: () => void;
    mentorLGAs: string[];
}) {
    const [form, setForm] = useState({ name: "", gender: "Male", lga: "", profession: "" });
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
            setForm({ name: "", gender: "Male", lga: "", profession: "" });
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
                        <Select
                            label="LGA *"
                            value={form.lga}
                            onChange={(e) => setForm({ ...form, lga: e.target.value })}
                            options={[
                                { label: "Select LGA", value: "" },
                                ...mentorLGAs.map((l) => ({ label: l, value: l })),
                            ]}
                            required
                        />
                        <Input
                            label="Profession"
                            value={form.profession}
                            onChange={(e) => setForm({ ...form, profession: e.target.value })}
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

/* ─── Edit Fellow Modal ─────────────────── */
function EditFellowModal({
    open,
    onClose,
    onUpdated,
    fellow,
    mentorLGAs,
}: {
    open: boolean;
    onClose: () => void;
    onUpdated: () => void;
    fellow: Fellow | null;
    mentorLGAs: string[];
}) {
    const [form, setForm] = useState({ name: "", gender: "Male", lga: "", profession: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (fellow) {
            setForm({
                name: fellow.name,
                gender: fellow.gender,
                lga: fellow.lga,
                profession: fellow.profession || "",
            });
        }
    }, [fellow, open]);

    if (!open || !fellow) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.fellows.update(fellow._id, form);
            onUpdated();
            onClose();
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
                        <h2 className="text-lg font-semibold">Edit Fellow</h2>
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
                        <Select
                            label="LGA *"
                            value={form.lga}
                            onChange={(e) => setForm({ ...form, lga: e.target.value })}
                            options={[
                                { label: "Select LGA", value: "" },
                                ...mentorLGAs.map((l) => ({ label: l, value: l })),
                            ]}
                            required
                        />
                        <Input
                            label="Profession"
                            value={form.profession}
                            onChange={(e) => setForm({ ...form, profession: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 px-6 pb-6">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving…" : "Save Changes"}
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
    const role = session?.user?.role;
    const [fellows, setFellows] = useState<Fellow[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editingFellow, setEditingFellow] = useState<Fellow | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [mentorLGAs, setMentorLGAs] = useState<string[]>([]);

    const LIMIT = 20;

    // Fetch mentor's assigned LGAs
    useEffect(() => {
        async function fetchMentorLGAs() {
            try {
                const res = await fetch("/api/profile");
                const json = await res.json();
                if (json.roleDetails?.lgas) {
                    setMentorLGAs(json.roleDetails.lgas as string[]);
                }
            } catch {
                // ignore
            }
        }
        fetchMentorLGAs();
    }, []);

    const fetchFellows = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
            if (search) params.search = search;
            const result = await api.fellows.list(params);
            setFellows(result.data);
            setTotal(result.pagination.total);
            setTotalPages(result.pagination.totalPages);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchFellows();
    }, [fetchFellows]);

    // Reset to page 1 when search changes
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const handleClearSearch = () => {
        setSearchInput("");
        setSearch("");
        setPage(1);
    };

    // Mentors + Admins + ME Officers + Desk Officers only
    const isReadOnly = role === UserRole.ME_OFFICER || role === UserRole.ZONAL_DESK_OFFICER;
    if (session?.user && session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.ME_OFFICER && session.user.role !== UserRole.ZONAL_DESK_OFFICER) {
        return (
            <div className="p-12 text-center text-gray-500">
                You do not have permission to view this page. Fellows are managed directly by Mentors.
            </div>
        );
    }

    const canWrite = role === UserRole.MENTOR || role === UserRole.ADMIN;

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this fellow?")) return;
        try {
            await api.fellows.delete(id);
            fetchFellows();
        } catch {
            alert("Failed to delete fellow");
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = fellows.map((f) => f._id);
            setSelectedIds(allIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds((prev) => [...prev, id]);
        } else {
            setSelectedIds((prev) => prev.filter((item) => item !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} fellow(s)? This action cannot be undone.`)) return;

        setIsDeletingBulk(true);
        try {
            await api.fellows.bulkDelete({ ids: selectedIds });
            setSelectedIds([]);
            fetchFellows();
        } catch (error) {
            alert(`Failed to delete: ${(error as Error).message}`);
        } finally {
            setIsDeletingBulk(false);
        }
    };


    return (
        <>
            <Header
                title={role === UserRole.ADMIN || role === UserRole.ME_OFFICER ? "Fellows" : "My Fellows"}
                subtitle={
                    role === UserRole.ADMIN || role === UserRole.ME_OFFICER
                        ? `${role === UserRole.ME_OFFICER ? "Viewing" : "Managing"} ${total} fellow${total === 1 ? "" : "s"}`
                        : `Managing ${total} assigned fellow${total === 1 ? "" : "s"}`
                }
            />

            <div className="p-6 space-y-4">
                {/* Search bar */}
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or LGA…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-9 pr-4 h-10 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                    </div>
                    <Button type="submit" size="sm" variant="outline">Search</Button>
                    {search && (
                        <Button type="button" size="sm" variant="ghost" onClick={handleClearSearch}>Clear</Button>
                    )}
                </form>

                <Card>
                    <CardContent className="pt-4 flex justify-between items-center">
                        <div className="text-sm text-gray-600 max-w-2xl">
                            {role === UserRole.ME_OFFICER
                                ? "View fellows and their details here. You have read-only access."
                                : role === UserRole.ADMIN
                                ? "View and manage fellows here."
                                : "Keep track of your assigned mentees here. You can also securely manage their documents."}
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
                                        Profession: f.profession || "",
                                    }));
                                    exportToCSV(data, role === UserRole.ADMIN || role === UserRole.ME_OFFICER ? "fellows" : "my-fellows");
                                }}
                            >
                                <FileDown className="h-4 w-4 mr-1" /> Export CSV
                            </Button>
                            {canWrite && selectedIds.length > 0 && (
                                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                                </Button>
                            )}
                            {role === UserRole.MENTOR && (
                                <Button size="sm" onClick={() => setShowAdd(true)}>
                                    <Plus className="h-4 w-4 mr-1" /> Add Fellow
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                {!isReadOnly && (
                                <th className="px-4 py-3 font-medium text-gray-600 w-10">
                                    {canWrite && (
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={fellows.length > 0 && selectedIds.length === fellows.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                    )}
                                </th>
                                )}
                                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Gender</th>
                                <th className="px-4 py-3 font-medium text-gray-600">LGA</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Profession</th>

                                {canWrite && (
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 4 : 6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                                </tr>
                            ) : !fellows.length ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 4 : 6} className="px-4 py-8 text-center text-gray-400">No fellows added yet.</td>
                                </tr>
                            ) : (
                                fellows.map((f) => (
                                    <tr key={f._id} className="hover:bg-gray-50">
                                        {!isReadOnly && (
                                        <td className="px-4 py-3">
                                            {canWrite && (
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300"
                                                checked={selectedIds.includes(f._id)}
                                                onChange={(e) => handleSelectOne(f._id, e.target.checked)}
                                            />
                                            )}
                                        </td>
                                        )}
                                        <td className="px-4 py-3 font-medium">{f.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.gender}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.lga}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.profession || "—"}</td>

                                        {canWrite && (
                                        <td className="px-4 py-3 text-right space-x-2">
                                            {session?.user?.role === UserRole.MENTOR && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingFellow(f);
                                                            setShowEdit(true);
                                                        }}
                                                        title="Edit Fellow"
                                                    >
                                                        <Pencil className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Link href={`/fellows/${f._id}/documents/upload`}>
                                                        <Button variant="secondary" size="sm">
                                                            <FileUp className="h-3 w-3 mr-1" /> Documents
                                                        </Button>
                                                    </Link>
                                                </>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(f._id)}
                                            >
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>
                            Page {page} of {totalPages} &mdash; {total} fellow{total === 1 ? "" : "s"}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>


            <AddFellowModal
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onAdded={fetchFellows}
                mentorLGAs={mentorLGAs}
            />
            <EditFellowModal
                open={showEdit}
                onClose={() => { setShowEdit(false); setEditingFellow(null); }}
                onUpdated={fetchFellows}
                fellow={editingFellow}
                mentorLGAs={mentorLGAs}
            />
        </>
    );
}
