/* ──────────────────────────────────────────
   Mentors Management Page  (admin/coordinator)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type Mentor, type Coordinator } from "@/lib/api-client";
import { STATES, UserRole } from "@/lib/constants";
import { Plus, UserCheck, UserX, ChevronLeft, ChevronRight, Download, Upload, Trash2, Bell, ArrowRightLeft } from "lucide-react";
import { DebugSeeder } from "@/components/ui/DebugSeeder";
import { faker } from "@faker-js/faker";
import { exportToCSV } from "@/lib/export";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

/* ─── Reassign Mentor Modal ───────────── */
function ReassignMentorModal({
  open,
  onClose,
  onReassigned,
  mentor,
}: {
  open: boolean;
  onClose: () => void;
  onReassigned: () => void;
  mentor: Mentor | null;
}) {
  const [coordinatorId, setCoordinatorId] = useState("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.coordinators.list({ limit: "500" }).then((res) => setCoordinators(res.data)).catch(() => {});
      setCoordinatorId("");
      setError("");
    }
  }, [open]);

  if (!open || !mentor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordinatorId) { setError("Please select a coordinator."); return; }
    setLoading(true);
    try {
      await api.mentors.reassign(mentor._id, coordinatorId);
      onReassigned();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Reassign Mentor</h2>
            <p className="text-sm text-gray-600">
              Reassigning <strong>{mentor.name}</strong> to a new coordinator.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <SearchableSelect
              label="New Coordinator *"
              placeholder="Search and select coordinator…"
              value={coordinatorId}
              onChange={setCoordinatorId}
              options={coordinators.map((c) => ({ value: c.coordinatorId ?? c._id, label: `${c.name} (${c.email})` }))}
            />
          </div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Reassigning…" : "Reassign"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Create Mentor Modal ──────────────── */
function CreateMentorModal({
  open,
  onClose,
  onCreated,
  userRole,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  userRole?: string;
}) {
  const isAdmin = userRole === UserRole.ADMIN;
  const [form, setForm] = useState<{ name: string, email: string, password: string, phone: string, states: string[], lgas: string[], role: string, coordinatorId: string }>({
    name: "",
    email: "",
    password: "",
    phone: "",
    states: [],
    lgas: [],
    role: UserRole.MENTOR as string,
    coordinatorId: "",
  });
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && isAdmin) {
      api.coordinators.list({ limit: "500" }).then((res) => setCoordinators(res.data)).catch(() => {});
    }
  }, [open, isAdmin]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isAdmin && !form.coordinatorId) {
      setError("Please select a coordinator to assign this mentor to.");
      return;
    }
    setLoading(true);
    try {
      await api.mentors.create({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        states: form.states,
        lgas: form.lgas,
        coordinatorId: isAdmin ? form.coordinatorId : undefined,
      });
      onCreated();
      onClose();
      setForm({ name: "", email: "", password: "", phone: "", states: [], lgas: [], role: UserRole.MENTOR, coordinatorId: "" });
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
            <h2 className="text-lg font-semibold">Add New Mentor</h2>
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
            <Input
              label="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            {isAdmin && (
              <SearchableSelect
                label="Coordinator *"
                placeholder="Search and select coordinator…"
                value={form.coordinatorId}
                onChange={(value) => setForm({ ...form, coordinatorId: value })}
                options={coordinators.map((c) => ({ value: c.coordinatorId ?? c._id, label: `${c.name} (${c.email})` }))}
              />
            )}
            <LocationSelector
              selectedStates={form.states}
              onChangeStates={(states) => setForm({ ...form, states, lgas: [] })}
              showLgas={true}
              selectedLgas={form.lgas}
              onChangeLgas={(lgas) => setForm({ ...form, lgas })}
            />
            <div className="hidden">
              <input type="hidden" name="role" value={form.role} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Mentor"}
            </Button>
          </div>
        </form>
      </div>

      <DebugSeeder
        label="Prefill Fake Mentor"
        onFill={() => {
          setForm({
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password({ length: 8 }),
            phone: faker.phone.number(),
            states: [faker.helpers.arrayElement(STATES)],
            lgas: [faker.location.county(), faker.location.county()],
            role: UserRole.MENTOR,
            coordinatorId: form.coordinatorId,
          });
        }}
      />
    </div>
  );
}

