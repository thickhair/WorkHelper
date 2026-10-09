; ============================================================================
; WorkHelper 安装包自定义脚本（electron-builder 自定义 include）
; 该文件由 electron-builder 在生成安装脚本时引入到脚本前部，
; 因此此处定义的宏、变量与函数在安装 / 卸载流程中全局生效。
; ============================================================================

!include "WinMessages.nsh"

; 自动创建的安装子文件夹名（与打包应用名保持一致）
!define APP_SUBFOLDER "WorkHelper"

Var WHELPER_VERIFYING

; ----------------------------------------------------------------------------
; 目录页回调：用户选择或输入安装目录后，自动追加以软件名命名的子文件夹，
; 并把最终路径同步显示到「目标文件夹」输入框（如 D:\app → D:\app\WorkHelper）。
; ----------------------------------------------------------------------------
Function .onVerifyInstDir
  ; 防重入：同步输入框文本会再次触发本回调
  StrCmp $WHELPER_VERIFYING "1" verify_done
  StrCpy $WHELPER_VERIFYING "1"

  Push $0
  Push $1
  StrCmp $INSTDIR "" verify_store

  ; 去掉末尾多余的反斜杠（保留 "D:\" 这类根目录）
  StrCpy $0 $INSTDIR 1 -1
  StrCmp $0 "\" 0 verify_trimmed
    StrCpy $0 $INSTDIR 1 -2
    StrCmp $0 ":" verify_trimmed
    StrCpy $INSTDIR $INSTDIR -1
  verify_trimmed:

  ; 已以 \WorkHelper 结尾时保持不变（避免重复追加）
  StrLen $1 "\${APP_SUBFOLDER}"
  StrCpy $0 $INSTDIR $1 -$1
  StrCmp $0 "\${APP_SUBFOLDER}" verify_store
  StrCpy $INSTDIR "$INSTDIR\${APP_SUBFOLDER}"

  verify_store:
  ; 同步刷新输入框显示（目录页输入框控件 ID 为 1019）
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $0 $0 1019
  SendMessage $0 ${WM_SETTEXT} 0 "STR:$INSTDIR"

  Pop $1
  Pop $0
  StrCpy $WHELPER_VERIFYING "0"

  verify_done:
FunctionEnd

; ----------------------------------------------------------------------------
; 中文界面字体：NSIS 简体中文语言包默认使用「宋体 9」，
; 在部分系统缩放比例下按钮文字会偏移，改用系统 UI 字体并保持字号一致。
; ----------------------------------------------------------------------------
!macro customHeader
  !ifdef LANG_SIMPCHINESE
    LangString ^Font ${LANG_SIMPCHINESE} "Microsoft YaHei UI"
    LangString ^FontSize ${LANG_SIMPCHINESE} "9"
  !endif
!macroend