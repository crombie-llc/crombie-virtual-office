variable "region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "domain" {
  description = "Hosted zone domain (must already exist in Route53)"
  default     = "coe.crombie.dev"
}

variable "server_sub" {
  description = "Subdomain for the WebSocket/HTTP server"
  default     = "office"
}

variable "client_sub" {
  description = "Subdomain for the React SPA"
  default     = "office-app"
}

variable "bucket_name" {
  description = "S3 bucket name for the React client static files"
  default     = "crombie-office-client"
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access (paste contents of ~/.ssh/id_rsa.pub)"
  type        = string
}

variable "my_ip" {
  description = "Your public IP in CIDR notation (e.g. 1.2.3.4/32) — restricts SSH access to only your machine"
  type        = string
}
