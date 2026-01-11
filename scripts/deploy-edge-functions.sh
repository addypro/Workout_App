#!/bin/bash

# Deploy Supabase Edge Functions
#
# This script deploys all edge functions for the Workout App:
# - parse-pdf-analyze: PDF structure analysis
# - parse-pdf-extract: PDF workout extraction
# - extract-workout-data: Unified extraction (audio, image, PDF) with Gemini
#
# Prerequisites:
# 1. Supabase Access Token from https://supabase.com/dashboard/account/tokens
# 2. Anthropic API Key from https://console.anthropic.com/ (for PDF parsing)
# 3. Gemini API Key from https://makersuite.google.com/app/apikey (for voice/image)
#
# Usage:
#   ./scripts/deploy-edge-functions.sh
#
# Or with environment variables:
#   SUPABASE_ACCESS_TOKEN=xxx ANTHROPIC_API_KEY=xxx GEMINI_API_KEY=xxx ./scripts/deploy-edge-functions.sh

set -e

cd "$(dirname "$0")/.."

echo "==========================================="
echo "  Supabase Edge Functions Deployment"
echo "==========================================="
echo ""

# Check for Supabase access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Enter your Supabase Access Token (from https://supabase.com/dashboard/account/tokens):"
  read -s SUPABASE_ACCESS_TOKEN
  export SUPABASE_ACCESS_TOKEN
  echo ""
fi

# Verify login works
echo "Verifying Supabase authentication..."
if ! npx supabase projects list > /dev/null 2>&1; then
  echo "ERROR: Failed to authenticate with Supabase. Please check your access token."
  exit 1
fi
echo "Authenticated successfully!"
echo ""

# ============================================
# API KEYS
# ============================================

# Anthropic API Key (for PDF parsing with Claude)
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Enter your Anthropic API Key (for Claude PDF parsing):"
  echo "(from https://console.anthropic.com/ - optional, press Enter to skip)"
  read -s ANTHROPIC_API_KEY
  echo ""
fi

# Gemini API Key (for voice and image extraction)
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Enter your Gemini API Key (for voice/image extraction):"
  echo "(from https://makersuite.google.com/app/apikey - REQUIRED for voice logging)"
  read -s GEMINI_API_KEY
  echo ""
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "WARNING: GEMINI_API_KEY not provided. Voice logging will not work."
  echo ""
fi

# Set secrets
echo "Setting API key secrets..."
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "$ANTHROPIC_API_KEY" | npx supabase secrets set ANTHROPIC_API_KEY
  echo "  ANTHROPIC_API_KEY set"
fi
if [ -n "$GEMINI_API_KEY" ]; then
  echo "$GEMINI_API_KEY" | npx supabase secrets set GEMINI_API_KEY
  echo "  GEMINI_API_KEY set"
fi
echo ""

# ============================================
# DATABASE MIGRATIONS
# ============================================

echo "Checking database migrations..."
npx supabase db push --dry-run 2>&1 | head -5 || true
echo ""

read -p "Apply migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Applying migrations..."
  npx supabase db push
  echo "Migrations applied!"
else
  echo "Skipping migrations."
fi
echo ""

# ============================================
# DEPLOY EDGE FUNCTIONS
# ============================================

echo "Deploying edge functions..."
echo ""

echo "1/3 Deploying parse-pdf-analyze (Claude Vision)..."
npx supabase functions deploy parse-pdf-analyze --no-verify-jwt
echo ""

echo "2/3 Deploying parse-pdf-extract (Claude Vision)..."
npx supabase functions deploy parse-pdf-extract --no-verify-jwt
echo ""

echo "3/3 Deploying extract-workout-data (Gemini - Voice/Image/PDF)..."
npx supabase functions deploy extract-workout-data --no-verify-jwt
echo ""

# ============================================
# SUMMARY
# ============================================

echo "==========================================="
echo "  Deployment Complete!"
echo "==========================================="
echo ""
echo "Edge functions are now available at:"
echo ""
echo "  PDF Parsing (Claude Vision):"
echo "    - parse-pdf-analyze"
echo "    - parse-pdf-extract"
echo ""
echo "  Unified Extraction (Gemini Flash):"
echo "    - extract-workout-data (audio, image, PDF)"
echo ""
echo "Base URL: https://dahuiaqdbaenlsiniykx.supabase.co/functions/v1/"
echo ""
echo "Test voice extraction with:"
echo '  curl -X POST "https://dahuiaqdbaenlsiniykx.supabase.co/functions/v1/extract-workout-data" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '\''{"base64":"...", "type":"audio/m4a"}'\'
echo ""
