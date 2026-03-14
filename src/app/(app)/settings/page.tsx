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
import { DebugSeeder } from "@/components/ui/DebugSeeder";
import { faker } from "@faker-js/faker";
import { useEffect } from "react";
import Image from "next/image";
import { UserRole } from "@/lib/constants";

interface RoleDetails {
  states?: string[];
  lgas?: string[];
  coordinatorName?: string;
  coordinatorEmail?: string;
  createdAt?: string;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone?: string;
  state?: string;
  profileImage?: string;
  createdAt: string;
  rootAdmin?: boolean;
  roleDetails?: RoleDetails | null;
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState(session?.user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name || session?.user?.name || "");
          setPhone(data.phone || "");
          if (data.profileImage) setImagePreview(data.profileImage);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [session?.user?.name]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let uploadedImageUrl: string | undefined = undefined;

      // 1. Upload image if selected
      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json();
          throw new Error(uploadErr.error || "Failed to upload image.");
        }
        const uploadData = await uploadRes.json();
        uploadedImageUrl = uploadData.url;
      }

      // 2. Save profile updates
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          profileImage: uploadedImageUrl || profile?.profileImage || undefined
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update profile");
      }
      const updatedProfile = await res.json();
      setProfile(updatedProfile);

      await update(); // Force refresh the next-auth session to update layout elements
      setMessage("Profile updated.");
      setSelectedImage(null);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create local preview immediately
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
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
      const res = await fetch("/api/profile/password", {
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
            {isLoadingProfile ? (
              <p className="text-sm text-gray-500">Loading profile details...</p>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="h-24 w-24 rounded-full bg-gray-200 overflow-hidden relative border">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Profile picture"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-gray-400 text-2xl font-bold">
                        {profile?.name?.charAt(0) || session?.user?.name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm flex-1">
                  <div>
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium">{profile?.name ?? session?.user?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium">{profile?.email ?? session?.user?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Role</dt>
                    <dd>
                      <Badge>{profile?.role ?? session?.user?.role ?? "—"}</Badge>
                    </dd>
                  </div>
                  {(profile?.state || session?.user?.state) && (
                    <div>
                      <dt className="text-gray-500">State / Region</dt>
                      <dd className="font-medium">{profile?.state ?? session?.user?.state ?? "—"}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="font-medium">{profile?.phone ?? "—"}</dd>
                  </div>
                  {profile?.createdAt && (
                    <div>
                      <dt className="text-gray-500">Member Since</dt>
                      <dd className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role details */}
        {profile && profile.roleDetails && (
          <Card>
            <CardHeader>
              <CardTitle>
                {profile.role === UserRole.MENTOR && "Mentor Details"}
                {profile.role === UserRole.COORDINATOR && "Coordinator Details"}
                {profile.role === UserRole.ZONAL_DESK_OFFICER && "Desk Officer Details"}
                {profile.role === UserRole.ME_OFFICER && "M&E Officer Details"}
                {profile.role === UserRole.TEAM_RESEARCH_LEAD && "Team Research Lead Details"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {profile.role === UserRole.MENTOR && profile.roleDetails.coordinatorName && (
                  <div>
                    <dt className="text-gray-500">Assigned Coordinator</dt>
                    <dd className="font-medium">{profile.roleDetails.coordinatorName}</dd>
                    {profile.roleDetails.coordinatorEmail && (
                      <dd className="text-xs text-gray-400">{profile.roleDetails.coordinatorEmail}</dd>
                    )}
                  </div>
                )}
                {profile.roleDetails.states && profile.roleDetails.states.length > 0 && (
                  <div className={profile.role === UserRole.MENTOR ? "" : "md:col-span-2"}>
                    <dt className="text-gray-500">Assigned State{profile.roleDetails.states.length > 1 ? "s" : ""}</dt>
                    <dd className="font-medium flex flex-wrap gap-1 mt-1">
                      {profile.roleDetails.states.map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </dd>
                  </div>
                )}
                {profile.role === UserRole.MENTOR && profile.roleDetails.lgas && profile.roleDetails.lgas.length > 0 && (
                  <div className="md:col-span-2">
                    <dt className="text-gray-500">Assigned LGA{profile.roleDetails.lgas.length > 1 ? "s" : ""}</dt>
                    <dd className="font-medium flex flex-wrap gap-1 mt-1">
                      {profile.roleDetails.lgas.map((l) => (
                        <Badge key={l} variant="secondary">{l}</Badge>
                      ))}
                    </dd>
                  </div>
                )}
                {profile.roleDetails.createdAt && (
                  <div>
                    <dt className="text-gray-500">Role Assigned On</dt>
                    <dd className="font-medium">{new Date(profile.roleDetails.createdAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Admin details */}
        {profile && profile.role === UserRole.ADMIN && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Admin Level</dt>
                  <dd className="font-medium">
                    <Badge variant={profile.rootAdmin ? "default" : "secondary"}>
                      {profile.rootAdmin ? "Root Admin" : "Admin"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Account Status</dt>
                  <dd className="font-medium">
                    <Badge variant="default">Active</Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Update profile */}
        <Card>
          <CardHeader>
            <CardTitle>Update Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">Profile Picture</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageSelect}
                  className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
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
            <form onSubmit={handlePasswordChange} className="space-y-4" suppressHydrationWarning>
              <Input
                label="Current Password"
                name="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                suppressHydrationWarning
              />
              <Input
                label="New Password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                suppressHydrationWarning
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Changing…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <DebugSeeder
        label="Prefill Profile/Password Forms (Fake Data)"
        onFill={() => {
          // Fill profile updates
          setName(faker.person.fullName());
          setPhone(faker.phone.number());

          // Fill password updates
          setCurrentPassword("admin123");
          setNewPassword(faker.internet.password({ length: 8 }));
        }}
      />
    </>
  );
}