/* ─── Main Page ────────────────────────── */
export default function MentorsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canWrite = userRole === UserRole.ADMIN || userRole === UserRole.COORDINATOR;
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [scopedStates, setScopedStates] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const [showReassign, setShowReassign] = useState(false);
  const [reassignMentor, setReassignMentor] = useState<Mentor | null>(null);

  const fetchMentors = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (search) params.search = search;
      if (stateFilter) params.states = stateFilter;
      const result = await api.mentors.list(params);
      setMentors(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [page, search, stateFilter]);

  useEffect(() => {
    async function fetchScopedStates() {
      const role = session?.user?.role;
      if (role !== UserRole.COORDINATOR && role !== UserRole.ZONAL_DESK_OFFICER) {
        setScopedStates([]);
        return;
      }
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const states = (data?.roleDetails?.states ?? []) as string[];
        const cleaned = Array.from(
          new Set(
            states
              .map((s) => String(s).toUpperCase().trim())
              .filter(Boolean),
          ),
        );
        setScopedStates(cleaned);
      } catch {
        // no-op
      }
    }

    fetchScopedStates();
  }, [session?.user?.role]);

  useEffect(() => {
    const role = session?.user?.role;
    if (role !== UserRole.COORDINATOR && role !== UserRole.ZONAL_DESK_OFFICER) return;
    if (!stateFilter) return;
    if (scopedStates.length && !scopedStates.includes(stateFilter)) {
      setStateFilter("");
      setPage(1);
    }
  }, [session?.user?.role, scopedStates, stateFilter]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const toggleActive = async (mentor: Mentor) => {
    try {
      if (mentor.active) {
        await api.mentors.deactivate(mentor._id);
      } else {
        await api.mentors.update(mentor._id, { active: true });
      }
      fetchMentors();
    } catch {
      /* no-op */
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = mentors.map((m) => m._id);
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

  const handleSendReminders = async () => {
    if (!window.confirm("Send report reminder emails to all mentors who haven't submitted this week?")) return;
    setIsSendingReminders(true);
    try {
      const result = await api.mentors.sendReminders();
      alert(result.message);
    } catch (error) {
      alert(`Failed to send reminders: ${(error as Error).message}`);
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} mentor(s)? This action cannot be undone.`)) return;

    setIsDeletingBulk(true);
    try {
      await api.mentors.bulkDelete({ ids: selectedIds });
      setSelectedIds([]);
      fetchMentors();
    } catch (error) {
      alert(`Failed to delete: ${(error as Error).message}`);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handlePermanentDelete = async (m: Mentor) => {
    if (!window.confirm(`Permanently delete ${m.name}? This cannot be undone and will remove all their data.`)) return;
    try {
      await api.mentors.permanentDelete(m._id);
      fetchMentors();
    } catch (err) {
      alert(`Failed to permanently delete: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <Header title="Mentors" subtitle={`${total} total mentor${total === 1 ? '' : 's'}`} />

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
              <Select
                label="State Filter"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: "All States", value: "" },
                  ...(
                    session?.user?.role === UserRole.COORDINATOR || session?.user?.role === UserRole.ZONAL_DESK_OFFICER
                      ? scopedStates
                      : STATES
                  ).map((s) => ({ label: s, value: s })),
                ]}
                className="w-48"
              />
              <Button variant="outline" size="sm" onClick={() => {
                const data = mentors.map(m => ({
                  Name: m.name,
                  Email: m.email,
                  States: m.states?.join(", ") || "",
                  LGAs: m.lgas?.join(", ") || "",
                  Role: m.role,
                  Status: m.active ? "Active" : "Inactive"
                }));
                exportToCSV(data, "mentors");
              }}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
              {session?.user?.role && (session.user.role === UserRole.COORDINATOR || session.user.role === UserRole.ADMIN) && (
                <>
                  <Link href="/mentors/bulk-upload">
                    <Button size="sm" variant="secondary">
                      <Upload className="h-4 w-4 mr-1" /> Bulk Upload Mentors
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSendReminders}
                    disabled={isSendingReminders}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    {isSendingReminders ? "Sending…" : "Notify Mentors"}
                  </Button>
                </>
              )}
              {canWrite && selectedIds.length > 0 && (
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                </Button>
              )}
              {canWrite && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Mentor
              </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 w-10">
                  {canWrite && (
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={mentors.length > 0 && selectedIds.length === mentors.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  )}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600">States</th>
                <th className="px-4 py-3 font-medium text-gray-600">LGAs</th>
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
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : !mentors.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No mentors found.
                  </td>
                </tr>
              ) : (
                mentors.map((m) => (
                  <tr key={m._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {canWrite && (
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedIds.includes(m._id)}
                        onChange={(e) => handleSelectOne(m._id, e.target.checked)}
                      />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3">{m.states?.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{m.lgas?.join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.role === UserRole.ADMIN ? "destructive" : "secondary"}>
                        {m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.active ? "default" : "warning"}>
                        {m.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/mentors/${m._id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Details"
                        >
                          View
                        </Button>
                      </Link>
                      {canWrite && (
                      <Button
                        variant="ghost"
                        size="sm"

                        onClick={() => toggleActive(m)}
                        title={m.active ? "Deactivate" : "Activate"}
                      >
                        {m.active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-orange-600" />
                        )}
                      </Button>
                      )}
                      {session?.user?.role === UserRole.ADMIN && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setReassignMentor(m); setShowReassign(true); }}
                            title="Reassign to another coordinator"
                          >
                            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePermanentDelete(m)}
                            title="Permanently delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
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

      <CreateMentorModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchMentors}
        userRole={session?.user?.role}
      />

      <ReassignMentorModal
        open={showReassign}
        onClose={() => { setShowReassign(false); setReassignMentor(null); }}
        onReassigned={fetchMentors}
        mentor={reassignMentor}
      />
    </>
  );
}
