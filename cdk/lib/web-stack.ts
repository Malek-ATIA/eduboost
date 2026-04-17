import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { Nextjs } from "cdk-nextjs-standalone";

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
    });

    new cdk.CfnOutput(this, "WebUrl", { value: `https://${site.distribution.distributionDomain}` });
  }
}
