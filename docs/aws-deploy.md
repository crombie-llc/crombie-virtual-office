# AWS Deployment — Crombie Virtual Office

## Architecture

```
Teammate's Claude Code
  └─ PreToolUse hook
       └─ office-hook.js
            └─ POST https://office.labs.crombie.dev/event
                     │
              [Route53 A record]
                     │
              EC2 t2.micro (free tier year 1, ~$8.47/mo after)
              └─ Nginx (443 SSL — Let's Encrypt)
                   └─ proxy_pass → Node.js :3001
                        └─ Express + ws
                             └─ in-memory StateManager
                                  └─ broadcast → WebSocket clients

Browser → https://office-app.labs.crombie.dev
               │
        [Route53 CNAME]
               │
        CloudFront (~$0.50/mo)
               └─ S3 bucket
                    └─ React SPA (Vite dist/)
                         └─ VITE_WS_URL=wss://office.labs.crombie.dev
```

## Cost Estimate

| Resource | Monthly |
|----------|---------|
| EC2 t2.micro (free tier, year 1) | $0.00 |
| EC2 t2.micro (after free tier) | $8.47 |
| S3 storage + requests | ~$0.10 |
| CloudFront data transfer | ~$0.50 |
| Route53 hosted zone | $0.50 |
| Let's Encrypt SSL | $0.00 |
| **Total year 1** | **~$1–2/month** |
| **Total after free tier** | **~$10–11/month** |

## Prerequisites

- AWS account with permissions to create EC2, S3, CloudFront, Route53, ACM, IAM
- Terraform ≥ 1.6 installed locally
- SSH key pair (`~/.ssh/id_rsa.pub`)
- `crombie.dev` DNS managed somewhere (Route53 or external registrar)

## First-time Deployment

### 1. Provision infrastructure with Terraform

```bash
cd infra
terraform init
terraform plan -var="ssh_public_key=$(cat ~/.ssh/id_rsa.pub)"
terraform apply -var="ssh_public_key=$(cat ~/.ssh/id_rsa.pub)"
```

This creates:
- EC2 t2.micro with Elastic IP
- Security group (ports 22, 80, 443)
- S3 bucket (private, CloudFront-only access)
- CloudFront distribution for the React SPA
- ACM wildcard cert `*.labs.crombie.dev` (DNS-validated automatically)
- Route53 hosted zone for `labs.crombie.dev`
- DNS records: `office.labs.crombie.dev` → EC2 EIP, `office-app.labs.crombie.dev` → CloudFront

### 2. Delegate labs.crombie.dev DNS

After `terraform apply`, get the name servers:

```bash
terraform output route53_name_servers
```

Add an NS record in the parent `crombie.dev` zone pointing to these name servers. This delegates `labs.crombie.dev` to the Route53 hosted zone Terraform created.

> If `labs.crombie.dev` already has a hosted zone in Route53, use `data "aws_route53_zone"` in `infra/main.tf` instead of `resource "aws_route53_zone"`.

### 3. Enable HTTPS (run once after DNS propagates ~5 min)

```bash
EC2_IP=$(terraform output -raw ec2_ip)
ssh ubuntu@$EC2_IP \
  "sudo certbot --nginx -d office.labs.crombie.dev \
   --non-interactive --agree-tos -m devops@crombie.dev"
```

### 4. Set GitHub Actions secrets

In the repository Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | `terraform output -raw ec2_ip` |
| `EC2_SSH_KEY` | Private key matching the public key used in Terraform |
| `S3_BUCKET` | `crombie-office-client` |
| `CF_DISTRIBUTION_ID` | `terraform output -raw cloudfront_distribution_id` |
| `AWS_ACCESS_KEY_ID` | IAM user key with S3 + CloudFront permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |

### 5. Deploy via CI/CD

Push to `main` — GitHub Actions automatically:
1. Builds the server TypeScript → pulls to EC2 via SSH → `pm2 restart crombie-office`
2. Builds the React client with `VITE_WS_URL=wss://office.labs.crombie.dev` → syncs to S3 → invalidates CloudFront

## Ongoing Operations

### Restarting the server manually

```bash
ssh ubuntu@<ec2_ip> "pm2 restart crombie-office"
```

### Checking server health

```bash
curl https://office.labs.crombie.dev/state
# Expected: {} (empty state when no one is active)
```

### Viewing server logs

```bash
ssh ubuntu@<ec2_ip> "pm2 logs crombie-office --lines 50"
```

### Renewing SSL certificate (auto-renews via cron)

```bash
ssh ubuntu@<ec2_ip> "sudo certbot renew --dry-run"
```

## Verification Checklist

1. `curl https://office.labs.crombie.dev/state` → `{}`
2. Open `https://office-app.labs.crombie.dev` → office UI loads
3. Manual hook test:
   ```bash
   echo '{"hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{}}' \
     | node ~/.crombie-office/office-hook.js
   curl https://office.labs.crombie.dev/state
   # Should show your dev name online
   ```
4. Teammate runs `npm start` in `agents-configuration` → Virtual Office → URL pre-filled as `https://office.labs.crombie.dev`
5. Teammate opens Claude Code → both devs visible in office

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| State lost on EC2 restart | Acceptable — presence auto-recovers on first tool use via SESSION_LOCK |
| EC2 hardware failure | pm2 auto-restarts process; hardware failure requires manual `terraform apply` to replace |
| SSH key compromised | Rotate keypair: update `aws_key_pair` in Terraform + `EC2_SSH_KEY` secret |
| Domain not controlled | Use EC2 EIP directly in hook config until DNS is sorted |
