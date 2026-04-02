Option Explicit

Dim shell, fso, appDir, command, configFile, port
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
configFile = appDir & "\data\runtime-config.cmd"
port = "80"

If fso.FileExists(configFile) Then
  Dim configText, matches, regex
  configText = fso.OpenTextFile(configFile, 1).ReadAll
  Set regex = New RegExp
  regex.Pattern = "set ""PORT=([0-9]+)"""
  regex.IgnoreCase = True
  Set matches = regex.Execute(configText)
  If matches.Count > 0 Then
    port = matches(0).SubMatches(0)
  End If
End If

command = "cmd /c cd /d """ & appDir & """ && set PORT=" & port & " && node server.js >> data\server.log 2>>&1"

shell.Run command, 0, False
