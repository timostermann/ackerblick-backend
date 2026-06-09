terraform {
  required_version = ">= 1.6"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.47"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # State is local for now; migrate to remote (Terraform Cloud / S3) before team use.
  # See README § Deployment > Terraform state.
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ---------------------------------------------------------------------------
# SSH key
# ---------------------------------------------------------------------------

resource "hcloud_ssh_key" "ackerblick" {
  name       = "ackerblick-deploy"
  public_key = var.ssh_public_key
}

# ---------------------------------------------------------------------------
# Firewall — allow 22/80/443 inbound; block everything else
# ---------------------------------------------------------------------------

resource "hcloud_firewall" "ackerblick" {
  name = "ackerblick-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# ---------------------------------------------------------------------------
# Server — cx23 (2 vCPU / 4 GB), Ubuntu 24.04, Nuremberg (eu-central)
# ---------------------------------------------------------------------------

resource "hcloud_server" "ackerblick" {
  name         = "ackerblick-backend"
  server_type  = "cx23"
  image        = "ubuntu-24.04"
  location     = "nbg1"
  ssh_keys     = [hcloud_ssh_key.ackerblick.id]
  firewall_ids = [hcloud_firewall.ackerblick.id]
}

# ---------------------------------------------------------------------------
# Block Volume — DB data persists independently of the server lifecycle.
# Mount path is set explicitly in bootstrap.sh (/mnt/ackerblick-db) because
# automount = true uses /mnt/HC_Volume_<id> which is non-deterministic.
# ---------------------------------------------------------------------------

resource "hcloud_volume" "db_data" {
  name     = "ackerblick-db-data"
  size     = 20
  location = "nbg1"
  format   = "ext4"
}

resource "hcloud_volume_attachment" "db_data" {
  volume_id = hcloud_volume.db_data.id
  server_id = hcloud_server.ackerblick.id
  automount = false
}

# ---------------------------------------------------------------------------
# DNS — api.ackerblick.com → server IPv4
# proxied = false: Caddy handles TLS directly (not via Cloudflare proxy)
# ---------------------------------------------------------------------------

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  type    = "A"
  content = hcloud_server.ackerblick.ipv4_address
  proxied = false
  ttl     = 300
}
