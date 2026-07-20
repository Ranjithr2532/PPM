import os
from io import BytesIO
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from minio import Minio
from minio.error import S3Error


MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "172.18.7.91:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "cmti-order-management")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_REGION = os.getenv("MINIO_REGION")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL")


def _get_client() -> Minio:
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
        region=MINIO_REGION,
    )


def _ensure_bucket(client: Minio) -> None:
    if client.bucket_exists(MINIO_BUCKET):
        return
    client.make_bucket(MINIO_BUCKET, location=MINIO_REGION)


def _build_public_url(object_name: str) -> str:
    if MINIO_PUBLIC_URL:
        base = MINIO_PUBLIC_URL.rstrip("/")
        return f"{base}/{object_name}"
    scheme = "https" if MINIO_SECURE else "http"
    return f"{scheme}://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{object_name}"


async def upload_file_to_minio(
    file: UploadFile, object_name: Optional[str] = None
) -> Tuple[str, str]:
    client = _get_client()
    _ensure_bucket(client)

    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload"
        )

    if object_name is None:
        from uuid import uuid4

        sanitized_name = file.filename.replace(" ", "_")
        object_name = f"documents/{uuid4().hex}_{sanitized_name}"

    try:
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=BytesIO(data),
            length=len(data),
            content_type=file.content_type,
        )
    except S3Error as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to upload file to storage: {exc}",
        ) from exc

    return object_name, _build_public_url(object_name)


def delete_file_from_minio(object_name: str) -> None:
    client = _get_client()
    try:
        client.remove_object(MINIO_BUCKET, object_name)
    except S3Error as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to delete file from storage: {exc}",
        ) from exc


def extract_object_name_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    from urllib.parse import urlparse

    parsed = urlparse(url)
    path = parsed.path.lstrip("/")
    if not path:
        return None

    # Expecting path format "<bucket>/<object>"
    parts = path.split("/", 1)
    if len(parts) == 1:
        return parts[0]

    bucket_name, object_path = parts
    if bucket_name == MINIO_BUCKET:
        return object_path
    return path

