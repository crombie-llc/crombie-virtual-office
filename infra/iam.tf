
# ── GitHub Actions OIDC Provider ─────────────────────────────────────────────
# One per AWS account. If it already exists, import it:
#   terraform import aws_iam_openid_connect_provider.github \
#     arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

# ── EC2 SSM Instance Profile ──────────────────────────────────────────────────
resource "aws_iam_role" "ec2_ssm" {
  name = "crombie-office-ec2-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_ssm" {
  name = "crombie-office-ec2-ssm"
  role = aws_iam_role.ec2_ssm.name
}

# ── GitHub Actions Deploy Role (OIDC) ─────────────────────────────────────────
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "github_actions" {
  name = "crombie-office-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Only tokens from this repo can assume this role
          "token.actions.githubusercontent.com:sub" = "repo:crombie-llc/crombie-virtual-office:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "crombie-office-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Send commands to EC2 instances tagged Name=crombie-office-server
        Sid    = "SSMSendCommandInstance"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/*"
        ]
        Condition = {
          StringEquals = {
            "ssm:resourceTag/Name" = "crombie-office-server"
          }
        }
      },
      {
        # Allow using the built-in shell script document
        Sid      = "SSMSendCommandDocument"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = ["arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
      },
      {
        # Poll command status
        Sid      = "SSMGetStatus"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:DescribeInstanceInformation"]
        Resource = ["*"]
      },
      {
        # S3 sync for client bundle
        Sid    = "S3ClientDeploy"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
        Resource = [
          aws_s3_bucket.client.arn,
          "${aws_s3_bucket.client.arn}/*",
        ]
      },
      {
        # CloudFront cache invalidation after S3 sync
        Sid      = "CloudFrontInvalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = [aws_cloudfront_distribution.client.arn]
      },
    ]
  })
}
