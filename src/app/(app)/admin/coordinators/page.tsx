/* ──────────────────────────────────────────
   Coordinators Management Page (admin)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type Coordinator } from "@/lib/api-client";
import { Plus, UserCheck, UserX, ChevronLeft, ChevronRight, KeyRound, Pencil, Trash2, AtSign } from "lucide-react";

/* ─── Create/Update Coordinator Modal ──── */
function CoordinatorModal({
    open,
    onClose,
    onSuccess,
    coordinator,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    coordinator: Coordinator | null;
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
        if (coordinator) {
            setForm({
                name: coordinator.name,
                email: coordinator.email,
                password: "", // don't show password on edit
                phone: coordinator.phone || "",
                states: coordinator.states || [],
            });
        } else {
            setForm({ name: "", email: "", password: "", phone: "", states: [] });
        }
    }, [coordinator, open]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const statesArray = form.states;

            if (coordinator) {
                // Update Mode
                await api.coordinators.update(coordinator._id, {
                    name: form.name,
                    phone: form.phone,
                    states: statesArray,
                });
            } else {
                // Create Mode
                if (!form.password) throw new Error("Password is required for new coordinators.");

                await api.coordinators.create({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    phone: form.phone,
                    states: statesArray,
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold">{coordinator ? "Edit Coordinator" : "Add New Coordinator"}</h2>
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
                            disabled={Boolean(coordinator)}
                        />
                        {coordinator && (
                            <p className="text-xs text-gray-500">
                                To change a coordinator's login email, use the “Change Email” action. This will reset their password and email a temporary password to the new address.
                            </p>
                        )}
                        {!coordinator && (
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
                            <label className="block text-sm font-medium text-gray-700">Zones Managed *</label>
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
                            {loading ? "Saving…" : (coordinator ? "Save Changes" : "Create Coordinator")}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Change Email Modal ─────────────── */
function ChangeEmailModal({
    open,
    onClose,
    coordinator,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    coordinator: Coordinator | null;
    onSuccess: () => void;
}) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (open && coordinator) {
            setEmail(coordinator.email || "");
        }
        if (!open) {
            setError("");
            setSuccess(false);
            setLoading(false);
        }
    }, [open, coordinator]);

    if (!open || !coordinator) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.coordinators.changeEmail(coordinator._id, email);
            setSuccess(true);
            onSuccess();
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
                {success ? (
                    <div className="p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-semibold text-orange-700">Email Updated</h2>
                        <p className="text-sm text-gray-600">
                            A temporary password was sent to the new email.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Change Login Email</h2>
                            <p className="text-sm text-gray-600">
                                This will reset the coordinator's password and send a temporary password to the new email.
                            </p>
                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
                            )}
                            <Input
                                label="New Email *"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-6">
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Updating…" : "Change Email"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/* ─── Reset Password Modal ─────────────── */
function ResetPasswordModal({
    open,
    onClose,
    coordinatorId,
}: {
    open: boolean;
    onClose: () => void;
    coordinatorId: string;
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
            await api.coordinators.resetPassword(coordinatorId, password);
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
                {success ? (
                    <div className="p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-semibold text-orange-700">Password Reset Successful!</h2>
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
export default function CoordinatorsPage() {
    const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [selectedCoord, setSelectedCoord] = useState<Coordinator | null>(null);

    const [showResetModal, setShowResetModal] = useState(false);
    const [resetCoordId, setResetCoordId] = useState("");

    const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
    const [changeEmailCoordinator, setChangeEmailCoordinator] = useState<Coordinator | null>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const fetchCoordinators = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: "20" };
            if (search) params.search = search;
            const result = await api.coordinators.list(params);
            setCoordinators(result.data);
            setTotalPages(result.pagination.totalPages);
            setTotal(result.pagination.total);
        } catch {
            /* no-op */
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchCoordinators();
    }, [fetchCoordinators]);

    const toggleActive = async (coord: Coordinator) => {
        try {
            if (coord.active) {
                await api.coordinators.deactivate(coord._id);
            } else {
                await api.coordinators.update(coord._id, { active: true });
            }
            fetchCoordinators();
        } catch {
            /* no-op */
        }
    };

    const openEdit = (coord: Coordinator) => {
        setSelectedCoord(coord);
        setShowModal(true);
    };

    const openCreate = () => {
        setSelectedCoord(null);
        setShowModal(true);
    };

    const openReset = (id: string) => {
        setResetCoordId(id);
        setShowResetModal(true);
    };

    const openChangeEmail = (coord: Coordinator) => {
        setChangeEmailCoordinator(coord);
        setShowChangeEmailModal(true);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = coordinators.map(c => c._id);
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
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} coordinator(s)? This action cannot be undone.`)) return;

        setIsDeletingBulk(true);
        try {
            await api.coordinators.bulkDelete({ ids: selectedIds });
            setSelectedIds([]);
            fetchCoordinators();
        } catch (error) {
            alert(`Failed to delete: ${(error as Error).message}`);
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const handlePermanentDelete = async (c: Coordinator) => {
        if (!window.confirm(`Permanently delete ${c.name}? This cannot be undone. The coordinator must have no mentors assigned.`)) return;
        try {
            await api.coordinators.permanentDelete(c._id);
            fetchCoordinators();
        } catch (err) {
            alert(`Failed to permanently delete: ${(err as Error).message}`);
        }
    };

    return (
        <>
            <Header title="Zonal Coordinators" subtitle={`${total} total coordinator${total === 1 ? '' : 's'}`} />

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
                                className="w-full sm:w-60"
                            />
                            <div className="flex-1"></div>
                            {selectedIds.length > 0 && (
                                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                                </Button>
                            )}
                            <Button size="sm" onClick={openCreate}>
                                <Plus className="h-4 w-4 mr-1" /> Add Coordinator
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
                                        checked={coordinators.length > 0 && selectedIds.length === coordinators.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Phone</th>
                                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Zones Managed</th>
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
                            ) : !coordinators.length ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        No coordinators found.
                                    </td>
                                </tr>
                            ) : (
                                coordinators.map((c) => (
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
                                        <td className="px-4 py-3 hidden sm:table-cell">{c.phone || "—"}</td>
                                        <td className="px-4 py-3 text-gray-600 wrap-break-word max-w-xs hidden sm:table-cell">{c.states?.join(", ") || "—"}</td>
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
                                                onClick={() => openChangeEmail(c)}
                                                title="Change Email"
                                            >
                                                <AtSign className="h-4 w-4 text-gray-600" />
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
                                                    <UserCheck className="h-4 w-4 text-orange-600" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handlePermanentDelete(c)}
                                                title="Permanently delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
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

            <CoordinatorModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchCoordinators}
                coordinator={selectedCoord}
            />

            <ResetPasswordModal
                open={showResetModal}
                onClose={() => setShowResetModal(false)}
                coordinatorId={resetCoordId}
            />

            <ChangeEmailModal
                open={showChangeEmailModal}
                onClose={() => {
                    setShowChangeEmailModal(false);
                    setChangeEmailCoordinator(null);
                }}
                coordinator={changeEmailCoordinator}
                onSuccess={fetchCoordinators}
            />
        </>
    );
}
