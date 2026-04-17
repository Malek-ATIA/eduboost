import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION ?? "eu-west-1";

export const ddbClient = new DynamoDBClient({ region });
export const ddbDoc = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
});

export const TABLE_NAME = process.env.TABLE_NAME ?? "eduboost";
