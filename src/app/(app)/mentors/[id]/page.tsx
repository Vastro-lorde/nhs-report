"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, type Mentor } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Key } from "lucide-react";
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
        if (user?.role === "admin" || user?.role === "coordinator") {
            fetchMentor();
        }
    }, [fetchMentor, user]);

    if (user?.role !== "admin" && user?.role !== "coordinator") {
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
                                    <p className="text-sm">{mentor.state || "—"}</p>
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

                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                            </CardContent>
                        </Card>
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
        </>
    );
}
