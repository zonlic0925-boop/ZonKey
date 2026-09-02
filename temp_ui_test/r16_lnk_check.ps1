$s = (New-Object -ComObject WScript.Shell).CreateShortcut('C:\Users\Zonlic\Desktop\ZonKey.lnk')
Write-Output ('Target: ' + $s.TargetPath)
Write-Output ('IconLocation: ' + $s.IconLocation)
Write-Output ('WorkingDirectory: ' + $s.WorkingDirectory)
