import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 Bucket to store uploaded documents
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For practice, automatically delete Bucket when Stack is deleted
      autoDeleteObjects: true, // For practice, automatically delete files when Stack is deleted
    });

    // Create EventBridge Rule to trigger on S3 PutObject events
    const s3PutEventRule = new events.Rule(this, 'S3PutEventRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        resources: [documentsBucket.bucketArn],
      },
    });


    const resultsTable = new dynamodb.Table(this, 'ResultsTable', {
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Practice: automatically delete Table when Stack is deleted
    });

    // Create Lambda Function to process documents
    const processDocumentLambda = new lambda.Function(this, 'ProcessDocumentLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const ddb = new AWS.DynamoDB.DocumentClient();
        exports.handler = async (event) => {
          const documentId = event.id || 'test-id';
          await ddb.put({
            TableName: process.env.TABLE_NAME,
            Item: { documentId, result: "Document processed" }
          }).promise();
          return { statusCode: 200, body: "Document processed and saved." };
        };
      `),
      environment: {
        TABLE_NAME: resultsTable.tableName,
      },
    });
    resultsTable.grantWriteData(processDocumentLambda);

    // Grant Lambda permission to read from the S3 Bucket
    s3PutEventRule.addTarget(new targets.LambdaFunction(processDocumentLambda));

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