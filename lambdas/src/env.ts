export const env = {
  region: process.env.AWS_REGION ?? "eu-west-1",
  accountId: process.env.ACCOUNT_ID ?? "",
  tableName: process.env.TABLE_NAME ?? "eduboost",
  userPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  userPoolClientId: process.env.COGNITO_USER_POOL_CLIENT_ID ?? "",
  uploadsBucket: process.env.UPLOADS_BUCKET ?? "",
  recordingsBucket: process.env.RECORDINGS_BUCKET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};
