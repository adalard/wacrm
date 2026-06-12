#!/bin/bash
# Local SSL cert generation script for Evolution API development
# Uses local openssl.cnf to ensure compatibility on all platforms

mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/evolution.key \
  -out certs/evolution.crt \
  -config certs/openssl.cnf

echo "✅ Self-signed SSL certificate generated successfully in ./certs/"
