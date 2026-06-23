import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT ?? "",
    region: "us-east-1", // Minio mengabaikan ini, tapi tetap wajib diisi
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true, // Wajib true untuk Minio
});

/**
 * Menerima URL file mentah, jika URL tersebut dari MinIO, 
 * akan mengembalikan Signed URL sementara yang bisa diakses publik.
 */
export async function generatePresignedUrl(fileUrl: string | null): Promise<string | null> {
    if (!fileUrl || !process.env.MINIO_ENDPOINT) return fileUrl;

    try {
        const prefix = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/`;
        if (fileUrl.startsWith(prefix)) {
            const key = fileUrl.replace(prefix, "");
            const command = new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET ?? "",
                Key: decodeURIComponent(key),
            });
            return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }
    } catch (err) {
        console.error("Gagal generate signed URL:", err);
    }

    return fileUrl;
}

/**
 * Mengunggah file buffer ke Minio.
 * Mengembalikan URL lengkap file di Minio.
 */
export async function uploadToMinio(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const bucket = process.env.MINIO_BUCKET ?? "";
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });
    await s3Client.send(command);
    return `${process.env.MINIO_ENDPOINT}/${bucket}/${key}`;
}