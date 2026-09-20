# A8. IAM policy documents (proposed; placeholders `${ACCOUNT}`, `${REGION}`, `${ENV}`, `${STAGE}`, `${STACK_PREFIX}` (e.g. `pio-${ENV}-`), `${GRAPH_BUCKET}`, `${ARTIFACT_BUCKET}`, `${WS_API_ID}`, `${CFN_EXEC_ROLE_ARN}`, `${BOUNDARY_ARN}`)

Verified starting point [FACT GS-02]: the current `IamRoleLambdaExecution` grants only logs, `lambda:GetLayerVersion` on one layer, `s3:GetObject/PutObject/DeleteObject` on `plastic-io-graph-server/*`, `s3:ListBucket`, `execute-api:ManageConnections` on `arn:aws:execute-api:*:*:**/@connections/*`, and `secretsmanager:GetSecretValue` on one secret. Everything below is proposed. All documents are valid JSON (generated); action lists follow AWS action names as of the fetch date and must be re-checked against the IAM reference when implemented.

## A8.1 Request-serving Lambda role (replaces the current inline policy)
Why each statement: `StartIacOrchestrator`/`InspectOwnIacExecutions` are the only infrastructure verbs the request path needs (§4.9.6 item 1); `GraphStateByPrefix` narrows the bucket-wide grant to the prefixes the code writes (`graphs/`, `index/` [FACT], plus the new prefixes of §4.1); `AuditAndPolicyAppendOnly` + `NoDeleteOfAuditOrPolicy` make the audit chain and ACLs append-only for this role (deletion needs the break-glass role); `ManageOwnWebSocketConnections` replaces the wildcard-API grant with the deployed WebSocket API id; `TenantSecretsByPrefix` replaces the single OpenAI secret ARN with per-tenant secrets resolved by `host.secret`; `ExplicitlyNoInfraAuthority` is a belt-and-braces deny so a future edit cannot silently add infrastructure verbs to this role.
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Sid": "StartIacOrchestrator",
   "Effect": "Allow",
   "Action": [
    "states:StartExecution"
   ],
   "Resource": "arn:aws:states:${REGION}:${ACCOUNT}:stateMachine:plastic-io-iac-orchestrator-${ENV}"
  },
  {
   "Sid": "InspectOwnIacExecutions",
   "Effect": "Allow",
   "Action": [
    "states:DescribeExecution",
    "states:StopExecution"
   ],
   "Resource": "arn:aws:states:${REGION}:${ACCOUNT}:execution:plastic-io-iac-orchestrator-${ENV}:*"
  },
  {
   "Sid": "GraphStateByPrefix",
   "Effect": "Allow",
   "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject"
   ],
   "Resource": [
    "arn:aws:s3:::${GRAPH_BUCKET}/graphs/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/index/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/revisions/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/active/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/components/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/proposals/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/mutations/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/observations/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/executions/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/tasks/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/connections/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/subscriptions/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/subscriptions-reverse/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/iac/stacks/*"
   ]
  },
  {
   "Sid": "AuditAndPolicyAppendOnly",
   "Effect": "Allow",
   "Action": [
    "s3:GetObject",
    "s3:PutObject"
   ],
   "Resource": [
    "arn:aws:s3:::${GRAPH_BUCKET}/audit/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/policy/*"
   ]
  },
  {
   "Sid": "NoDeleteOfAuditOrPolicy",
   "Effect": "Deny",
   "Action": [
    "s3:DeleteObject",
    "s3:DeleteObjectVersion",
    "s3:PutBucketLifecycleConfiguration"
   ],
   "Resource": [
    "arn:aws:s3:::${GRAPH_BUCKET}/audit/*",
    "arn:aws:s3:::${GRAPH_BUCKET}/policy/*",
    "arn:aws:s3:::${GRAPH_BUCKET}"
   ]
  },
  {
   "Sid": "ListBucket",
   "Effect": "Allow",
   "Action": [
    "s3:ListBucket"
   ],
   "Resource": "arn:aws:s3:::${GRAPH_BUCKET}"
  },
  {
   "Sid": "ManageOwnWebSocketConnections",
   "Effect": "Allow",
   "Action": [
    "execute-api:ManageConnections"
   ],
   "Resource": "arn:aws:execute-api:${REGION}:${ACCOUNT}:${WS_API_ID}/${STAGE}/POST/@connections/*"
  },
  {
   "Sid": "TenantSecretsByPrefix",
   "Effect": "Allow",
   "Action": [
    "secretsmanager:GetSecretValue"
   ],
   "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:plastic-io/${ENV}/tenants/*",
   "Condition": {
    "StringEquals": {
     "secretsmanager:ResourceTag/plastic-io:env": "${ENV}"
    }
   }
  },
  {
   "Sid": "ExplicitlyNoInfraAuthority",
   "Effect": "Deny",
   "Action": [
    "cloudformation:*",
    "codebuild:*",
    "iam:*",
    "sts:AssumeRole",
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "apigateway:*"
   ],
   "Resource": "*"
  }
 ]
}
```

## A8.2 IaC orchestrator role (Step Functions state machine role)
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Sid": "ChangeSetLifecycleOnPrefixedStacksOnly",
   "Effect": "Allow",
   "Action": [
    "cloudformation:CreateChangeSet",
    "cloudformation:DescribeChangeSet",
    "cloudformation:ExecuteChangeSet",
    "cloudformation:DeleteChangeSet",
    "cloudformation:DescribeStacks",
    "cloudformation:DescribeStackEvents",
    "cloudformation:DescribeStackResources",
    "cloudformation:DetectStackDrift",
    "cloudformation:DescribeStackDriftDetectionStatus",
    "cloudformation:DescribeStackResourceDrifts",
    "cloudformation:CancelUpdateStack",
    "cloudformation:ContinueUpdateRollback",
    "cloudformation:DeleteStack"
   ],
   "Resource": "arn:aws:cloudformation:${REGION}:${ACCOUNT}:stack/${STACK_PREFIX}*/*",
   "Condition": {
    "StringEqualsIfExists": {
     "cloudformation:RoleArn": "${CFN_EXEC_ROLE_ARN}"
    },
    "ForAllValues:StringLike": {
     "cloudformation:TemplateUrl": "https://${ARTIFACT_BUCKET}.s3.${REGION}.amazonaws.com/iac/templates/*"
    }
   }
  },
  {
   "Sid": "ListStacksForStatusOnly",
   "Effect": "Allow",
   "Action": [
    "cloudformation:ListStacks",
    "cloudformation:ListChangeSets"
   ],
   "Resource": "*"
  },
  {
   "Sid": "PassOnlyTheExecutionRoleToCloudFormation",
   "Effect": "Allow",
   "Action": [
    "iam:PassRole"
   ],
   "Resource": "${CFN_EXEC_ROLE_ARN}",
   "Condition": {
    "StringEquals": {
     "iam:PassedToService": "cloudformation.amazonaws.com"
    }
   }
  },
  {
   "Sid": "ReadTemplatesAndSources",
   "Effect": "Allow",
   "Action": [
    "s3:GetObject"
   ],
   "Resource": [
    "arn:aws:s3:::${ARTIFACT_BUCKET}/iac/templates/*",
    "arn:aws:s3:::${ARTIFACT_BUCKET}/iac/sources/*"
   ]
  },
  {
   "Sid": "OptionalBuild",
   "Effect": "Allow",
   "Action": [
    "codebuild:StartBuild",
    "codebuild:BatchGetBuilds",
    "codebuild:StopBuild"
   ],
   "Resource": "arn:aws:codebuild:${REGION}:${ACCOUNT}:project/plastic-io-iac-${ENV}"
  },
  {
   "Sid": "FeedbackIntoGraphServer",
   "Effect": "Allow",
   "Action": [
    "lambda:InvokeFunction"
   ],
   "Resource": "arn:aws:lambda:${REGION}:${ACCOUNT}:function:plastic-io-graph-server-${STAGE}-iacFeedback"
  },
  {
   "Sid": "CallbackTokens",
   "Effect": "Allow",
   "Action": [
    "states:SendTaskSuccess",
    "states:SendTaskFailure",
    "states:SendTaskHeartbeat"
   ],
   "Resource": "*"
  },
  {
   "Sid": "NeverTouchTheSubstrate",
   "Effect": "Deny",
   "Action": [
    "cloudformation:*"
   ],
   "Resource": [
    "arn:aws:cloudformation:${REGION}:${ACCOUNT}:stack/plastic-io-graph-server*/*",
    "arn:aws:cloudformation:${REGION}:${ACCOUNT}:stack/plastic-io-iac-orchestrator*/*"
   ]
  }
 ]
}
```
Notes: `cloudformation:RoleArn` and `cloudformation:TemplateUrl` are CloudFormation-specific condition keys; `StringEqualsIfExists` on `RoleArn` still forces the execution role for every operation that accepts one (Create/Execute change set, DeleteStack) while allowing pure describes. `ListStacks` needs `*` by AWS semantics. `NeverTouchTheSubstrate` is the self-modification guard (§4.9.6).

