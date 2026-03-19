variable "region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "domain" {
  description = "Parent hosted zone domain"
  default     = "labs.crombie.dev"
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
