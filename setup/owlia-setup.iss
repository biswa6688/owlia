; OWLIA InnoSetup 6 installer script
; Bundles the published .NET 10 app + ffmpeg.exe
; Models are NOT bundled — downloaded at runtime via the Download page.

#define MyAppName      "OWLIA"
#define MyAppVersion   "0.6.0"
#define MyAppPublisher "OWLIA Contributors"
#define MyAppURL       "https://github.com/biswa6688/owlia"
#define MyAppExeName   "Owlia.Host.exe"
#define PublishDir     "..\src\Owlia.Host\publish"

[Setup]
AppId={{A3F1C7D2-8E4B-4F9A-BC10-2D3E5F6A7B8C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\OWLIA
DefaultGroupName=OWLIA
OutputDir=Output
OutputBaseFilename=owlia-setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
; Self-signed — set SignTool if you have a certificate
; SignTool=signtool

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Main application (self-contained publish output)
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Bundled ffmpeg (place ffmpeg.exe in setup/ folder before building)
Source: "ffmpeg.exe"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists(ExpandConstant('{src}\ffmpeg.exe'))

; Keep data/ models/ logs/ directories (gitkeep files are enough)
Source: "..\data\.gitkeep";   DestDir: "{app}\data";   Flags: ignoreversion
Source: "..\models\.gitkeep"; DestDir: "{app}\models"; Flags: ignoreversion
Source: "..\models\models.json"; DestDir: "{app}\models"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up generated files on uninstall (optional — user may want to keep data)
; Type: filesandordirs; Name: "{app}\data"
; Type: filesandordirs; Name: "{app}\logs"
; Type: filesandordirs; Name: "{app}\models"
