# Local SSL cert generation script for Evolution API development
# Uses local openssl.cnf to ensure compatibility on all platforms

if (-not (Test-Path -Path certs)) {
    New-Item -ItemType Directory -Path certs | Out-Null
}

openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout certs/evolution.key `
  -out certs/evolution.crt `
  -config certs/openssl.cnf

Write-Host "✅ Self-signed SSL certificate generated successfully in ./certs/"
