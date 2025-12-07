import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket to store uploaded documents
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      eventBridgeEnabled: true, // Enable EventBridge notifications
    });

    // 2. DynamoDB Table to store results
    const resultsTable = new dynamodb.Table(this, 'ResultsTable', {
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Document Splitting Lambda (The first step in our workflow)
    const documentSplitLambda = new lambda.Function(this, 'DocumentSplitLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/document-split'),
      environment: {
        BUCKET_NAME: documentsBucket.bucketName,
        TABLE_NAME: resultsTable.tableName,
      },
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    });

    // Grant necessary permissions to the Lambda
    documentsBucket.grantRead(documentSplitLambda); // Lambda needs to read the uploaded file
    resultsTable.grantWriteData(documentSplitLambda); // Lambda will write analysis results

    // Add more flexible Bedrock and new Textract permissions
    documentSplitLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`], // More flexible
      })
    );
    documentSplitLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:StartDocumentTextDetection'], // Permission to start Textract job
        resources: ['*'], // Textract actions are not resource-specific in this way
      })
    );

    // 4. NEW: Lambda to get Textract results and call Bedrock
    const analyzeTextractOutputLambda = new lambda.Function(this, 'AnalyzeTextractOutputLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/analyze-textract-output'),
      environment: {
        TABLE_NAME: resultsTable.tableName,
      },
      timeout: cdk.Duration.minutes(3), // Give it more time for Textract polling and Bedrock call
      memorySize: 1024,
    });

    // Grant necessary permissions
    resultsTable.grantReadWriteData(analyzeTextractOutputLambda); // To update the status
    analyzeTextractOutputLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:GetDocumentTextDetection'],
        resources: ['*'],
      })
    );
    analyzeTextractOutputLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
      })
    );


    // 5. Step Functions State Machine Definition
    const splitDocumentTask = new tasks.LambdaInvoke(this, 'StartTextractJob', {
      lambdaFunction: documentSplitLambda,
      // Pass the S3 object key from the event to the Lambda
      payload: sfn.TaskInput.fromObject({
        // The event from EventBridge will be in 'detail'
        's3_key.$': '$.detail.object.key',
        's3_bucket.$': '$.detail.bucket.name',
      }),
      outputPath: '$.Payload',
    });

    const waitState = new sfn.Wait(this, 'WaitForTextract', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(15)),
    });

    const getResultsTask = new tasks.LambdaInvoke(this, 'GetTextractAndAnalyze', {
      lambdaFunction: analyzeTextractOutputLambda,
      inputPath: '$', // Pass the entire state to the lambda
      outputPath: '$.Payload',
    });

    const jobFailed = new sfn.Fail(this, 'JobFailed', {
      cause: 'Textract Job Failed',
      error: 'TextractJobFailed',
    });

    const definition = splitDocumentTask
      .next(waitState)
      .next(getResultsTask);
      // In a full implementation, you would add a Choice state here
      // to check the status from getResultsTask and either loop back to waitState,
      // proceed to the next step, or go to the jobFailed state.
      // For this prototype, we will keep it linear.

    const stateMachine = new sfn.StateMachine(this, 'DocumentProcessingStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(10), // Increased timeout for the whole workflow
    });

    // 6. EventBridge Rule to trigger the State Machine
    new events.Rule(this, 'S3ObjectCreatedRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [documentsBucket.bucketName],
          },
        },
      },
      targets: [new targets.SfnStateMachine(stateMachine)],
    });
  }
}