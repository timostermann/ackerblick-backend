variable "hcloud_token" {
  description = "Hetzner Cloud API token (create at console.hetzner.cloud → Project → Security → API Tokens)"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (Permissions: Zone:DNS:Edit for ackerblick.com)"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for ackerblick.com (found on the Cloudflare domain overview page)"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key content to add to the server (e.g. contents of ~/.ssh/id_ed25519.pub)"
  type        = string
}
