// Proxys auxquels l'application fait confiance pour lire l'IP réelle du
// client dans X-Forwarded-For (`req.ip`, donc la clé de tous les limiteurs
// par IP).
//
// Sur Render, une requête arrive par : Cloudflare → load balancer interne
// Render (10.x) → sidecar local (::1). Mesuré en production le 2026-09-26 :
//   X-Forwarded-For: <IP client>, <IP Cloudflare>, <IP interne Render>
// avec `trust proxy = 1`, Express retenait l'IP interne Render : tous les
// utilisateurs partageaient les mêmes compteurs de limitation.
//
// On fait confiance aux proxys par PLAGE d'adresses (et non par nombre de
// sauts) : Express remonte la chaîne depuis la droite en sautant les
// adresses de confiance, et s'arrête à la première qui n'en est pas — le
// client. Cela reste correct si Render ajoute ou retire un saut interne, et
// une valeur `X-Forwarded-For` falsifiée par un client reste à gauche de sa
// vraie IP : elle n'est jamais retenue.
//
// Si Cloudflare ajoute un jour une plage absente de cette liste, la panne
// est « sûre » : ses adresses seraient prises pour un client (compteur
// partagé), jamais une IP falsifiable. Liste officielle :
//   https://www.cloudflare.com/ips-v4  et  https://www.cloudflare.com/ips-v6
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const TRUSTED_PROXIES = ["loopback", "uniquelocal", ...CLOUDFLARE_RANGES];

module.exports = { TRUSTED_PROXIES };
