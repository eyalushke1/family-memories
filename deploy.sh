#!/bin/bash
# Deployment script for Google Cloud Run
#
# Prerequisites:
#   1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
#   2. Authenticate: gcloud auth login
#   3. Set project: gcloud config set project YOUR_PROJECT_ID
#   4. Enable APIs:
#      gcloud services enable cloudbuild.googleapis.com
#      gcloud services enable run.googleapis.com
#      gcloud services enable secretmanager.googleapis.com
#
# Usage:
#   ./deploy.sh [region] [service-name]
#
# Example:
#   ./deploy.sh us-central1 family-memories

set -e

# Configuration
REGION=${1:-us-central1}
SERVICE_NAME=${2:-family-memories}
PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Deploying to Google Cloud Run..."
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo ""

# Build and push using Cloud Build
echo "Building and deploying with Cloud Build..."
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions="_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME"

echo ""
echo "Deployment complete!"
echo ""
echo "Your service URL:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
