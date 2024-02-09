# Dashball
As in a dashboard for all devices

It is a work in progress.

Stay tuned for the first official release.
## Demo
<img width="1686" alt="image" src="https://github.com/DualzIT/Dashball/assets/125699393/d294956e-139b-4e19-8142-07604d84f98f">

Unfortinatly the demo pc does not have a GPU but you can still check out the demo at http://alexvanzoggel.nl/Website

# Setup
WARNING: The development is in beta. 

There are multiple ways to install and run Dashball
## .exe file (Only for windows) 
Download dashball.exe from the latest release and run it.

Windows will give some security warnings that you need to ignore

## python3
if you don't have already you need to install python3
```
sudo apt update
sudo apt install python3
sudo apt install pip
```
install depedencies
```
pip install GPUtil
pip install psutil
pip install py3nvml
pip install setuptools
```
download the zip file or clone using
```
git clone https://github.com/DualzIT/Dashball.git
```
go to the dashball/src directory
```
cd dashball/src
```
And run dashball.py using python3
```
sudo python3 Dashball.py
```
## go
if you don't have already you need to install python3
```
sudo apt update
sudo apt install golang
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
# Use case
Dashball is not one of those cloud monitoring software. 

We create a webserver with all the information you need to remotely check in on your system.
# Supported operating systems

 operating system | Using            | status|
| -------------   |:-------------:   | -----:|
| Windows 11      | exe, go, python3 | :white_check_mark:   |
| Ubuntu          | go, python3      | :white_check_mark: |

