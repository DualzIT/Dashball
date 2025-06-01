# Dashball
As in a dashboard for all devices


## Demo
![Schermafbeelding 2024-07-22 215411](https://github.com/user-attachments/assets/958eedbb-d51a-4560-a859-19af5cc130bc)

Unfortunately the demo pc does not have a GPU but you can still check out the demo at https://demo.dashball.dualzit.nl

# Use case
Dashball is not one of those cloud monitoring software. 

We create a webserver with all the information you need to remotely check in on your system.

# Setup

There are multiple ways to install and run Dashball
## .exe installer (Only for windows) 
Download dashball.exe from the latest release and run it.

Windows will give some security warnings that you need to ignore

## .sh installer (Only for linux) 

```
curl -s -L https://dashball.dualzit.nl/install_dashball.sh | sudo bash
```
Default the website is at localhost:8080

## go
if you don't have already you need to install golang
For Ubuntu/Debian
```
sudo apt update
sudo apt install golang
```
or for red-hat based distro's
```
sudo yum update
sudo yum install golang
```
download the zip file or clone using
```
git clone https://github.com/DualzIT/Dashball.git
```
go to the dashball/src directory
```
cd dashball/src
```
And run dashball.go using go
```
sudo go run dashball.go
```

# uninstall
## Windows
for windows you can uninstall Dashball using either the normal windows settings or with appwiz.cpl



