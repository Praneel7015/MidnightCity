import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaBase from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as path from "path";

export class MidnightCityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const liveryFn = new lambda.NodejsFunction(this, "LiveryFn", {
      functionName: "midnight-city-livery",
      entry: path.join(__dirname, "../../backend/lambdas/livery/index.mjs"),
      handler: "handler",
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
      bundling: {
        format: lambda.OutputFormat.ESM,
        target: "node20",
      },
      environment: {
        BEDROCK_MODEL_ID: "apac.amazon.nova-micro-v1:0",
      },
    });

    liveryFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    const httpApi = new apigw.HttpApi(this, "MidnightCityHttpApi", {
      apiName: "midnight-city-api",
      corsPreflight: {
        allowHeaders: ["Content-Type"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"],
      },
    });

    const integration = new apigwIntegrations.HttpLambdaIntegration("LiveryIntegration", liveryFn);
    httpApi.addRoutes({ path: "/livery", methods: [apigw.HttpMethod.POST], integration });
    httpApi.addRoutes({ path: "/livery", methods: [apigw.HttpMethod.GET], integration });

    const siteBucket = new s3.Bucket(this, "MidnightCityFrontendBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const distribution = new cloudfront.Distribution(this, "MidnightCityDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [{ httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" }],
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "FrontendBucketName", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "CloudFrontDomain", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "CloudFrontDistributionId", { value: distribution.distributionId });
  }
}
