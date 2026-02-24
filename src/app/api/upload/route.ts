/* ──────────────────────────────────────────
   API: /api/upload — Cloudinary file upload
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { MAX_UPLOAD_SIZE_MB, ALLOWED_UPLOAD_TYPES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return jsonError("No file provided");

  // Validate type
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as typeof ALLOWED_UPLOAD_TYPES[number])) {
    return jsonError(`File type not allowed. Allowed: ${ALLOWED_UPLOAD_TYPES.join(", ")}`);
  }

  // Validate size
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return jsonError(`File too large. Max ${MAX_UPLOAD_SIZE_MB}MB`);
  }

  // Convert to base64 data URI for Cloudinary
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  const result = await uploadToCloudinary(base64, {
    folder: "evidence",
  });

  return jsonOk({ url: result.url, publicId: result.publicId });
}
