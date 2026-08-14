#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MidnightCityStack } from "../lib/midnight-city-stack";

const app = new cdk.App();

new MidnightCityStack(app, "MidnightCityStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});
