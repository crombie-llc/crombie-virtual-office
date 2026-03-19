output "ec2_ip" {
  description = "Public Elastic IP of the office server — set EC2_HOST GitHub secret to this value"
  value       = aws_eip.office_server.public_ip
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — set CF_DISTRIBUTION_ID GitHub secret to this value"
  value       = aws_cloudfront_distribution.client.id
}

output "cloudfront_url" {
  description = "CloudFront domain for the React client"
  value       = "https://${aws_cloudfront_distribution.client.domain_name}"
}

output "route53_name_servers" {
  description = "NS records to add in the parent crombie.dev zone to delegate labs.crombie.dev"
  value       = aws_route53_zone.labs.name_servers
}
