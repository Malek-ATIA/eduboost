import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface StorageStackProps extends cdk.StackProps {
  stage: string;
}

export class StorageStack extends cdk.Stack {
  public readonly uploadsBucket: s3.Bucket;
  public readonly recordingsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const common = {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: props.stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== "prod",
    };

    this.uploadsBucket = new s3.Bucket(this, "Uploads", {
      bucketName: `eduboost-${props.stage}-uploads-${cdk.Aws.ACCOUNT_ID}`,
      ...common,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
    });

    this.recordingsBucket = new s3.Bucket(this, "Recordings", {
      bucketName: `eduboost-${props.stage}-recordings-${cdk.Aws.ACCOUNT_ID}`,
      ...common,
      lifecycleRules: [
        {
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(180) },
          ],
        },
      ],
    });

    this.recordingsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowChimeMediaPipelinesWrite",
        principals: [new iam.ServicePrincipal("mediapipelines.chime.amazonaws.com")],
        actions: ["s3:PutObject", "s3:PutObjectAcl", "s3:GetBucketLocation"],
        resources: [this.recordingsBucket.bucketArn, this.recordingsBucket.arnForObjects("*")],
        conditions: {
          StringEquals: { "aws:SourceAccount": cdk.Aws.ACCOUNT_ID },
        },
      }),
    );

    new cdk.CfnOutput(this, "UploadsBucketName", { value: this.uploadsBucket.bucketName });
    new cdk.CfnOutput(this, "RecordingsBucketName", { value: this.recordingsBucket.bucketName });
  }
}
