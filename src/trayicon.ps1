Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Initialiseer het systeemvakicoon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$iconPath = "dualzit.ico" # Zorg ervoor dat dit het volledige pad is als het script niet werkt
$notifyIcon.Icon = New-Object System.Drawing.Icon($iconPath)
$notifyIcon.Visible = $true

# Creëer het contextmenu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# Voeg menu-items toe
$item1 = New-Object System.Windows.Forms.ToolStripMenuItem
$item1.Text = "Open Config"
$item1.Add_Click({ Start-Process "config.json" })
$contextMenu.Items.Add($item1)

$item2 = New-Object System.Windows.Forms.ToolStripMenuItem
$item2.Text = "Open Website"
$item2.Add_Click({ Start-Process "http://127.0.0.1" })
$contextMenu.Items.Add($item2)

$notifyIcon.ContextMenuStrip = $contextMenu

# Voer een berichtenlus uit zonder een formulier weer te geven
[System.Windows.Forms.Application]::Run()
