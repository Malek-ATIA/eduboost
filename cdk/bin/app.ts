#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DbStack } from "../lib/db-stack";
import { AuthStack } from "../lib/auth-stack";
import { StorageStack } from "../lib/storage-stack";
import { ApiStack } from "../lib/api-stack";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

const env = { region: "eu-west-1" };
const stage = app.node.tryGetContext("stage") ?? "dev";
const prefix = `EduBoost`;
const tags = { project: "eduboost", stage };

const db = new DbStack(app, `${prefix}-Db`, { env, tags, stage });
const auth = new AuthStack(app, `${prefix}-Auth`, { env, tags, stage, table: db.table });
const storage = new StorageStack(app, `${prefix}-Storage`, { env, tags, stage });

const api = new ApiStack(app, `${prefix}-Api`, {
  env,
  tags,
  stage,
  table: db.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  uploadsBucket: storage.uploadsBucket,
  recordingsBucket: storage.recordingsBucket,
});

new WebStack(app, `${prefix}-Web`, {
  env,
  tags,
  stage,
  apiUrl: api.apiUrl,
  userPoolId: auth.userPool.userPoolId,
  userPoolClientId: auth.userPoolClient.userPoolClientId,
});
