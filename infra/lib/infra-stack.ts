import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 Bucket to store uploaded documents
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For practice, automatically delete Bucket when Stack is deleted
      autoDeleteObjects: true, // For practice, automatically delete files when Stack is deleted
    });

    // Create DynamoDB Table to store results
    const resultsTable = new dynamodb.Table(this, 'ResultsTable', {
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Practice: automatically delete Table when Stack is deleted
    });

    // Create Lambda Function to process documents
    const processDocumentLambda = new lambda.Function(this, 'ProcessDocumentLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
        exports.handler = async (event) => {
          const client = new DynamoDBClient();
          const documentId = event.Records?.[0]?.s3?.object?.key || 'test-id';
          await client.send(new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              documentId: { S: documentId },
              result: { S: "Document processed" }
            }
          }));
          return { statusCode: 200, body: "Document processed and saved." };
        };
      `),
      environment: {
        TABLE_NAME: resultsTable.tableName,
      },
    });
    resultsTable.grantWriteData(processDocumentLambda);

    // 建立 DocumentSplitLambda
    const documentSplitLambda = new lambda.Function(this, 'DocumentSplitLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/document-split'),
      environment: {
        BUCKET_NAME: documentsBucket.bucketName,
      },
    });
    documentsBucket.grantReadWrite(documentSplitLambda);

    // S3 只觸發 DocumentSplitLambda
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(documentSplitLambda)
    );

    const lambdaTask = new tasks.LambdaInvoke(this, 'ProcessDocumentTask', {
      lambdaFunction: processDocumentLambda,
      outputPath: '$.Payload',
    });

    const stateMachine = new sfn.StateMachine(this, 'DocumentProcessingStateMachine', {
      definition: lambdaTask,
      timeout: cdk.Duration.minutes(5),
    });
  }
}