#!/usr/bin/env bash
# ทดสอบการเชื่อมต่อ Google Cloud (ใช้หลังตั้ง GCP_SA_KEY แล้ว)
set -euo pipefail

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ ! -f "./pnote-gcp-sa-key.json" ]; then
  echo "❌ ไม่พบ credentials"
  echo "   ตั้งค่า: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
  echo "   หรือวางไฟล์ pnote-gcp-sa-key.json ในโฟลเดอร์นี้"
  exit 1
fi

export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-./pnote-gcp-sa-key.json}"
PROJECT_ID="${GCP_PROJECT_ID:-mypoer}"

echo "=== ทดสอบ Google Cloud API ==="
echo "Project: $PROJECT_ID"
echo ""

gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet
gcloud config set project "$PROJECT_ID"

echo "1. ตรวจสอบ project..."
gcloud projects describe "$PROJECT_ID" --format="value(projectId)"

echo "2. ตรวจสอบ APIs..."
for API in run.googleapis.com artifactregistry.googleapis.com firebasehosting.googleapis.com; do
  if gcloud services list --enabled --filter="name:$API" --format="value(name)" | grep -q "$API"; then
    echo "   ✅ $API"
  else
    echo "   ❌ $API (ยังไม่เปิด)"
  fi
done

echo "3. ตรวจสอบ Cloud Run..."
gcloud run services describe p-note-api --region=asia-southeast1 --format="value(status.url)" 2>/dev/null \
  && echo "   ✅ p-note-api deploy แล้ว" \
  || echo "   ⏳ p-note-api ยังไม่ได้ deploy"

echo ""
echo "=== เสร็จ ==="
