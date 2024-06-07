#!/bin/bash

# URL of the tar.gz
URL="http://dualzit.nl/dashball.tar.gz"

# Create a temporary directory for downloading
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Download the tar.gz file
echo "Downloading Dashball..."
curl -L $URL -o dashball.tar.gz

# Create a directory for the installation
INSTALL_DIR="/opt/dashball"
sudo mkdir -p $INSTALL_DIR

# Extract the tar.gz file into the installation directory
echo "Extracting Dashball..."
sudo tar -xzvf dashball.tar.gz -C $INSTALL_DIR --strip-components=1

# Remove the downloaded tar.gz file and temporary directory
rm dashball.tar.gz
cd ~
rm -rf $TEMP_DIR

# Add the configuration file (if needed)
echo "Adding configuration file..."
sudo mkdir -p $INSTALL_DIR/json
sudo cp /path/to/local/config.json $INSTALL_DIR/json/config.json

# Create a systemd service file
echo "Creating systemd service file..."
cat <<EOF | sudo tee /etc/systemd/system/dashball.service
[Unit]
Description=Dashball Service
After=network.target

[Service]
WorkingDirectory=/opt/dashball/src
ExecStart=/opt/dashball/src/dashball
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
User=nobody
Group=nogroup

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, start the Dashball service and enable at startup
echo "Enabling and starting Dashball service..."
sudo systemctl daemon-reload
sudo systemctl reset-failed
sudo systemctl enable dashball
sudo systemctl start dashball

echo "Dashball is installed and running as a systemd service!"
