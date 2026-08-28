; ============================================================
; OWLIA — InnoSetup 6 installer
; Framework-dependent build (no bundled .NET runtime).
; The [Code] section checks for:
;   1. .NET 10 ASP.NET Core Runtime (x64)
;   2. Microsoft Edge WebView2 Runtime
; If either is missing the user is offered a one-click download.
; ============================================================

#define MyAppName       "OWLIA"
#define MyAppVersion    "0.6.0"
#define MyAppPublisher  "OWLIA Contributors"
#define MyAppURL        "https://github.com/biswa6688/owlia"
#define MyAppExeName    "Owlia.Host.exe"
#define PublishDir      "..\src\Owlia.Host\publish"

; .NET 10 ASP.NET Core Runtime — x64 web installer from Microsoft
; URL pattern: https://aka.ms/dotnet/10.0/aspnetcore-runtime-win-x64.exe
#define DotNetRuntimeUrl  "https://aka.ms/dotnet/10.0/aspnetcore-runtime-win-x64.exe"
#define DotNetMinVersion  "10.0.0"

; WebView2 Evergreen Bootstrapper (tiny ~1.5 MB, downloads latest stable)
#define WebView2Url       "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
AppId={{A3F1C7D2-8E4B-4F9A-BC10-2D3E5F6A7B8C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\OWLIA
DefaultGroupName=OWLIA
SetupIconFile=..\assets\owlia.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
OutputDir=Output
OutputBaseFilename=owlia-setup-{#MyAppVersion}
; lzma2/ultra64 gives best compression for the app DLLs
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; x64 only — Photino.Native.dll + ONNX Runtime are x64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 1809 (RS5) minimum — required for WebView2 Evergreen
MinVersion=10.0.17763
; Requires admin because we install to Program Files
PrivilegesRequired=admin
; Custom wizard image files (optional — comment out if not present)
; WizardImageFile=assets\wizard.bmp
; WizardSmallImageFile=assets\wizard_small.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

; ── Files ──────────────────────────────────────────────────────────────────────
[Files]
; Framework-dependent publish output (app DLLs + native Photino/WebView2 loader)
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Bundled ffmpeg — place ffmpeg.exe in setup\ before running ISCC
; If absent the installer still works; the app falls back to NAudio for WAV files.
Source: "ffmpeg.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; Placeholder directories
Source: "..\data\.gitkeep";      DestDir: "{app}\data";   Flags: ignoreversion
Source: "..\models\.gitkeep";    DestDir: "{app}\models"; Flags: ignoreversion
Source: "..\models\models.json"; DestDir: "{app}\models"; Flags: ignoreversion

; ── Icons ──────────────────────────────────────────────────────────────────────
[Icons]
Name: "{group}\{#MyAppName}";              Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}";    Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}";        Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; ── Run after install ──────────────────────────────────────────────────────────
[Run]
Filename: "{app}\{#MyAppExeName}"; \
  Description: "{cm:LaunchProgram,{#StringChange(MyAppName,'&','&&')}}"; \
  Flags: nowait postinstall skipifsilent

; ── Uninstall cleanup ─────────────────────────────────────────────────────────
[UninstallDelete]
; Logs are safe to remove; uncomment data/models if you want clean uninstall
Type: filesandordirs; Name: "{app}\logs"
; Type: filesandordirs; Name: "{app}\data"
; Type: filesandordirs; Name: "{app}\models"

; ══════════════════════════════════════════════════════════════════════════════
; [Code] — runtime prerequisite checks + silent/online download
; ══════════════════════════════════════════════════════════════════════════════
[Code]

// ── Helpers ──────────────────────────────────────────────────────────────────

// Compare two version strings a >= b.  Returns true if a >= b.
// Compares only Major.Minor — enough for our purposes.
function VersionAtLeast(const Installed, Required: String): Boolean;
var
  iMaj, iMin, rMaj, rMin: Integer;
  iParts, rParts: TStringList;
begin
  Result := False;
  iParts := TStringList.Create;
  rParts := TStringList.Create;
  try
    iParts.Delimiter := '.';
    rParts.Delimiter := '.';
    iParts.StrictDelimiter := True;
    rParts.StrictDelimiter := True;
    iParts.DelimitedText := Installed;
    rParts.DelimitedText := Required;
    if iParts.Count < 2 then Exit;
    if rParts.Count < 2 then Exit;
    iMaj := StrToIntDef(iParts[0], 0);
    iMin := StrToIntDef(iParts[1], 0);
    rMaj := StrToIntDef(rParts[0], 0);
    rMin := StrToIntDef(rParts[1], 0);
    if iMaj > rMaj then Result := True
    else if (iMaj = rMaj) and (iMin >= rMin) then Result := True;
  finally
    iParts.Free;
    rParts.Free;
  end;
end;

// ── .NET 10 Runtime detection ─────────────────────────────────────────────────

// Walk HKLM\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedhost
// and also check the "sharedfx" keys for ASP.NET Core.
function GetInstalledDotNetVersion: String;
var
  RootKey: String;
  SubKeyNames: TArrayOfString;
  i: Integer;
  Ver: String;
begin
  Result := '';
  RootKey := 'SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.AspNetCore.App';
  if not RegGetSubkeyNames(HKLM, RootKey, SubKeyNames) then
  begin
    // Fallback: check 32-bit registry view (shouldn't happen on x64 install)
    RootKey := 'SOFTWARE\WOW6432Node\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.AspNetCore.App';
    if not RegGetSubkeyNames(HKLM, RootKey, SubKeyNames) then Exit;
  end;
  // SubKeyNames are version strings like "10.0.9", "9.0.17", …
  for i := 0 to GetArrayLength(SubKeyNames) - 1 do
  begin
    Ver := SubKeyNames[i];
    if (Length(Ver) > 2) and (Copy(Ver, 1, 3) = '10.') then
    begin
      // Pick the highest 10.x version found
      if VersionAtLeast(Ver, Result) then
        Result := Ver;
    end;
  end;
end;

function DotNetRuntimeInstalled: Boolean;
var
  Ver: String;
begin
  Ver := GetInstalledDotNetVersion;
  Result := (Ver <> '') and VersionAtLeast(Ver, '{#DotNetMinVersion}');
end;

// ── WebView2 Runtime detection ────────────────────────────────────────────────

function WebView2Installed: Boolean;
var
  Version: String;
begin
  // Per-machine install key
  Result := RegQueryStringValue(HKLM,
    'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
  if not Result then
    // Per-user install key (some machines install it per-user)
    Result := RegQueryStringValue(HKCU,
      'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
      'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

// ── Download + run a prerequisite installer ───────────────────────────────────

function DownloadAndInstall(const URL, TempName, Args, FriendlyName: String): Boolean;
var
  TempFile: String;
  ResultCode: Integer;
begin
  Result := False;
  TempFile := ExpandConstant('{tmp}\') + TempName;

  WizardForm.Hide;

  if not DownloadTemporaryFile(URL, TempName, '', TempFile) then
  begin
    MsgBox('Could not download ' + FriendlyName + '.' + #13#10 +
           'Please install it manually and re-run this installer.' + #13#10 + URL,
           mbError, MB_OK);
    WizardForm.Show;
    Exit;
  end;

  if not Exec(TempFile, Args, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Failed to launch ' + FriendlyName + ' installer.' + #13#10 +
           'Please install it manually: ' + URL, mbError, MB_OK);
    WizardForm.Show;
    Exit;
  end;

  if ResultCode <> 0 then
  begin
    MsgBox(FriendlyName + ' installer exited with code ' + IntToStr(ResultCode) + '.' + #13#10 +
           'If the installation succeeded, please re-run this installer.',
           mbInformation, MB_OK);
  end;

  WizardForm.Show;
  Result := True;
end;

// ── Main prerequisite check — called before installation begins ───────────────

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  NeedDotNet, NeedWebView2: Boolean;
  Msg: String;
begin
  Result := '';
  NeedsRestart := False;

  NeedDotNet   := not DotNetRuntimeInstalled;
  NeedWebView2 := not WebView2Installed;

  if not NeedDotNet and not NeedWebView2 then Exit;

  // Build a friendly message listing what needs to be installed
  Msg := 'OWLIA requires the following prerequisites that are not currently installed:' + #13#10 + #13#10;
  if NeedDotNet then
    Msg := Msg + '  • .NET 10 ASP.NET Core Runtime (x64)' + #13#10;
  if NeedWebView2 then
    Msg := Msg + '  • Microsoft Edge WebView2 Runtime' + #13#10;
  Msg := Msg + #13#10 + 'The installer will download and install them now.' + #13#10 +
         'An internet connection is required. Continue?';

  if MsgBox(Msg, mbConfirmation, MB_YESNO) = IDNO then
  begin
    Result := 'Prerequisites are required to run OWLIA. Installation cancelled.';
    Exit;
  end;

  // ── Download .NET 10 ASP.NET Core Runtime ──────────────────────────────────
  if NeedDotNet then
  begin
    if not DownloadAndInstall(
      '{#DotNetRuntimeUrl}',
      'dotnet10-aspnetcore-runtime-x64.exe',
      '/install /quiet /norestart',
      '.NET 10 ASP.NET Core Runtime')
    then
    begin
      Result := 'Failed to install .NET 10 ASP.NET Core Runtime. Please install it manually from https://dotnet.microsoft.com/download/dotnet/10.0';
      Exit;
    end;
    // Re-check — installer may have rebooted silently
    if not DotNetRuntimeInstalled then
    begin
      MsgBox('.NET 10 installation may require a restart. Please reboot and re-run this installer.',
             mbInformation, MB_OK);
      NeedsRestart := True;
      Exit;
    end;
  end;

  // ── Download WebView2 Evergreen Bootstrapper ───────────────────────────────
  if NeedWebView2 then
  begin
    if not DownloadAndInstall(
      '{#WebView2Url}',
      'MicrosoftEdgeWebview2Setup.exe',
      '/silent /install',
      'Microsoft Edge WebView2 Runtime')
    then
    begin
      Result := 'Failed to install WebView2 Runtime. Please install it manually from https://developer.microsoft.com/microsoft-edge/webview2/';
      Exit;
    end;
  end;
end;

// ── InitializeSetup — early guard ─────────────────────────────────────────────
// (PrepareToInstall is the primary gate; this is a secondary informational check)
function InitializeSetup: Boolean;
begin
  Result := True; // always continue — PrepareToInstall handles actual downloads
end;

// ── Wizard page to show download progress (InnoSetup 6.1+) ───────────────────
procedure InitializeWizard;
begin
  // Register the DownloadPage so DownloadTemporaryFile shows progress
  DownloadPage := CreateDownloadPage(
    SetupMessage(msgWizardPreparing),
    'Downloading prerequisites…',
    nil);
end;
