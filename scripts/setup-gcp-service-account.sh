#!/usr/bin/env bash
# สร้าง Service Account สำหรับ GitHub Actions deploy อัตโนมัติ
# รันคำสั่งนี้บนเครื่องที่ login gcloud แล้ว (gcloud auth login)

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-mypoer}"
SA_NAME="pnote-github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="pnote-gcp-sa-key.json"

echo "=== P-Note: สร้าง Service Account ==="
echo "Project: $PROJECT_ID"
echo ""

gcloud config set project "$PROJECT_ID"

# สร้าง Service Account
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="P-Note GitHub Deploy" \
  2>/dev/null || echo "Service account มีอยู่แล้ว"

# ให้สิทธิ์ที่จำเป็น (เท่าที่ deploy ต้องใช้)
ROLES=(
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/iam.serviceAccountUser"
  "roles/cloudbuild.builds.editor"
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

# สร้าง key file
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL"

echo ""
echo "=== สำเร็จ ==="
echo "Key file: $KEY_FILE"
echo ""
echo "ขั้นต่อไป — เพิ่ม GitHub Secret:"
echo "  gh secret set GCP_SA_KEY < $KEY_FILE --repo yohaken/P-Note"
echo ""
echo "⚠️  อย่า commit ไฟล์ $KEY_FILE ขึ้น GitHub"
echo "⚠️  ลบไฟล์หลังเพิ่ม secret แล้ว: rm $KEY_FILE"
