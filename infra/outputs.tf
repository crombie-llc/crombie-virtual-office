output "ec2_ip" {
  description = "Public Elastic IP of the office server"
  value       = aws_eip.office_server.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID — set EC2_INSTANCE_ID GitHub secret to this value"
  value       = aws_instance.office_server.id
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC — set AWS_ROLE_TO_ASSUME GitHub secret to this value"
  value       = aws_iam_role.github_actions.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — set CF_DISTRIBUTION_ID GitHub secret to this value"
  value       = aws_cloudfront_distribution.client.id
}

output "cloudfront_url" {
  description = "CloudFront domain for the React client"
  value       = "https://${aws_cloudfront_distribution.client.domain_name}"
}
