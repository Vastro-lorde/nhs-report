/* ──────────────────────────────────────────
   Cloudinary configuration (server-side only)
   ────────────────────────────────────────── */
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

let configured = false;

export function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME(),
      api_key: env.CLOUDINARY_API_KEY(),
      api_secret: env.CLOUDINARY_API_SECRET(),
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/**
 * Upload a base64 or buffer image to Cloudinary.
 * Returns the secure URL.
 */
export async function uploadToCloudinary(
  file: string, // base64 data URI or file path
  options?: { folder?: string; publicId?: string }
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const baseFolder = env.CLOUDINARY_UPLOAD_FOLDER();
  const subFolder = options?.folder ? `${baseFolder}/${options.folder}` : baseFolder;

  const result = await cld.uploader.upload(file, {
    folder: subFolder,
    public_id: options?.publicId,
    resource_type: "auto",
    overwrite: false,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}