## A8.3 CloudFormation execution role
Trust policy (only CloudFormation, only from this account's prefixed stacks):
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Effect": "Allow",
   "Principal": {
    "Service": "cloudformation.amazonaws.com"
   },
   "Action": "sts:AssumeRole",
   "Condition": {
    "StringEquals": {
     "aws:SourceAccount": "${ACCOUNT}"
    },
    "ArnLike": {
     "aws:SourceArn": "arn:aws:cloudformation:${REGION}:${ACCOUNT}:stack/${STACK_PREFIX}*/*"
    }
   }
  }
 ]
}
```
Permissions (the one place service-level wildcards are accepted, bounded by name prefixes, the permissions boundary and explicit denies):
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Sid": "ApplicationResourcesByNamePrefix",
   "Effect": "Allow",
   "Action": [
    "lambda:*",
    "apigateway:*",
    "logs:*",
    "events:*",
    "sqs:*",
    "sns:*",
    "dynamodb:*",
    "s3:*",
    "states:*",
    "secretsmanager:CreateSecret",
    "secretsmanager:TagResource",
    "secretsmanager:DeleteSecret",
    "secretsmanager:DescribeSecret",
    "secretsmanager:UpdateSecret"
   ],
   "Resource": [
    "arn:aws:lambda:${REGION}:${ACCOUNT}:function:${STACK_PREFIX}*",
    "arn:aws:apigateway:${REGION}::/*",
    "arn:aws:logs:${REGION}:${ACCOUNT}:log-group:/aws/lambda/${STACK_PREFIX}*",
    "arn:aws:events:${REGION}:${ACCOUNT}:rule/${STACK_PREFIX}*",
    "arn:aws:sqs:${REGION}:${ACCOUNT}:${STACK_PREFIX}*",
    "arn:aws:sns:${REGION}:${ACCOUNT}:${STACK_PREFIX}*",
    "arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${STACK_PREFIX}*",
    "arn:aws:s3:::${STACK_PREFIX}*",
    "arn:aws:s3:::${STACK_PREFIX}*/*",
    "arn:aws:states:${REGION}:${ACCOUNT}:stateMachine:${STACK_PREFIX}*",
    "arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:${STACK_PREFIX}*"
   ]
  },
  {
   "Sid": "ReadOnlyDescribes",
   "Effect": "Allow",
   "Action": [
    "lambda:GetFunction",
    "lambda:ListFunctions",
    "logs:DescribeLogGroups",
    "s3:ListAllMyBuckets",
    "dynamodb:ListTables",
    "iam:GetRole",
    "iam:GetRolePolicy",
    "iam:ListRolePolicies",
    "iam:ListAttachedRolePolicies"
   ],
   "Resource": "*"
  },
  {
   "Sid": "CreateRolesOnlyWithTheBoundary",
   "Effect": "Allow",
   "Action": [
    "iam:CreateRole",
    "iam:PutRolePolicy",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:UpdateRole",
    "iam:UpdateAssumeRolePolicy",
    "iam:TagRole"
   ],
   "Resource": "arn:aws:iam::${ACCOUNT}:role/${STACK_PREFIX}*",
   "Condition": {
    "StringEquals": {
     "iam:PermissionsBoundary": "${BOUNDARY_ARN}"
    }
   }
  },
  {
   "Sid": "DeleteOwnRoles",
   "Effect": "Allow",
   "Action": [
    "iam:DeleteRole",
    "iam:UntagRole"
   ],
   "Resource": "arn:aws:iam::${ACCOUNT}:role/${STACK_PREFIX}*"
  },
  {
   "Sid": "PassOnlyPrefixedRolesToApplicationServices",
   "Effect": "Allow",
   "Action": [
    "iam:PassRole"
   ],
   "Resource": "arn:aws:iam::${ACCOUNT}:role/${STACK_PREFIX}*",
   "Condition": {
    "StringEquals": {
     "iam:PassedToService": [
      "lambda.amazonaws.com",
      "states.amazonaws.com",
      "events.amazonaws.com",
      "apigateway.amazonaws.com"
     ]
    }
   }
  },
  {
   "Sid": "HardDenies",
   "Effect": "Deny",
   "Action": [
    "iam:CreateUser",
    "iam:CreateAccessKey",
    "iam:PutUserPolicy",
    "iam:AttachUserPolicy",
    "iam:CreatePolicyVersion",
    "iam:SetDefaultPolicyVersion",
    "iam:DeleteRolePermissionsBoundary",
    "iam:PutRolePermissionsBoundary",
    "organizations:*",
    "account:*",
    "sts:AssumeRole",
    "cloudformation:*",
    "codebuild:*",
    "kms:ScheduleKeyDeletion",
    "s3:PutBucketPolicy"
   ],
   "Resource": "*"
  },
  {
   "Sid": "DenyTouchingTheSubstrate",
   "Effect": "Deny",
   "Action": "*",
   "Resource": [
    "arn:aws:s3:::${GRAPH_BUCKET}",
    "arn:aws:s3:::${GRAPH_BUCKET}/*",
    "arn:aws:lambda:${REGION}:${ACCOUNT}:function:plastic-io-graph-server-*",
    "arn:aws:iam::${ACCOUNT}:role/plastic-io-*"
   ]
  }
 ]
}
```

