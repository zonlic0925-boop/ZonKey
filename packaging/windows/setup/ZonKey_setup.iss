; ZonKey Inno Setup Script
; Generates a single setup.exe with LZMA2 solid compression.
; Source: dist/Zonkey/    Output: dist_release/ZonKey_Setup_x64_version.exe

#define MyAppName "ZonKey"
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "zonlic"
#define MyAppURL "https://github.com/zonlic0925-boop/ZonKey"
#define MyAppExeName "ZonKey.exe"

[Setup]
AppId={{8F2A3E1D-6B5C-4A9F-8E7D-1C2B3A4F5E6D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\..\..\dist_release
OutputBaseFilename=ZonKey_Setup_x64_{#MyAppVersion}
SetupIconFile=..\..\..\assets\zonkey.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "..\..\..\dist\ZonKey\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\dist\ZonKey\_internal\*"; DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\dist\ZonKey\zonkey.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\dist\ZonKey\*.bat"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\assets"
Name: "{app}\output"
Name: "{app}\rules"
Name: "{app}\temp_bridge_files"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\zonkey.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\zonkey.ico"; Tasks: desktopicon

[Run]
; 升级安装时 .lnk 与 EXE 的图标路径不变、内容已换，资源管理器图标缓存不会
; 自动失效——桌面/开始菜单快捷方式继续显示旧图标（用户视角「图标还是白底」）。
; ie4uinit -show 通知 shell 刷新图标缓存（Win10/11 官方口令，静默执行）。
Filename: "{sys}\ie4uinit.exe"; Parameters: "-show"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent