"use client";

import { useState, useEffect, use, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type DocumentType, type FellowDocument } from "@/lib/api-client";
import {
    FileUp,
    Trash2,
    ArrowLeft,
    Plus,
    RotateCcw,
    ExternalLink,
    FileText,
    AlertCircle,
    CheckCircle2,
    ShieldAlert,
    Clock,
    Loader2,
    AlertTriangle,
    X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { UserRole } from "@/lib/constants";

/* ─── Confirmation Modal Component ───────────── */
interface ConfirmModalProps {
    open: boolean;
    type: "soft-delete" | "permanent-delete" | "restore";
    doc: FellowDocument | null;
    isMentor: boolean;
    loading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

function DocumentActionModal({
    open,
    type,
    doc,
    isMentor,
    loading,
    onClose,
    onConfirm,
}: ConfirmModalProps) {
    if (!open || !doc) return null;

    const docTitle =
        typeof doc.documentType === "object"
            ? doc.documentType?.title
            : "Fellow Document";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) onClose();
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                            {type === "soft-delete" && (
                                <div className="h-12 w-12 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                                    <Trash2 className="h-6 w-6 text-red-600" />
                                </div>
                            )}
                            {type === "permanent-delete" && (
                                <div className="h-12 w-12 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                            )}
                            {type === "restore" && (
                                <div className="h-12 w-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                                    <RotateCcw className="h-6 w-6 text-emerald-600" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {type === "soft-delete" && "Delete Document"}
                                    {type === "permanent-delete" && "Permanently Delete"}
                                    {type === "restore" && "Restore Document"}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {type === "soft-delete" && "Remove this fellow document"}
                                    {type === "permanent-delete" && "Permanent destructive action"}
                                    {type === "restore" && "Reactivate this fellow document"}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            data-tooltip="Close dialog"
                            data-tooltip-side="left"
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Message Body */}
                    <div className="mt-4 space-y-3">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {type === "soft-delete" && (
                                isMentor
                                    ? "Are you sure you want to delete this document? It will be removed from your list of fellow documents."
                                    : "Are you sure you want to move this document to the trash? Administrators will still be able to restore or permanently delete it."
                            )}
                            {type === "permanent-delete" && (
                                <span className="text-red-700 font-medium">
                                    This action cannot be undone. This document will be completely and permanently removed from the system.
                                </span>
                            )}
                            {type === "restore" && (
                                "Are you sure you want to restore this document? It will be moved back to active status and will be visible to mentors."
                            )}
                        </p>

                        {/* Document summary box */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="truncate">
                                    <p className="text-sm font-semibold text-gray-900 truncate" title={docTitle}>
                                        {docTitle}
                                    </p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <Clock className="h-3 w-3" />
                                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                data-tooltip="Open file in new browser tab"
                                className="text-xs font-medium text-orange-700 hover:underline shrink-0 flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-md shadow-2xs"
                            >
                                <ExternalLink className="h-3 w-3" /> View
                            </a>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                        tooltip="Cancel and close dialog"
                    >
                        Cancel
                    </Button>

                    {type === "soft-delete" && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={loading}
                            tooltip="Move this document to the trash"
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                    Delete Document
                                </>
                            )}
                        </Button>
                    )}

                    {type === "permanent-delete" && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={loading}
                            tooltip="Permanently remove file from database and cloud storage"
                            className="bg-red-700 hover:bg-red-800 text-white font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Purging…
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="h-4 w-4 mr-1.5" />
                                    Permanently Delete
                                </>
                            )}
                        </Button>
                    )}

                    {type === "restore" && (
                        <Button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            tooltip="Restore document to active status"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Restoring…
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4 mr-1.5" />
                                    Restore Document
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ────────────────────────── */
export default function FellowDocumentUploadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { data: session } = useSession();
    const router = useRouter();
    const { id } = use(params);

    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [existingDocs, setExistingDocs] = useState<FellowDocument[]>([]);
    const [loading, setLoading] = useState(true);

    const [uploading, setUploading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [filterTab, setFilterTab] = useState<"all" | "active" | "deleted">("all");
    const [filesToUpload, setFilesToUpload] = useState<{ file: File; typeId: string }[]>([]);

    // Modal state for confirmation
    const [modalState, setModalState] = useState<{
        open: boolean;
        type: "soft-delete" | "permanent-delete" | "restore";
        doc: FellowDocument | null;
    }>({
        open: false,
        type: "soft-delete",
        doc: null,
    });

    const isAdmin = session?.user?.role === UserRole.ADMIN;
    const isMentor = session?.user?.role === UserRole.MENTOR;

    const fetchDocuments = useCallback(async () => {
        try {
            const [docs, types] = await Promise.all([
                api.fellows.documents.list(id),
                api.documentTypes.list({ limit: "100" })
            ]);
            setExistingDocs(docs);
            setDocTypes(types.data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Filter documents for display - hooks defined before conditional returns
    const activeDocs = useMemo(() => existingDocs.filter(d => !d.deleted), [existingDocs]);
    const deletedDocs = useMemo(() => existingDocs.filter(d => !!d.deleted), [existingDocs]);

    const displayedDocs = useMemo(() => {
        if (!isAdmin) return activeDocs;
        if (filterTab === "active") return activeDocs;
        if (filterTab === "deleted") return deletedDocs;
        return existingDocs;
    }, [isAdmin, filterTab, activeDocs, deletedDocs, existingDocs]);

    if (session?.user && !isAdmin && !isMentor) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center space-y-4">
                <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
                <h2 className="text-xl font-bold text-gray-800">Access Restricted</h2>
                <p className="text-sm text-gray-600">You are not authorized to view or manage fellow documents.</p>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
                </Button>
            </div>
        );
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const newFiles = selectedFiles.map(file => ({
            file,
            typeId: docTypes.length > 0 ? docTypes[0]._id : "",
        }));

        setFilesToUpload([...filesToUpload, ...newFiles]);
        e.target.value = "";
    };

    const removeFile = (index: number) => {
        setFilesToUpload(files => files.filter((_, i) => i !== index));
    };

    const updateFileType = (index: number, typeId: string) => {
        setFilesToUpload(files => {
            const newFiles = [...files];
            newFiles[index].typeId = typeId;
            return newFiles;
        });
    };

    const handleUploadSubmit = async () => {
        if (filesToUpload.length === 0) return;

        if (filesToUpload.some(f => !f.typeId)) {
            setError("Please select a document type for all files.");
            return;
        }

        setUploading(true);
        setError("");
        setSuccess("");

        try {
            const uploadedDocs = [];

            for (const item of filesToUpload) {
                const result = await api.upload.file(item.file);
                uploadedDocs.push({
                    documentTypeId: item.typeId,
                    url: result.url,
                });
            }

            await api.fellows.documents.upload(id, { documents: uploadedDocs });

            setSuccess("Successfully uploaded document(s).");
            setFilesToUpload([]);
            await fetchDocuments();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploading(false);
        }
    };

    // Open confirmation modals
    const triggerSoftDelete = (doc: FellowDocument) => {
        setModalState({ open: true, type: "soft-delete", doc });
    };

    const triggerRestore = (doc: FellowDocument) => {
        setModalState({ open: true, type: "restore", doc });
    };

    const triggerPermanentDelete = (doc: FellowDocument) => {
        setModalState({ open: true, type: "permanent-delete", doc });
    };

    const handleModalClose = () => {
        if (!actionLoading) {
            setModalState({ open: false, type: "soft-delete", doc: null });
        }
    };

    // Execute modal confirmed action
    const handleConfirmAction = async () => {
        if (!modalState.doc) return;

        const docId = modalState.doc._id;
        const actionType = modalState.type;

        setActionLoading(true);
        setError("");
        setSuccess("");

        try {
            if (actionType === "soft-delete") {
                const res = await api.fellows.documents.delete(id, docId, false);
                setSuccess(res.message || "Document deleted successfully.");
            } else if (actionType === "restore") {
                const res = await api.fellows.documents.restore(id, docId);
                setSuccess(res.message || "Document restored successfully.");
            } else if (actionType === "permanent-delete") {
                const res = await api.fellows.documents.delete(id, docId, true);
                setSuccess(res.message || "Document permanently deleted.");
            }

            setModalState({ open: false, type: "soft-delete", doc: null });
            await fetchDocuments();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <>
            <Header
                title="Fellow Documents"
                subtitle={
                    isAdmin
                        ? "Manage, review, restore, and delete documents for this fellow"
                        : "Manage and upload documents for your assigned fellow"
                }
            />

            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.back()} tooltip="Return to fellows management" className="-ml-4 mb-2 hover:bg-gray-100">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Fellows
                </Button>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        <span className="text-sm font-medium">{success}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Upload Section */}
                    <div className="lg:col-span-5">
                        <Card className="shadow-sm border-gray-200">
                            <CardContent className="p-6 space-y-5">
                                <div className="border-b pb-3">
                                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                        <FileUp className="h-5 w-5 text-orange-600" />
                                        Upload New Documents
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Attach certificates, reports, or verification files</p>
                                </div>

                                <div className="border-2 border-dashed border-gray-300 hover:border-orange-400 transition-colors rounded-xl p-6 text-center bg-gray-50 flex flex-col items-center justify-center">
                                    <FileUp className="h-10 w-10 text-gray-400 mb-2" />
                                    <p className="text-sm font-medium text-gray-700">Choose document files</p>
                                    <p className="text-xs text-gray-500 mb-4">PDF, PNG, JPEG, or WEBP</p>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            multiple
                                            accept="application/pdf,image/png,image/jpeg,image/webp"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={handleFileChange}
                                            disabled={uploading}
                                        />
                                        <Button variant="secondary" disabled={uploading} tooltip="Browse local files (PDF, PNG, JPEG, WEBP)">
                                            <Plus className="h-4 w-4 mr-2" /> Select Files
                                        </Button>
                                    </div>
                                </div>

                                {filesToUpload.length > 0 && (
                                    <div className="space-y-3 mt-4">
                                        <h3 className="font-medium text-xs uppercase tracking-wider text-gray-500">
                                            Files Ready for Upload ({filesToUpload.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {filesToUpload.map((item, index) => (
                                                <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg shadow-2xs space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="truncate flex-1">
                                                            <p className="text-xs font-semibold text-gray-800 truncate" title={item.file.name}>
                                                                {item.file.name}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500">
                                                                {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeFile(index)}
                                                            disabled={uploading}
                                                            tooltip="Remove this file from upload queue"
                                                            className="text-gray-400 hover:text-red-600 h-7 w-7"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <Select
                                                        options={[
                                                            { label: "Select Document Type", value: "" },
                                                            ...docTypes.map(dt => ({ label: dt.title, value: dt._id }))
                                                        ]}
                                                        value={item.typeId}
                                                        onChange={(e) => updateFileType(index, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            className="w-full mt-2"
                                            onClick={handleUploadSubmit}
                                            disabled={uploading || filesToUpload.length === 0}
                                            tooltip={`Upload and save ${filesToUpload.length} file(s)`}
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Uploading Documents…
                                                </>
                                            ) : (
                                                `Upload ${filesToUpload.length} Document${filesToUpload.length > 1 ? "s" : ""}`
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Existing Documents Section */}
                    <div className="lg:col-span-7">
                        <Card className="shadow-sm border-gray-200">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-gray-700" />
                                            Fellow Documents
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {isAdmin
                                                ? `${activeDocs.length} active, ${deletedDocs.length} in trash`
                                                : `${activeDocs.length} document${activeDocs.length === 1 ? "" : "s"} uploaded`}
                                        </p>
                                    </div>

                                    {/* Admin Filter Tabs */}
                                    {isAdmin && (
                                        <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium">
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab("all")}
                                                data-tooltip="View all active and deleted documents"
                                                className={`px-3 py-1 rounded-md transition-colors ${
                                                    filterTab === "all"
                                                        ? "bg-white text-gray-900 shadow-2xs font-semibold"
                                                        : "text-gray-600 hover:text-gray-900"
                                                }`}
                                            >
                                                All ({existingDocs.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab("active")}
                                                data-tooltip="Filter by active documents only"
                                                className={`px-3 py-1 rounded-md transition-colors ${
                                                    filterTab === "active"
                                                        ? "bg-white text-gray-900 shadow-2xs font-semibold"
                                                        : "text-gray-600 hover:text-gray-900"
                                                }`}
                                            >
                                                Active ({activeDocs.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab("deleted")}
                                                data-tooltip="Filter by deleted documents in trash"
                                                className={`px-3 py-1 rounded-md transition-colors ${
                                                    filterTab === "deleted"
                                                        ? "bg-red-100 text-red-800 shadow-2xs font-semibold"
                                                        : "text-gray-600 hover:text-red-700"
                                                }`}
                                            >
                                                Deleted ({deletedDocs.length})
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {loading ? (
                                    <div className="py-12 text-center text-gray-500 space-y-2">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-600" />
                                        <p className="text-sm">Loading documents…</p>
                                    </div>
                                ) : displayedDocs.length === 0 ? (
                                    <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                        <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                                        <p className="text-sm font-medium text-gray-600">
                                            {filterTab === "deleted"
                                                ? "No deleted documents found."
                                                : "No documents found for this fellow."}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {filterTab === "deleted"
                                                ? "Documents moved to trash will appear here."
                                                : "Upload a document on the left to get started."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                        {displayedDocs.map((doc) => {
                                            const isDeleted = !!doc.deleted;

                                            return (
                                                <div
                                                    key={doc._id}
                                                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                                        isDeleted
                                                            ? "bg-red-50/70 border-red-200 hover:border-red-300"
                                                            : "bg-white border-gray-200 hover:border-gray-300 shadow-2xs"
                                                    }`}
                                                >
                                                    <div className="space-y-1.5 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm text-gray-900 truncate">
                                                                {typeof doc.documentType === "object"
                                                                    ? doc.documentType?.title
                                                                    : "Unknown Type"}
                                                            </span>

                                                            {/* Visual Flag for Deleted Document */}
                                                            {isDeleted && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                                                    <Trash2 className="h-3 w-3" /> Deleted
                                                                </span>
                                                            )}
                                                            {!isDeleted && isAdmin && (
                                                                <span className="inline-flex items-center rounded-full bg-green-100 border border-green-300 px-2 py-0.5 text-[10px] font-medium text-green-800">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                                                            </span>

                                                            {isDeleted && doc.deletedAt && (
                                                                <span className="text-red-600 font-medium">
                                                                    Deleted {new Date(doc.deletedAt).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                        <a
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            data-tooltip="View document in new browser tab"
                                                            className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800 hover:underline px-2.5 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" /> View
                                                        </a>

                                                        {/* Mentors can only soft delete active documents */}
                                                        {isMentor && !isDeleted && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => triggerSoftDelete(doc)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2.5"
                                                                tooltip="Move document to trash"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                            </Button>
                                                        )}

                                                        {/* Admin Actions */}
                                                        {isAdmin && (
                                                            <>
                                                                {isDeleted ? (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => triggerRestore(doc)}
                                                                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs h-8 px-2.5"
                                                                            tooltip="Restore document to active status"
                                                                        >
                                                                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                                                                        </Button>
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={() => triggerPermanentDelete(doc)}
                                                                            className="text-xs h-8 px-2.5"
                                                                            tooltip="Permanently delete document from storage"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Permanent Delete
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => triggerSoftDelete(doc)}
                                                                            className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 text-xs h-8 px-2.5"
                                                                            tooltip="Move document to trash"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => triggerPermanentDelete(doc)}
                                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2"
                                                                            tooltip="Permanently purge document immediately"
                                                                        >
                                                                            <span className="text-[11px] font-medium text-red-500 hover:underline">Permanent</span>
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Action Confirmation Modal */}
            <DocumentActionModal
                open={modalState.open}
                type={modalState.type}
                doc={modalState.doc}
                isMentor={isMentor}
                loading={actionLoading}
                onClose={handleModalClose}
                onConfirm={handleConfirmAction}
            />
        </>
    );
}
