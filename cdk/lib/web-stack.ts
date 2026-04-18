import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { Nextjs } from "cdk-nextjs-standalone";
import {
  Function as CdkFunction,
  FunctionUrlAuthType,
} from "aws-cdk-lib/aws-lambda";

export interface WebStackProps extends cdk.StackProps {
  stage: string;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const site = new Nextjs(this, "Web", {
      nextjsPath: path.join(__dirname, "../../web"),
      environment: {
        NEXT_PUBLIC_API_URL: props.apiUrl,
        NEXT_PUBLIC_COGNITO_USER_POOL_ID: props.userPoolId,
        NEXT_PUBLIC_COGNITO_CLIENT_ID: props.userPoolClientId,
        NEXT_PUBLIC_AWS_REGION: this.region,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
      },
      // Switch the Next.js server + image-opt Lambda Function URLs from public
      // (AuthType=NONE) to IAM-signed. cdk-nextjs-standalone's bundled
      // sign-fn-url Lambda@Edge handler signs every CloudFront → Lambda-URL
      // request with SigV4. Correct override path is
      // overrides.nextjs.nextjsDistributionProps (not overrides.nextjsDistribution);
      // the latter is for post-construction distribution tweaks only.
      overrides: {
        nextjs: {
          nextjsDistributionProps: {
            functionUrlAuthType: FunctionUrlAuthType.AWS_IAM,
          },
        },
      },
    });

    // Lambda@Edge replicas take hours to delete cross-region, so CloudFormation
    // can't remove the edge function cleanly on stack teardown. Retain it so
    // `cdk destroy` doesn't hang for ~90 minutes on the edge-function delete.
    const edgeFn = site.distribution?.node
      .tryFindChild("EdgeFn")
      ?.node.tryFindChild("Fn");
    if (edgeFn instanceof CdkFunction) {
      edgeFn.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    }

    new cdk.CfnOutput(this, "WebUrl", { value: `https://${site.distribution.distributionDomain}` });
  }
}
