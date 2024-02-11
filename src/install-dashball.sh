#!/bin/bash

# Check if the script is running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use 'sudo' to run it." >&2
    exit 1
fi

# Navigate to the correct directory (adjust this path to where your script is located)
cd "$(dirname "$0")"

# Make the application executable
chmod +x dashball/src/dashball

# Run the application
./dashball/src/dashball

# Create a systemd service file
cat > /etc/systemd/system/dashball.service <<EOF
[Unit]
Description=Dashball Service

[Service]
ExecStart=$(pwd)/dashball/src/dashball
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd to recognize the new service and start the service
systemctl daemon-reload
systemctl start dashball.service
systemctl enable dashball.service

echo "Dashball has been installed and will automatically start on boot."
