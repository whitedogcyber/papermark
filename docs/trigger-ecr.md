# Trigger.dev images on ECR

Trigger.dev deploy images are pushed to Amazon ECR in us-east-2 instead of the in-cluster registry. ECR has no storage limit or proxy timeouts, and a lifecycle rule removes old images.

Replace `<ACCOUNT>` with the AWS account ID below.

## 1. Repository

The image name is `<registry>/<namespace>/<project>`, so with namespace `trigger` the repository is `trigger/proj_uytxulrjajpkcjuqutul`. Staging and prod share it; tags carry the environment.

```sh
aws ecr create-repository --region us-east-2 \
  --repository-name trigger/proj_uytxulrjajpkcjuqutul \
  --image-scanning-configuration scanOnPush=true

aws ecr put-lifecycle-policy --region us-east-2 \
  --repository-name trigger/proj_uytxulrjajpkcjuqutul \
  --lifecycle-policy-text '{
    "rules": [{
      "rulePriority": 1,
      "description": "Keep the last 30 images",
      "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 30 },
      "action": { "type": "expire" }
    }]
  }'
```

## 2. GitHub Actions role (`vars.AWS_ROLE_ARN`)

The deploy-trigger job now uses the same OIDC role as the deploy job. Add this to that role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:DescribeRepositories"
      ],
      "Resource": "arn:aws:ecr:us-east-2:<ACCOUNT>:repository/trigger/*"
    }
  ]
}
```

Its trust policy must allow both the `Stage` and `Prod` GitHub environments (it already does if the deploy job works in both).

## 3. Trigger.dev Helm values

```yaml
registry:
  deploy: false
  repositoryNamespace: "trigger"
  external:
    host: "<ACCOUNT>.dkr.ecr.us-east-2.amazonaws.com"
    auth:
      enabled: false
```

When the host is ECR, the webapp talks to ECR itself, so it needs AWS credentials. Give the webapp service account an IRSA role with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": ["ecr:DescribeRepositories", "ecr:CreateRepository", "ecr:TagResource"],
      "Resource": "arn:aws:ecr:us-east-2:<ACCOUNT>:repository/trigger/*"
    }
  ]
}
```

Some Trigger.dev versions require `DEPLOY_REGISTRY_ECR_ASSUME_ROLE_ARN` even in the same account (deploy fails with "Failed to get deployment image ref"). If you see that, set it on the webapp to a role the webapp's IRSA role can assume, with the policy above.

## 4. Worker pulls

On EKS, task pods pull with the node role. Make sure the node group role has `AmazonEC2ContainerRegistryReadOnly`. No image pull secret is needed.

## 5. Clean up

After a successful deploy:

- Remove the `DOCKER_REGISTRY`, `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets from the Stage and Prod environments.
- Scale down or remove the in-cluster registry.