## A8.4 Permissions boundary attached to every role a template may create
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Sid": "BoundaryAllow",
   "Effect": "Allow",
   "Action": [
    "lambda:InvokeFunction",
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "dynamodb:*",
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket",
    "sqs:*",
    "sns:Publish",
    "states:StartExecution",
    "secretsmanager:GetSecretValue",
    "xray:PutTraceSegments",
    "xray:PutTelemetryRecords"
   ],
   "Resource": "*",
   "Condition": {
    "StringEquals": {
     "aws:RequestedRegion": "${REGION}"
    }
   }
  },
  {
   "Sid": "BoundaryDeny",
   "Effect": "Deny",
   "Action": [
    "iam:*",
    "sts:AssumeRole",
    "cloudformation:*",
    "codebuild:*",
    "organizations:*",
    "account:*",
    "ec2:*",
    "kms:*"
   ],
   "Resource": "*"
  },
  {
   "Sid": "BoundaryDenySubstrate",
   "Effect": "Deny",
   "Action": "*",
   "Resource": [
    "arn:aws:s3:::${GRAPH_BUCKET}",
    "arn:aws:s3:::${GRAPH_BUCKET}/*"
   ]
  }
 ]
}
```

## A8.5 CodeBuild service role (optional build step)
```json
{
 "Version": "2012-10-17",
 "Statement": [
  {
   "Sid": "Logs",
   "Effect": "Allow",
   "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
   ],
   "Resource": "arn:aws:logs:${REGION}:${ACCOUNT}:log-group:/aws/codebuild/plastic-io-iac-${ENV}*"
  },
  {
   "Sid": "Sources",
   "Effect": "Allow",
   "Action": [
    "s3:GetObject",
    "s3:GetObjectVersion"
   ],
   "Resource": "arn:aws:s3:::${ARTIFACT_BUCKET}/iac/sources/*"
  },
  {
   "Sid": "Outputs",
   "Effect": "Allow",
   "Action": [
    "s3:PutObject"
   ],
   "Resource": "arn:aws:s3:::${ARTIFACT_BUCKET}/iac/build-outputs/*"
  },
  {
   "Sid": "NoInfra",
   "Effect": "Deny",
   "Action": [
    "cloudformation:*",
    "iam:*",
    "sts:*",
    "lambda:*",
    "secretsmanager:*"
   ],
   "Resource": "*"
  }
 ]
}
```
Egress: the CodeBuild project runs with `privilegedMode:false`, no VPC by default; if a VPC is used the security group allows only the package registries on the allow-list (open question Q-4).

## A8.6 EventBridge rule pattern feeding the orchestrator callbacks (§4.9.5)
```json
{
 "source": [
  "aws.cloudformation"
 ],
 "detail-type": [
  "CloudFormation Stack Status Change",
  "CloudFormation Resource Status Change",
  "CloudFormation Drift Detection Status Change"
 ],
 "detail": {
  "stack-id": [
   {
    "prefix": "arn:aws:cloudformation:${REGION}:${ACCOUNT}:stack/${STACK_PREFIX}"
   }
  ]
 }
}
```
Target: the state machine's callback Lambda (`SendTaskSuccess` with the task token stored under `iac/operations/<operationId>/token`), with a 60 s `DescribeStacks` poll as fallback because delivery is at-least-once, not exactly-once (A4).

## A8.7 Escalation checks these documents enforce (§4.9.6 analysis → statement)
| Threat | Enforced by |
|---|---|
| Template creates an admin role | A8.3 `CreateRolesOnlyWithTheBoundary` + A8.4 `BoundaryDeny iam:*` |
| Template escalates via `iam:PassRole` to a non-prefixed role | A8.3 `PassOnlyPrefixedRolesToApplicationServices` |
| Template edits the graph bucket, graph-server functions or substrate roles | A8.3 `DenyTouchingTheSubstrate`, A8.2 `NeverTouchTheSubstrate`, A8.4 `BoundaryDenySubstrate` |
| Orchestrator uses a template outside the artifact bucket | A8.2 `TemplateUrl` condition |
| Request-serving Lambda gains infrastructure verbs by a later edit | A8.1 `ExplicitlyNoInfraAuthority` (explicit deny wins) |
| Build job reaches CloudFormation or secrets | A8.5 `NoInfra` |
| Custom resources / macros | not IAM: rejected by the validator unless allow-listed (§4.9.6); if allowed, their Lambdas are created under the boundary |
