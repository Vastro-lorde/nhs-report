"use client";

import { useState, useEffect, use } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type DocumentType, type Fellow, type FellowDocument } from "@/lib/api-client";
import { FileUp, Trash2, ArrowLeft, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

export default function FellowDocumentUploadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();
    const { id } = use(params);

    const [fellow, setFellow] = useState<Fellow | null>(null);
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [existingDocs, setExistingDocs] = useState<FellowDocument[]>([]);
    const [loading, setLoading] = useState(true);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [filesToUpload, setFilesToUpload] = useState<{ file: File; typeId: string; }[]>([]);

    useEffect(() => {
        Promise.all([
            // Fetch the fellow doesn't have a single GET endpoint, so we can list and filter, or just use the existing documents list which validates access
            api.fellows.documents.list(id),
            api.documentTypes.list({ limit: "100" })
        ]).then(([docs, types]) => {
            setExistingDocs(docs);
            setDocTypes(types.data);
        }).catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const newFiles = selectedFiles.map(file => ({
            file,
            typeId: docTypes.length > 0 ? docTypes[0]._id : "",
        }));

        setFilesToUpload([...filesToUpload, ...newFiles]);

        // reset input
        e.target.value = '';
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

        // validate all have types
        if (filesToUpload.some(f => !f.typeId)) {
            setError("Please select a document type for all files.");
            return;
        }

        setUploading(true);
        setError("");
        setSuccess("");

        try {
            const uploadedDocs = [];

            // 1. Upload files to Cloudinary sequentially
            for (const item of filesToUpload) {
                const result = await api.upload.file(item.file);
                uploadedDocs.push({
                    documentTypeId: item.typeId,
                    url: result.url,
                });
            }

            // 2. Save URLs to backend
            await api.fellows.documents.upload(id, { documents: uploadedDocs });

            setSuccess("Successfully uploaded documents.");
            setFilesToUpload([]);

            // Refresh list
            const updatedList = await api.fellows.documents.list(id);
            setExistingDocs(updatedList);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <Header title="Fellow Documents" subtitle="Manage and upload documents for your fellow" />

            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="-ml-4 mb-2">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>}
                {success && <div className="bg-green-50 text-green-700 p-4 rounded-md">{success}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Upload Section */}
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <h2 className="text-lg font-semibold border-b pb-2">Upload New Documents</h2>

                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 flex flex-col items-center justify-center">
                                <FileUp className="h-8 w-8 text-gray-400 mb-3" />
                                <p className="text-sm text-gray-600 mb-4">Select multiple files to upload</p>
                                <div className="relative">
                                    <input
                                        type="file"
                                        multiple
                                        accept="application/pdf,image/png,image/jpeg,image/webp"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                        disabled={uploading}
                                    />
                                    <Button variant="secondary" disabled={uploading}>
                                        <Plus className="h-4 w-4 mr-2" /> Choose Files
                                    </Button>
                                </div>
                            </div>

                            {filesToUpload.length > 0 && (
                                <div className="space-y-4 mt-6">
                                    <h3 className="font-medium text-sm text-gray-700">Files Ready for Upload</h3>
                                    {filesToUpload.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between gap-4 p-3 bg-white border rounded-lg shadow-sm">
                                            <div className="truncate flex-1">
                                                <p className="text-sm font-medium truncate" title={item.file.name}>{item.file.name}</p>
                                                <p className="text-xs text-gray-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>

                                            <div className="w-1/3">
                                                <Select
                                                    options={[
                                                        { label: "Select Document Type", value: "" },
                                                        ...docTypes.map(dt => ({ label: dt.title, value: dt._id }))
                                                    ]}
                                                    value={item.typeId}
                                                    onChange={(e) => updateFileType(index, e.target.value)}
                                                />
                                            </div>

                                            <Button variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={uploading}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}

                                    <Button
                                        className="w-full mt-4"
                                        onClick={handleUploadSubmit}
                                        disabled={uploading || filesToUpload.length === 0}
                                    >
                                        {uploading ? "Uploading..." : "Upload Documents"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Existing Documents */}
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-lg font-semibold border-b pb-2">Uploaded Documents</h2>

                            {loading ? (
                                <p className="text-sm text-gray-500">Loading documents...</p>
                            ) : existingDocs.length === 0 ? (
                                <p className="text-sm text-gray-500">No documents found for this fellow.</p>
                            ) : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {existingDocs.map((doc) => (
                                        <div key={doc._id} className="p-3 border rounded-lg flex justify-between items-center group bg-gray-50">
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {typeof doc.documentType === 'object' ? doc.documentType?.title : "Unknown Type"}
                                                </p>
                                                <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-green-700 hover:underline font-medium px-2"
                                            >
                                                View
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
