"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, type Mentor } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { ArrowLeft, Key, AtSign, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";

export default function MentorDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { data: session } = useSession();
    const user = session?.user;
    const router = useRouter();
    const { id } = use(params);

    const [mentor, setMentor] = useState<Mentor | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState("");
    const [resetSuccess, setResetSuccess] = useState("");

    const [changeEmailOpen, setChangeEmailOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [changingEmail, setChangingEmail] = useState(false);
    const [changeEmailError, setChangeEmailError] = useState("");
    const [changeEmailSuccess, setChangeEmailSuccess] = useState("");

    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", states: [] as string[], lgas: [] as string[] });
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState("");
    const [editSuccess, setEditSuccess] = useState("");

    const fetchMentor = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await api.mentors.get(id);
            setMentor(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (user?.role === "admin" || user?.role === "coordinator" || user?.role === "me_officer" || user?.role === "team_research_lead") {
            fetchMentor();
        }
    }, [fetchMentor, user]);

    if (user?.role !== "admin" && user?.role !== "coordinator" && user?.role !== "me_officer" && user?.role !== "team_research_lead") {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setResetError("Password must be at least 6 characters.");
            return;
        }
        setResetting(true);
        setResetError("");
        setResetSuccess("");
        try {
            await api.mentors.resetPassword(id, newPassword);
            setResetSuccess("Password reset successfully.");
            setTimeout(() => {
                setResetModalOpen(false);
                setNewPassword("");
                setResetSuccess("");
            }, 2000);
        } catch (err) {
            setResetError((err as Error).message);
        } finally {
            setResetting(false);
        }
    };

    const handleChangeEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setChangingEmail(true);
        setChangeEmailError("");
        setChangeEmailSuccess("");
        try {
            await api.mentors.changeEmail(id, newEmail);
            setChangeEmailSuccess("Email updated. A temporary password was sent to the new email.");
            await fetchMentor();
            setTimeout(() => {
                setChangeEmailOpen(false);
                setNewEmail("");
                setChangeEmailSuccess("");
            }, 2000);
        } catch (err) {
            setChangeEmailError((err as Error).message);
        } finally {
            setChangingEmail(false);
        }
    };

    const openEditModal = () => {
        if (mentor) {
            setEditForm({
                name: mentor.name,
                states: mentor.states || [],
                lgas: mentor.lgas || [],
            });
            setEditError("");
            setEditSuccess("");
            setEditOpen(true);
        }
    };

    const handleEditProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm.name.trim()) {
            setEditError("Name is required.");
            return;
        }
        setSaving(true);
        setEditError("");
        setEditSuccess("");
        try {
            await api.mentors.update(id, {
                name: editForm.name.trim(),
                states: editForm.states,
                lgas: editForm.lgas,
            });
            setEditSuccess("Profile updated successfully.");
            await fetchMentor();
            setTimeout(() => {
                setEditOpen(false);
                setEditSuccess("");
            }, 1500);
        } catch (err) {
            setEditError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Header title="Mentor Details" subtitle="View details and manage access" />

            <div className="p-6 space-y-4 max-w-4xl mx-auto">
                <Button variant="ghost" onClick={() => router.push("/mentors")} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Mentors
                </Button>

                {loading ? (
                    <p className="text-gray-500">Loading details...</p>
                ) : error ? (
                    <p className="text-red-600">{error}</p>
                ) : mentor ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Name</label>
                                    <p className="text-sm">{mentor.name}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Email</label>
                                    <p className="text-sm">{mentor.email}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Phone</label>
                                    <p className="text-sm">{mentor.phone || "—"}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">State</label>
                                    <p className="text-sm">{mentor.states?.join(", ") || "—"}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500">LGAs</label>
                                    <p className="text-sm">{mentor.lgas?.join(", ") || "—"}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 text-block mb-1">Status</label>
                                    <div>
                                        <Badge variant={mentor.active ? "default" : "warning"}>
                                            {mentor.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {(user?.role === "admin" || user?.role === "coordinator") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {user?.role === "admin" && (
                                    <div>
                                        <Button onClick={openEditModal} variant="secondary" className="w-full justify-start">
                                            <Pencil className="h-4 w-4 mr-2" /> Edit Profile
                                        </Button>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Update the mentor&apos;s name, assigned states, and LGAs.
                                        </p>
                                    </div>
                                )}
                                {user?.role === "admin" && (
                                    <div>
                                        <Button onClick={() => setResetModalOpen(true)} variant="secondary" className="w-full justify-start">
                                            <Key className="h-4 w-4 mr-2" /> Reset Password
                                        </Button>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Forcefully change the password for this mentor. They will be required to use the new password to log in.
                                        </p>
                                    </div>
                                )}
                                {user?.role === "admin" && (
                                    <div>
                                        <Button
                                            onClick={() => {
                                                setNewEmail(mentor?.email || "");
                                                setChangeEmailOpen(true);
                                            }}
                                            variant="secondary"
                                            className="w-full justify-start"
                                        >
                                            <AtSign className="h-4 w-4 mr-2" /> Change Email
                                        </Button>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Updates the mentor's login email, resets their password to a temporary one, and sends it to the new email.
                                        </p>
                                    </div>
                                )}
                                {(user?.role === "admin" || user?.role === "coordinator") && (
                                    <div>
                                        <Button
                                            onClick={() => {
                                                if (mentor) {
                                                    const action = mentor.active ? api.mentors.deactivate(mentor._id) : api.mentors.update(mentor._id, { active: true });
                                                    action.then(() => fetchMentor()).catch(() => {});
                                                }
                                            }}
                                            variant={mentor?.active ? "destructive" : "default"}
                                            className="w-full justify-start"
                                        >
                                            {mentor?.active ? "Deactivate Mentor" : "Activate Mentor"}
                                        </Button>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {mentor?.active
                                                ? "Deactivating will prevent this mentor from logging in or submitting reports."
                                                : "Reactivate this mentor to allow them to log in and submit reports."}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        )}
                    </div>
                ) : null}
            </div>

            {resetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
                        <form onSubmit={handleResetPassword}>
                            <div className="p-6 space-y-4">
                                <h2 className="text-lg font-semibold">Reset Password</h2>
                                <p className="text-sm text-gray-600">Enter a new password for {mentor?.name}.</p>

                                {resetError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{resetError}</p>}
                                {resetSuccess && <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{resetSuccess}</p>}

                                <Input
                                    label="New Password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3 px-6 pb-6">
                                <Button type="button" variant="outline" onClick={() => {
                                    setResetModalOpen(false);
                                    setNewPassword("");
                                    setResetError("");
                                    setResetSuccess("");
                                }} disabled={resetting}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={resetting || newPassword.length < 6}>
                                    {resetting ? "Resetting…" : "Reset Password"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {changeEmailOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
                        <form onSubmit={handleChangeEmail}>
                            <div className="p-6 space-y-4">
                                <h2 className="text-lg font-semibold">Change Email</h2>
                                <p className="text-sm text-gray-600">
                                    This will reset the mentor's password and send a temporary password to the new email.
                                </p>

                                {changeEmailError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{changeEmailError}</p>}
                                {changeEmailSuccess && <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{changeEmailSuccess}</p>}

                                <Input
                                    label="New Email"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3 px-6 pb-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setChangeEmailOpen(false);
                                        setNewEmail("");
                                        setChangeEmailError("");
                                        setChangeEmailSuccess("");
                                    }}
                                    disabled={changingEmail}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={changingEmail}>
                                    {changingEmail ? "Updating…" : "Change Email"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleEditProfile}>
                            <div className="p-6 space-y-4">
                                <h2 className="text-lg font-semibold">Edit Mentor Profile</h2>
                                <p className="text-sm text-gray-600">Update the mentor&apos;s name, states, and LGAs.</p>

                                {editError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{editError}</p>}
                                {editSuccess && <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{editSuccess}</p>}

                                <Input
                                    label="Full Name *"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    required
                                    autoFocus
                                />

                                <LocationSelector
                                    selectedStates={editForm.states}
                                    onChangeStates={(states) => setEditForm({ ...editForm, states, lgas: [] })}
                                    showLgas={true}
                                    selectedLgas={editForm.lgas}
                                    onChangeLgas={(lgas) => setEditForm({ ...editForm, lgas })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 px-6 pb-6">
                                <Button type="button" variant="outline" onClick={() => {
                                    setEditOpen(false);
                                    setEditError("");
                                    setEditSuccess("");
                                }} disabled={saving}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving || !editForm.name.trim()}>
                                    {saving ? "Saving…" : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
