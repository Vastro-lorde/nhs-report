/* ──────────────────────────────────────────
   M&E Officers Management Page (admin)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type MEOfficer } from "@/lib/api-client";
import { Plus, UserCheck, UserX, ChevronLeft, ChevronRight, KeyRound, Pencil, Trash2 } from "lucide-react";

/* ─── Create/Update M&E Officer Modal ──── */
function MEOfficerModal({
    open,
    onClose,
    onSuccess,
    meOfficer,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    meOfficer: MEOfficer | null;
}) {
    const [form, setForm] = useState<{ name: string, email: string, password: string, phone: string, states: string[] }>({
        name: "",
        email: "",
        password: "",
        phone: "",
        states: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (meOfficer) {
            setForm({
                name: meOfficer.name,
                email: meOfficer.email,
                password: "",
                phone: meOfficer.phone || "",
                states: meOfficer.states || [],
            });
        } else {
            setForm({ name: "", email: "", password: "", phone: "", states: [] });
        }
    }, [meOfficer, open]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (meOfficer) {
                await api.meOfficers.update(meOfficer._id, {
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    states: form.states,
                });
            } else {
                if (!form.password) throw new Error("Password is required for new M&E officers.");

                await api.meOfficers.create({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    phone: form.phone,
                    states: form.states,
                });
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold">{meOfficer ? "Edit M&E Officer" : "Add New M&E Officer"}</h2>
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
                        )}
                        <Input
                            label="Full Name *"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                        <Input
                            id="email"
                            label="Email *"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                        {!meOfficer && (
                            <Input
                                label="Password *"
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                minLength={6}
                            />
                        )}
                        <Input
                            label="Phone"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">Zones Supervised</label>
                            <LocationSelector
                                selectedStates={form.states}
                                onChangeStates={(states) => setForm({ ...form, states })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 px-6 pb-6">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving…" : (meOfficer ? "Save Changes" : "Create M&E Officer")}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Reset Password Modal ─────────────── */
function ResetPasswordModal({
    open,
    onClose,
    meOfficerId,
}: {
    open: boolean;
    onClose: () => void;
    meOfficerId: string;
}) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.meOfficers.resetPassword(meOfficerId, password);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setPassword("");
                onClose();
            }, 2000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
                {success ? (
                    <div className="p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-semibold text-green-700">Password Reset Successful!</h2>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Reset Password</h2>
                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
                            )}
                            <Input
                                label="New Password *"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-6">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Resetting…" : "Reset Password"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/* ─── Main Page ────────────────────────── */
export default function MEOfficersPage() {
    const [meOfficers, setMEOfficers] = useState<MEOfficer[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [selectedOfficer, setSelectedOfficer] = useState<MEOfficer | null>(null);

    const [showResetModal, setShowResetModal] = useState(false);
    const [resetOfficerId, setResetOfficerId] = useState("");

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const fetchMEOfficers = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: "20" };
            if (search) params.search = search;
            const result = await api.meOfficers.list(params);
            setMEOfficers(result.data);
            setTotalPages(result.pagination.totalPages);
            setTotal(result.pagination.total);
        } catch {
            /* no-op */
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchMEOfficers();
    }, [fetchMEOfficers]);

    const toggleActive = async (officer: MEOfficer) => {
        try {
            if (officer.active) {
                await api.meOfficers.deactivate(officer._id);
            } else {
                await api.meOfficers.update(officer._id, { active: true });
            }
            fetchMEOfficers();
        } catch {
            /* no-op */
        }
    };

    const openEdit = (officer: MEOfficer) => {
        setSelectedOfficer(officer);
        setShowModal(true);
    };

    const openCreate = () => {
        setSelectedOfficer(null);
        setShowModal(true);
    };

    const openReset = (id: string) => {
        setResetOfficerId(id);
        setShowResetModal(true);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = meOfficers.map(c => c._id);
            setSelectedIds(allIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} M&E officer(s)? This action cannot be undone.`)) return;

        setIsDeletingBulk(true);
        try {
            await api.meOfficers.bulkDelete({ ids: selectedIds });
            setSelectedIds([]);
            fetchMEOfficers();
        } catch (error) {
            alert(`Failed to delete: ${(error as Error).message}`);
        } finally {
            setIsDeletingBulk(false);
        }
    };

    return (
        <>
            <Header title="M&E Officers" subtitle={`${total} total M&E officer${total === 1 ? '' : 's'}`} />

            <div className="p-6 space-y-4">
                {/* Filters */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <Input
                                label="Search"
                                placeholder="Name or email…"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="w-60"
                            />
                            <div className="flex-1"></div>
                            {selectedIds.length > 0 && (
                                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                                </Button>
                            )}
                            <Button size="sm" onClick={openCreate}>
                                <Plus className="h-4 w-4 mr-1" /> Add M&E Officer
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={meOfficers.length > 0 && selectedIds.length === meOfficers.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Zones Supervised</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        Loading…
                                    </td>
                                </tr>
                            ) : !meOfficers.length ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        No M&E officers found.
                                    </td>
                                </tr>
                            ) : (
                                meOfficers.map((c) => (
                                    <tr key={c._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300"
                                                checked={selectedIds.includes(c._id)}
                                                onChange={(e) => handleSelectOne(c._id, e.target.checked)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-medium">{c.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{c.email}</td>
                                        <td className="px-4 py-3">{c.phone || "—"}</td>
                                        <td className="px-4 py-3 text-gray-600 break-words max-w-xs">{c.states?.join(", ") || "—"}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={c.active ? "default" : "warning"}>
                                                {c.active ? "Active" : "Suspended"}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(c)}
                                                title="Edit Details"
                                            >
                                                <Pencil className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openReset(c._id)}
                                                title="Reset Password"
                                            >
                                                <KeyRound className="h-4 w-4 text-gray-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleActive(c)}
                                                title={c.active ? "Suspend" : "Activate"}
                                            >
                                                {c.active ? (
                                                    <UserX className="h-4 w-4 text-red-500" />
                                                ) : (
                                                    <UserCheck className="h-4 w-4 text-green-600" />
                                                )}
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
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <MEOfficerModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchMEOfficers}
                meOfficer={selectedOfficer}
            />

            <ResetPasswordModal
                open={showResetModal}
                onClose={() => setShowResetModal(false)}
                meOfficerId={resetOfficerId}
            />
        </>
    );
}
