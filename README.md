# EduBoost

Serverless tutoring platform on AWS (eu-west-1).

## Stack

- **Auth:** Amazon Cognito (User Pool + Hosted UI + groups)
- **API:** API Gateway HTTP API → single Lambda (Node 22 + Hono)
- **DB:** DynamoDB single-table (ElectroDB, Streams on, PITR)
- **Storage:** S3 (uploads + recordings) behind CloudFront
- **Classroom video:** Amazon Chime SDK (eu-west-1)
- **Email:** Resend
- **Web:** Next.js 15 on CloudFront + Lambda (OpenNext via `cdk-nextjs-standalone`)
- **IaC:** AWS CDK (TypeScript)

## Layout

```
eduboost/
├── cdk/        # CDK stacks
├── db/         # ElectroDB entity schemas
├── lambdas/    # Single Hono Lambda
└── web/        # Next.js app
```

## Prerequisites

- Node.js 22+
- AWS CLI v2 with profile `malek.atia2` configured for eu-west-1
- CDK v2 (installed via workspace)

## First-time setup

```bash
npm install

# One-time CDK bootstrap (replace ACCOUNT_ID)
npx cdk bootstrap aws://ACCOUNT_ID/eu-west-1 --profile malek.atia2
```

Get your account id: `aws sts get-caller-identity --profile malek.atia2`.

## Deploy order

```bash
# From repo root
npm run cdk:deploy -- --all
```

Or individually (must be in this order first time):

```bash
cd cdk
npm run deploy:db         # DynamoDB table
npm run deploy:auth       # Cognito
npm run deploy:storage    # S3 buckets
npm run deploy:api        # Lambda + API Gateway
npm run deploy:web        # Next.js via CloudFront
```

Stack outputs (UserPoolId, ApiUrl, WebUrl) print after each deploy.

## Local dev

```bash
# API (http://localhost:3001)
npm run api:dev

# Web (http://localhost:3000) — needs env vars from deployed stacks
cp web/.env.local.example web/.env.local  # then fill in values
npm run web:dev
```

`web/.env.local`:

```
NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.eu-west-1.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=eu-west-1
```

## Runtime secrets (set in Lambda env or SSM)

- `RESEND_API_KEY` — Resend email
- `STRIPE_SECRET_KEY` — payments
- `STRIPE_WEBHOOK_SECRET` — webhook verification

Add these to `cdk/lib/api-stack.ts` `environment:` block or wire SSM parameters.

## Cost sketch (MVP, empty tables)

- DynamoDB pay-per-request: ~$0–5/mo
- Lambda: ~$0–5/mo at MVP traffic
- API Gateway HTTP API: $1.00 per million requests
- Cognito: free up to 50k MAU
- S3 + CloudFront: ~$1–10/mo
- Chime SDK: $0.0017/attendee-min (~$0.10/hr/student)

Baseline floor: **~$5–20/mo** pre-launch.

## MVP scope (3-month target)

1. Cognito auth (parent / student / teacher groups)
2. Teacher profile + search
3. Booking + Stripe payment (trial session flow)
4. Chime SDK classroom with recording
5. Basic chat (in-classroom messaging)

Phase 2+: marketplace, forum, AI grading, events, organizations, analytics.
