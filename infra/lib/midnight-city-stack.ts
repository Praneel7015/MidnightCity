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
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";

export class MidnightCityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── DynamoDB table: stores the agent's daily output ────────────────────
    const agentTable = new dynamodb.Table(this, "AgentTable", {
      tableName: "midnight-city-agent",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── Shared Bedrock IAM statement ────────────────────────────────────────
    const bedrockPolicy = new iam.PolicyStatement({
      sid: "BedrockNovaInvoke",
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream",
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-micro-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova*`,
        "arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0",
        "arn:aws:bedrock:*::foundation-model/amazon.nova*",
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:application-inference-profile/*`,
      ],
    });

    // ── Livery Lambda (on-demand, called by the game) ───────────────────────
    const liveryFn = new lambda.NodejsFunction(this, "LiveryFn", {
      functionName: "midnight-city-livery",
      entry: path.join(__dirname, "../../backend/lambdas/livery/index.mjs"),
      handler: "handler",
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(20),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
      bundling: { format: lambda.OutputFormat.ESM, target: "node20" },
      environment: {
        BEDROCK_MODEL_ID: "apac.amazon.nova-micro-v1:0",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        AGENT_TABLE: agentTable.tableName,
      },
    });
    liveryFn.addToRolePolicy(bedrockPolicy);
    agentTable.grantReadData(liveryFn);

    // ── Agent Lambda (scheduled, writes daily livery + mood to DynamoDB) ───
    const agentFn = new lambda.NodejsFunction(this, "AgentFn", {
      functionName: "midnight-city-agent",
      entry: path.join(__dirname, "../../backend/lambdas/agent/index.mjs"),
      handler: "handler",
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
      bundling: { format: lambda.OutputFormat.ESM, target: "node20" },
      environment: {
        BEDROCK_MODEL_ID: "apac.amazon.nova-micro-v1:0",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        AGENT_TABLE: agentTable.tableName,
      },
    });
    agentFn.addToRolePolicy(bedrockPolicy);
    agentTable.grantWriteData(agentFn);

    // EventBridge rule: fires every day at 18:30 UTC (midnight IST)
    new events.Rule(this, "DailyAgentRule", {
      ruleName: "midnight-city-daily-agent",
      schedule: events.Schedule.cron({ minute: "30", hour: "18" }),
      targets: [new targets.LambdaFunction(agentFn)],
    });

    // ── API Gateway ─────────────────────────────────────────────────────────
    const httpApi = new apigw.HttpApi(this, "MidnightCityHttpApi", {
      apiName: "midnight-city-api",
      corsPreflight: {
        allowHeaders: ["Content-Type"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"],
      },
    });

    const liveryInt = new apigwIntegrations.HttpLambdaIntegration("LiveryIntegration", liveryFn);
    httpApi.addRoutes({ path: "/livery",     methods: [apigw.HttpMethod.POST], integration: liveryInt });
    httpApi.addRoutes({ path: "/livery",     methods: [apigw.HttpMethod.GET],  integration: liveryInt });
    httpApi.addRoutes({ path: "/commentary", methods: [apigw.HttpMethod.POST], integration: liveryInt });
    httpApi.addRoutes({ path: "/commentary", methods: [apigw.HttpMethod.GET],  integration: liveryInt });
    // /today returns today's agent-generated livery + mood from DynamoDB
    httpApi.addRoutes({ path: "/today",      methods: [apigw.HttpMethod.GET],  integration: liveryInt });

    // ── S3 + CloudFront ──────────────────────────────────────────────────────
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

    new cdk.CfnOutput(this, "ApiUrl",                  { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "FrontendBucketName",      { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "CloudFrontDomain",        { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "CloudFrontDistributionId",{ value: distribution.distributionId });
    new cdk.CfnOutput(this, "AgentTableName",          { value: agentTable.tableName });
  }
}
