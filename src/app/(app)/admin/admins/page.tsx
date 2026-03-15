/* ──────────────────────────────────────────
   Admins Management Page (admin)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type Admin } from "@/lib/api-client";
import { Plus, UserCheck, UserX, ChevronLeft, ChevronRight, KeyRound, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { useSession } from "next-auth/react";

/* ─── Create/Update Admin Modal ──── */
function AdminModal({
    open,
    onClose,
    onSuccess,
    admin,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    admin: Admin | null;
}) {
    const { data: session } = useSession();
    const isRootAdmin = session?.user?.rootAdmin;
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        phone: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (admin) {
            setForm({
                name: admin.name,
                email: admin.email,
                password: "", // don't show password on edit
                phone: admin.phone || "",
            });
        } else {
            setForm({ name: "", email: "", password: "", phone: "" });
        }
    }, [admin, open]);

    if (!open) return null;

    const isSystemRootAdmin = admin && admin.rootAdmin;
    const isDisabled = !!(isSystemRootAdmin && !isRootAdmin);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (isDisabled) {
            setError("You do not have permission to modify a root administrator.");
            return;
        }

        setLoading(true);

        try {
            if (admin) {
                // Update Mode
                await api.admins.update(admin._id, {
                    name: form.name,
                    phone: form.phone,
                });
            } else {
                // Create Mode
                if (!form.password) throw new Error("Password is required for new admins.");

                await api.admins.create({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    phone: form.phone,
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
                        <h2 className="text-lg font-semibold">{admin ? "Edit Administrator" : "Add New Administrator"}</h2>
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
                        )}
                        {isDisabled && (
                            <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                You are viewing a root administrator in read-only mode because you lack sufficient privileges to edit it.
                            </p>
                        )}
                        <Input
                            label="Full Name *"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            disabled={isDisabled}
                        />
                        <Input
                            id="email"
                            label="Email *"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                            disabled={!!admin || isDisabled} // Never edit email once created
                        />
                        {!admin && (
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
                            disabled={isDisabled}
                        />
                    </div>
                    <div className="flex justify-end gap-3 px-6 pb-6">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        {!isDisabled && (
                            <Button type="submit" disabled={loading}>
                                {loading ? "Saving…" : (admin ? "Save Changes" : "Create Administrator")}
                            </Button>
                        )}
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
    adminId,
}: {
    open: boolean;
    onClose: () => void;
    adminId: string;
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
            await api.admins.resetPassword(adminId, password);
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
export default function AdminsPage() {
    const { data: session } = useSession();
    const isRootAdmin = session?.user?.rootAdmin;
    const currentUserId = session?.user?.id;

    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

    const [showResetModal, setShowResetModal] = useState(false);
    const [resetAdminId, setResetAdminId] = useState("");

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: "20" };
            if (search) params.search = search;
            const result = await api.admins.list(params);
            setAdmins(result.data);
            setTotalPages(result.pagination.totalPages);
            setTotal(result.pagination.total);
        } catch {
            /* no-op */
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    const toggleActive = async (admin: Admin) => {
        if (admin.rootAdmin && !isRootAdmin) {
            alert("Forbidden: Cannot deactivate a root administrator.");
            return;
        }

        try {
            if (admin.active) {
                await api.admins.deactivate(admin._id);
            } else {
                await api.admins.update(admin._id, { active: true });
            }
            fetchAdmins();
        } catch {
            /* no-op */
        }
    };

    const openEdit = (admin: Admin) => {
        setSelectedAdmin(admin);
        setShowModal(true);
    };

    const openCreate = () => {
        setSelectedAdmin(null);
        setShowModal(true);
    };

    const openReset = (admin: Admin) => {
        if (admin.rootAdmin && !isRootAdmin) {
            alert("Forbidden: Cannot reset the password of a root administrator.");
            return;
        }
        setResetAdminId(admin._id);
        setShowResetModal(true);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // Unconditionally allow selecting, but the backend will filter deletions if needed
            const allIds = admins.map(a => a._id);
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
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} admin(s)? This action cannot be undone.`)) return;

        setIsDeletingBulk(true);
        try {
            const result = await api.admins.bulkDelete({ ids: selectedIds });
            setSelectedIds([]);
            fetchAdmins();
            if (result.message) {
                alert(result.message);
            }
        } catch (error) {
            alert(`Failed to delete: ${(error as Error).message}`);
        } finally {
            setIsDeletingBulk(false);
        }
    };

    return (
        <>
            <Header title="Administrators" subtitle={`${total} total administrator${total === 1 ? '' : 's'}`} />

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
                                <Plus className="h-4 w-4 mr-1" /> Add Administrator
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
                                        checked={admins.length > 0 && selectedIds.length === admins.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Role</th>
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
                            ) : !admins.length ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        No administrators found.
                                    </td>
                                </tr>
                            ) : (
                                admins.map((a) => {
                                    const isSelf = currentUserId === a._id;
                                    const cannotModify = a.rootAdmin && !isRootAdmin;

                                    return (
                                        <tr key={a._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300"
                                                    checked={selectedIds.includes(a._id)}
                                                    onChange={(e) => handleSelectOne(a._id, e.target.checked)}
                                                    disabled={isSelf || cannotModify}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                                                {a.name}
                                                {isSelf && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">You</span>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{a.email}</td>
                                            <td className="px-4 py-3">{a.phone || "—"}</td>
                                            <td className="px-4 py-3">
                                                {a.rootAdmin ? (
                                                    <Badge variant="default" className="bg-purple-600 gap-1 hover:bg-purple-700">
                                                        <ShieldAlert className="w-3 h-3" /> Root Admin
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-gray-600">Admin</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={a.active ? "default" : "warning" as any}>
                                                    {a.active ? "Active" : "Suspended"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(a)}
                                                    title={cannotModify ? "View Details" : "Edit Details"}
                                                >
                                                    <Pencil className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openReset(a)}
                                                    title="Reset Password"
                                                    disabled={cannotModify}
                                                >
                                                    <KeyRound className="h-4 w-4 text-gray-600 hover:text-gray-900" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleActive(a)}
                                                    title={a.active ? "Suspend" : "Activate"}
                                                    disabled={isSelf || cannotModify}
                                                >
                                                    {a.active ? (
                                                        <UserX className="h-4 w-4 text-red-500 hover:text-red-700" />
                                                    ) : (
                                                        <UserCheck className="h-4 w-4 text-orange-600 hover:text-orange-800" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
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

            <AdminModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchAdmins}
                admin={selectedAdmin}
            />

            <ResetPasswordModal
                open={showResetModal}
                onClose={() => setShowResetModal(false)}
                adminId={resetAdminId}
            />
        </>
    );
}
