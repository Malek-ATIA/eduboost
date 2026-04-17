import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwAuth from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  table: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  uploadsBucket: s3.Bucket;
  recordingsBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const reminderHandler = new lambdaNodejs.NodejsFunction(this, "ReminderHandler", {
      functionName: `eduboost-${props.stage}-reminder`,
      entry: path.join(__dirname, "../../lambdas/src/handlers/reminder.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        target: "node22",
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        TABLE_NAME: props.table.tableName,
        RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
      },
    });
    props.table.grantReadWriteData(reminderHandler);

    // Reminder Lambda also sends SMS via SNS when users are opted in.
    reminderHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: ["*"],
      }),
    );

    const scheduleGroup = new scheduler.CfnScheduleGroup(this, "ReminderScheduleGroup", {
      name: `eduboost-${props.stage}-reminders`,
    });

    const schedulerRole = new iam.Role(this, "SchedulerInvokerRole", {
      roleName: `eduboost-${props.stage}-scheduler-invoker`,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": cdk.Aws.ACCOUNT_ID },
        },
      }),
    });
    reminderHandler.grantInvoke(schedulerRole);

    const handler = new lambdaNodejs.NodejsFunction(this, "ApiHandler", {
      functionName: `eduboost-${props.stage}-api`,
      entry: path.join(__dirname, "../../lambdas/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(29),
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        target: "node22",
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*", "pdfkit"],
        nodeModules: ["pdfkit"],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        TABLE_NAME: props.table.tableName,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        RECORDINGS_BUCKET: props.recordingsBucket.bucketName,
        RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
        ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
        REMINDER_LAMBDA_ARN: reminderHandler.functionArn,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        SCHEDULE_GROUP_NAME: scheduleGroup.name ?? `eduboost-${props.stage}-reminders`,
        STRIPE_STUDENT_PREMIUM_PRICE_ID: process.env.STRIPE_STUDENT_PREMIUM_PRICE_ID ?? "",
        STRIPE_TEACHER_PRO_PRICE_ID: process.env.STRIPE_TEACHER_PRO_PRICE_ID ?? "",
        WEB_BASE_URL: process.env.WEB_BASE_URL ?? "https://eduboost.com",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
        GOOGLE_REDIRECT_URL: process.env.GOOGLE_REDIRECT_URL ?? "",
        GOOGLE_STATE_SECRET: process.env.GOOGLE_STATE_SECRET ?? "",
        BEDROCK_GRADING_MODEL_ID: process.env.BEDROCK_GRADING_MODEL_ID ?? "",
      },
    });

    props.table.grantReadWriteData(handler);
    props.uploadsBucket.grantReadWrite(handler);
    props.recordingsBucket.grantReadWrite(handler);

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "chime:CreateMeeting",
          "chime:DeleteMeeting",
          "chime:CreateAttendee",
          "chime:DeleteAttendee",
          "chime:GetMeeting",
          "chime:ListAttendees",
          "chime:CreateMediaCapturePipeline",
          "chime:DeleteMediaCapturePipeline",
          "chime:GetMediaCapturePipeline",
        ],
        resources: ["*"],
      }),
    );

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminGetUser",
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "scheduler:CreateSchedule",
          "scheduler:UpdateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
        ],
        resources: [
          `arn:aws:scheduler:${this.region}:${cdk.Aws.ACCOUNT_ID}:schedule/${scheduleGroup.name}/*`,
        ],
      }),
    );
    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        // SNS direct-publish to a phone number ("PhoneNumber" target) uses the
        // wildcard resource; AWS does not expose per-phone-number ARNs.
        resources: ["*"],
      }),
    );

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        // Bedrock model ARNs are regional. Restrict to the inference profiles
        // we care about in this region; wildcard on account portion only.
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
          `arn:aws:bedrock:${this.region}:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
        ],
      }),
    );

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [schedulerRole.roleArn],
        conditions: {
          StringEquals: { "iam:PassedToService": "scheduler.amazonaws.com" },
        },
      }),
    );

    const api = new apigw.HttpApi(this, "HttpApi", {
      apiName: `eduboost-${props.stage}`,
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
        maxAge: cdk.Duration.days(1),
      },
    });

    const authorizer = new apigwAuth.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
      },
    );

    const integration = new apigwIntegrations.HttpLambdaIntegration("ApiIntegration", handler);

    api.addRoutes({
      path: "/{proxy+}",
      methods: [apigw.HttpMethod.ANY],
      integration,
      authorizer,
    });

    api.addRoutes({
      path: "/health",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    api.addRoutes({
      path: "/webhooks/{proxy+}",
      methods: [apigw.HttpMethod.POST],
      integration,
    });

    api.addRoutes({
      path: "/teachers",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    api.addRoutes({
      path: "/teachers/{proxy+}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    api.addRoutes({
      path: "/reviews/teachers/{proxy+}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    // Marketplace browse is public (no auth). Use single-segment {listingId} so that
    // authenticated subpaths (/marketplace/listings/mine, /marketplace/listings/:id/upload-url,
    // /marketplace/listings/:id/download-url, /marketplace/orders/*) still route through
    // the authenticated /{proxy+} catch-all. Note: "/marketplace/listings/mine" is a
    // separate static route added below to preempt the parametric public route.
    api.addRoutes({
      path: "/marketplace/listings",
      methods: [apigw.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/marketplace/listings/{listingId}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    api.addRoutes({
      path: "/memberships/plans",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    // Forum browsing is public (channels + posts list + single post). Mutating
    // endpoints (create post/comment, vote) hit /{proxy+} with Cognito auth.
    api.addRoutes({
      path: "/forum/channels",
      methods: [apigw.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/forum/channels/{channelId}/posts",
      methods: [apigw.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/forum/posts/{postId}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/forum/posts/{postId}/hydrated",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    // Google OAuth redirects the browser to this path without our bearer
    // token; authorization is instead carried inside the signed `state` param
    // that our /google/connect-url endpoint issued. Must be a public route.
    api.addRoutes({
      path: "/google/callback",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    // Wall browsing is public (list + single post hydrated). Write endpoints
    // (create post, comment, delete) hit /{proxy+} with Cognito auth.
    api.addRoutes({
      path: "/wall/{teacherId}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/wall/posts/{postId}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    this.apiUrl = api.apiEndpoint;

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "ApiFunctionName", { value: handler.functionName });
  }
}
