; ============================================================
; refor.md — Custom Installer Additions
; ============================================================
; Adds an optional .md file association checkbox page.
; The page appears after the directory selection and before
; the actual installation starts.

; Only compile installer-specific code when NOT building the uninstaller
!ifndef BUILD_UNINSTALLER

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var AssocCheckbox
Var AssocState

; ----- Custom page: file association options -----

Function AssocOptionsPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "File Associations"
  Pop $1

  ${NSD_CreateHLine} 0 25u 100% 1u ""
  Pop $2

  ${NSD_CreateCheckbox} 0 36u 100% 12u "&Automatically open .md files with refor.md"
  Pop $AssocCheckbox
  ${NSD_SetState} $AssocCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 14u 52u 95% 24u "Allows opening Markdown files directly by double-clicking in Explorer."
  Pop $3

  nsDialogs::Show
FunctionEnd

Function AssocOptionsPageLeave
  ${NSD_GetState} $AssocCheckbox $AssocState
FunctionEnd

; Insert our page after the directory-selection page
!macro customPageAfterChangeDir
  Page custom AssocOptionsPage AssocOptionsPageLeave " File Associations"
!macroend

!endif ; BUILD_UNINSTALLER

; ----- Write registry entries after installation -----

!macro customInstall
  ${If} $AssocState == ${BST_CHECKED}
    ; Associate .md and .markdown extensions
    WriteRegStr HKCU "Software\Classes\.md"       "" "refor.md.markdown"
    WriteRegStr HKCU "Software\Classes\.markdown" "" "refor.md.markdown"

    ; Define the file type
    WriteRegStr HKCU "Software\Classes\refor.md.markdown"                    "" "Markdown Document"
    WriteRegStr HKCU "Software\Classes\refor.md.markdown\DefaultIcon"        "" "$INSTDIR\refor.md.exe,0"
    WriteRegStr HKCU "Software\Classes\refor.md.markdown\shell"              "" "open"
    WriteRegStr HKCU "Software\Classes\refor.md.markdown\shell\open"         "" "Open with refor.md"
    WriteRegStr HKCU "Software\Classes\refor.md.markdown\shell\open\command" "" '"$INSTDIR\refor.md.exe" "%1"'

    ; Notify Windows shell to refresh file associations
    System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  ${EndIf}
!macroend

; ----- Remove registry entries on uninstall -----

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\refor.md.markdown"

  ReadRegStr $0 HKCU "Software\Classes\.md" ""
  ${If} $0 == "refor.md.markdown"
    DeleteRegKey HKCU "Software\Classes\.md"
  ${EndIf}

  ReadRegStr $0 HKCU "Software\Classes\.markdown" ""
  ${If} $0 == "refor.md.markdown"
    DeleteRegKey HKCU "Software\Classes\.markdown"
  ${EndIf}

  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
