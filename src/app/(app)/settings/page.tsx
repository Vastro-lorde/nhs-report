/* ──────────────────────────────────────────
   Settings Page — profile info & password change
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState(session?.user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mentors/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update profile");
      }
      setMessage("Profile updated.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mentors/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Password change failed");
      }
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Settings" subtitle="Manage your account" />

      <div className="p-6 max-w-2xl space-y-6">
        {message && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{session?.user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Role</dt>
                <dd>
                  <Badge>{session?.user?.role ?? "—"}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">State</dt>
                <dd className="font-medium">{session?.user?.state ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Update profile */}
        <Card>
          <CardHeader>
            <CardTitle>Update Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Changing…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
