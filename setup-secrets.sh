#!/bin/bash
# Setup Google Cloud Secrets for Family Memories
#
# This script creates the necessary secrets in Google Cloud Secret Manager
# Run this AFTER setting up your Google Cloud project
#
# Usage: ./setup-secrets.sh

set -e

# Check if gcloud is configured
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No Google Cloud project set."
  echo "Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Creating secrets in project: $PROJECT_ID"
echo ""

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

read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_KEY: " SUPABASE_KEY
read -p "SUPABASE_SCHEMA [family_memories]: " SUPABASE_SCHEMA
SUPABASE_SCHEMA=${SUPABASE_SCHEMA:-family_memories}

read -p "STORAGE_TYPE [zadara]: " STORAGE_TYPE
STORAGE_TYPE=${STORAGE_TYPE:-zadara}
read -p "ZADARA_ENDPOINT: " ZADARA_ENDPOINT
read -p "ZADARA_ACCESS_KEY_ID: " ZADARA_ACCESS_KEY_ID
read -p "ZADARA_SECRET_ACCESS_KEY: " ZADARA_SECRET_ACCESS_KEY
read -p "ZADARA_BUCKET_NAME: " ZADARA_BUCKET_NAME
read -p "ZADARA_PUBLIC_URL: " ZADARA_PUBLIC_URL

read -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

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

echo ""
echo "Done! Secrets created in Secret Manager."
echo ""
echo "Grant Cloud Run access to secrets:"
echo "gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "  --member='serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com' \\"
echo "  --role='roles/secretmanager.secretAccessor'"
