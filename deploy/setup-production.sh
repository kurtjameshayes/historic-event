#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/devuser/historic-event"
ENV_FILE="/home/devuser/historic-event.env"
BACKEND_DIR="$APP_DIR/backend"
DIST_DIR="$APP_DIR/dist"
VENV_GUNICORN="$BACKEND_DIR/venv/bin/gunicorn"
SERVER_IP="64.23.239.130"

echo "=== Historic Event Production Setup ==="

# ---- 1. Install nginx if missing ----
if ! command -v nginx &>/dev/null; then
    echo "[1/5] Installing nginx..."
    apt update -qq
    apt install -y -qq nginx
else
    echo "[1/5] nginx already installed."
fi

# ---- 2. Create systemd service ----
echo "[2/5] Creating systemd service..."
cat > /etc/systemd/system/historic-event.service << EOF
[Unit]
Description=Historic Event Backend (Gunicorn)
After=network.target

[Service]
Type=exec
User=devuser
Group=devuser
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_GUNICORN \\
    --bind 127.0.0.1:5210 \\
    --workers 2 \\
    --threads 4 \\
    --timeout 300 \\
    "app:create_app()"
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now historic-event.service
echo "    Backend service enabled and started."

# ---- 3. Configure nginx ----
echo "[3/5] Configuring nginx..."
cat > /etc/nginx/sites-available/historic-event << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    root $DIST_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5210;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SSE endpoint needs buffering disabled for live streaming
    location ~ ^/api/sessions/[^/]+/stream$ {
        proxy_pass http://127.0.0.1:5210;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/historic-event /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "    Testing nginx config..."
nginx -t

systemctl enable --now nginx
systemctl reload nginx
echo "    nginx enabled and reloaded."

# ---- 4. Set FLASK_DEBUG=false for production ----
echo "[4/5] Ensuring FLASK_DEBUG is off in production..."
if grep -q 'FLASK_DEBUG=true' "$ENV_FILE"; then
    sed -i 's/FLASK_DEBUG=true/FLASK_DEBUG=false/' "$ENV_FILE"
    echo "    Set FLASK_DEBUG=false."
else
    echo "    FLASK_DEBUG already set correctly."
fi

# ---- 5. Verify ----
echo "[5/5] Verifying..."
sleep 2

echo "    Backend service status:"
systemctl is-active historic-event.service || true

echo "    nginx status:"
systemctl is-active nginx || true

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5210/api/sessions 2>/dev/null || echo "failed")
echo "    Backend API response: $BACKEND_STATUS"

FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "failed")
echo "    Frontend response: $FRONTEND_STATUS"

echo ""
echo "=== Setup complete ==="
echo "App should be accessible at: http://$SERVER_IP/"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status historic-event    # backend status"
echo "  sudo journalctl -u historic-event -f    # backend logs"
echo "  sudo systemctl restart historic-event   # restart backend"
echo "  sudo tail -f /var/log/nginx/error.log   # nginx errors"
