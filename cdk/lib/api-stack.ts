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
        externalModules: ["@aws-sdk/*"],
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

    this.apiUrl = api.apiEndpoint;

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "ApiFunctionName", { value: handler.functionName });
  }
}
