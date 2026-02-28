#!/bin/bash
# Setup Google Cloud Secrets and Artifact Registry for Family Memories
#
# This script creates the necessary secrets in Google Cloud Secret Manager
# and sets up Artifact Registry for Docker images.
#
# Run this AFTER setting up your Google Cloud project.
#
# Usage: ./setup-secrets.sh [region]
# Example: ./setup-secrets.sh us-central1

set -e

REGION=${1:-us-central1}
REPO_NAME="family-memories"

# Check if gcloud is configured
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No Google Cloud project set."
  echo "Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Setting up project: $PROJECT_ID (region: $REGION)"
echo ""

# --- Artifact Registry ---
echo "=== Artifact Registry ==="
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
  echo "Creating Artifact Registry repository: $REPO_NAME"
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Family Memories Docker images"
else
  echo "Artifact Registry repository '$REPO_NAME' already exists."
fi
echo ""

# --- Secrets ---
echo "=== Secret Manager ==="

# Function to create or update a secret
create_secret() {
  local name=$1
  local value=$2

  # Check if secret exists
  if gcloud secrets describe "$name" &>/dev/null; then
    echo "Updating secret: $name"
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=-
  else
    echo "Creating secret: $name"
    echo -n "$value" | gcloud secrets create "$name" --data-file=-
  fi
}

# Prompt for each secret value
echo "Enter your environment variable values:"
echo "(Press Enter to skip if already set)"
echo ""

echo "--- Supabase ---"
read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_KEY: " SUPABASE_KEY
read -p "SUPABASE_SCHEMA [family_memories]: " SUPABASE_SCHEMA
SUPABASE_SCHEMA=${SUPABASE_SCHEMA:-family_memories}

echo ""
echo "--- Zadara Storage ---"
read -p "STORAGE_TYPE [zadara]: " STORAGE_TYPE
STORAGE_TYPE=${STORAGE_TYPE:-zadara}
read -p "ZADARA_ENDPOINT: " ZADARA_ENDPOINT
read -p "ZADARA_ACCESS_KEY_ID: " ZADARA_ACCESS_KEY_ID
read -p "ZADARA_SECRET_ACCESS_KEY: " ZADARA_SECRET_ACCESS_KEY
read -p "ZADARA_BUCKET_NAME: " ZADARA_BUCKET_NAME
read -p "ZADARA_PUBLIC_URL: " ZADARA_PUBLIC_URL

echo ""
echo "--- Google OAuth ---"
read -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

echo ""
echo "--- Security ---"
read -p "TOKEN_ENCRYPTION_KEY (leave blank to auto-generate): " TOKEN_ENCRYPTION_KEY
if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
  TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
  echo "  Auto-generated: $TOKEN_ENCRYPTION_KEY"
fi

read -p "CRON_SECRET (leave blank to auto-generate): " CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET=$(openssl rand -hex 16)
  echo "  Auto-generated: $CRON_SECRET"
fi

echo ""
echo "--- WhatsApp Bridge (optional) ---"
read -p "WHATSAPP_API_URL [leave blank to skip]: " WHATSAPP_API_URL
read -p "WHATSAPP_API_KEY [leave blank to skip]: " WHATSAPP_API_KEY

echo ""
echo "Creating secrets..."

# Create secrets
[ -n "$SUPABASE_URL" ] && create_secret "SUPABASE_URL" "$SUPABASE_URL"
[ -n "$SUPABASE_KEY" ] && create_secret "SUPABASE_KEY" "$SUPABASE_KEY"
[ -n "$SUPABASE_SCHEMA" ] && create_secret "SUPABASE_SCHEMA" "$SUPABASE_SCHEMA"
[ -n "$STORAGE_TYPE" ] && create_secret "STORAGE_TYPE" "$STORAGE_TYPE"
[ -n "$ZADARA_ENDPOINT" ] && create_secret "ZADARA_ENDPOINT" "$ZADARA_ENDPOINT"
[ -n "$ZADARA_ACCESS_KEY_ID" ] && create_secret "ZADARA_ACCESS_KEY_ID" "$ZADARA_ACCESS_KEY_ID"
[ -n "$ZADARA_SECRET_ACCESS_KEY" ] && create_secret "ZADARA_SECRET_ACCESS_KEY" "$ZADARA_SECRET_ACCESS_KEY"
[ -n "$ZADARA_BUCKET_NAME" ] && create_secret "ZADARA_BUCKET_NAME" "$ZADARA_BUCKET_NAME"
[ -n "$ZADARA_PUBLIC_URL" ] && create_secret "ZADARA_PUBLIC_URL" "$ZADARA_PUBLIC_URL"
[ -n "$GOOGLE_CLIENT_ID" ] && create_secret "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
[ -n "$GOOGLE_CLIENT_SECRET" ] && create_secret "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
[ -n "$TOKEN_ENCRYPTION_KEY" ] && create_secret "TOKEN_ENCRYPTION_KEY" "$TOKEN_ENCRYPTION_KEY"
[ -n "$CRON_SECRET" ] && create_secret "CRON_SECRET" "$CRON_SECRET"
[ -n "$WHATSAPP_API_URL" ] && create_secret "WHATSAPP_API_URL" "$WHATSAPP_API_URL"
[ -n "$WHATSAPP_API_KEY" ] && create_secret "WHATSAPP_API_KEY" "$WHATSAPP_API_KEY"

echo ""
echo "Done! Secrets created in Secret Manager."
echo ""
echo "Next steps:"
echo ""
echo "1. Grant Cloud Run access to secrets:"
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "     --member='serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com' \\"
echo "     --role='roles/secretmanager.secretAccessor'"
echo ""
echo "2. Deploy:"
echo "   ./deploy.sh $REGION"
