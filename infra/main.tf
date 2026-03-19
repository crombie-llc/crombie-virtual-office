terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.6"
}

provider "aws" {
  region = var.region
}

# ACM certificate must be in us-east-1 for CloudFront
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── Route53 hosted zone (existing — coe.crombie.dev is already active) ────────
data "aws_route53_zone" "coe" {
  name         = var.domain
  private_zone = false
}

# ── EC2 Key Pair ──────────────────────────────────────────────────────────────
resource "aws_key_pair" "deploy" {
  key_name   = "crombie-office-deploy"
  public_key = var.ssh_public_key
}

# ── Security Group ────────────────────────────────────────────────────────────
resource "aws_security_group" "office_server" {
  name        = "crombie-office-server"
  description = "Allow HTTP, HTTPS and SSH to the virtual office server"

  ingress {
    description = "SSH — restricted to deployer IP only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${var.my_ip}/32"]
  }

  ingress {
    description = "HTTP (redirected to HTTPS by Nginx)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS + WebSocket"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Latest Ubuntu 24.04 AMI ───────────────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── EC2 Instance (t2.micro — free tier eligible) ──────────────────────────────
resource "aws_instance" "office_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t2.micro"
  key_name               = aws_key_pair.deploy.key_name
  vpc_security_group_ids = [aws_security_group.office_server.id]

  # Bootstrap script runs on first boot — installs Node, pm2, Nginx, clones repo
  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "crombie-office-server"
  }
}

# ── Elastic IP ────────────────────────────────────────────────────────────────
resource "aws_eip" "office_server" {
  instance = aws_instance.office_server.id
  domain   = "vpc"
}

# ── Route53: server A record ──────────────────────────────────────────────────
resource "aws_route53_record" "server" {
  zone_id = data.aws_route53_zone.coe.zone_id
  name    = "${var.server_sub}.${var.domain}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.office_server.public_ip]
}

# ── S3 bucket (client static files) ──────────────────────────────────────────
resource "aws_s3_bucket" "client" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "client" {
  bucket                  = aws_s3_bucket.client.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── ACM Certificate (wildcard, covers both subdomains) ────────────────────────
resource "aws_acm_certificate" "office" {
  provider          = aws.us_east_1
  domain_name       = "*.${var.domain}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.office.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.coe.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "office" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.office.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ── CloudFront Origin Access Control ─────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "client" {
  name                              = "crombie-office-client-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distribution ───────────────────────────────────────────────────
resource "aws_cloudfront_distribution" "client" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["${var.client_sub}.${var.domain}"]

  origin {
    domain_name              = aws_s3_bucket.client.bucket_regional_domain_name
    origin_id                = "s3-crombie-office-client"
    origin_access_control_id = aws_cloudfront_origin_access_control.client.id
  }

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-crombie-office-client"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # SPA: return index.html on 403/404 so React Router handles routing
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.office.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ── S3 bucket policy: allow CloudFront OAC ───────────────────────────────────
resource "aws_s3_bucket_policy" "client" {
  bucket = aws_s3_bucket.client.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.client.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.client.arn
        }
      }
    }]
  })
}

# ── Route53: client CNAME → CloudFront ───────────────────────────────────────
resource "aws_route53_record" "client" {
  zone_id = data.aws_route53_zone.coe.zone_id
  name    = "${var.client_sub}.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.client.domain_name]
}
