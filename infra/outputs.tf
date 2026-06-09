output "server_ip" {
  description = "Hetzner server public IPv4 address"
  value       = hcloud_server.ackerblick.ipv4_address
}

output "server_hostname" {
  description = "Hetzner server name"
  value       = hcloud_server.ackerblick.name
}

output "db_volume_id" {
  description = "Hetzner Block Volume ID — verify this matches the attached device in bootstrap.sh"
  value       = hcloud_volume.db_data.id
}
