; ============================================================================
; Workbench 安装包自定义脚本（electron-builder 自定义 include）
; 该文件由 electron-builder 在生成安装脚本时引入到脚本前部，
; 因此此处定义的宏、变量与函数在安装 / 卸载流程中全局生效。
; ============================================================================

!include "WinMessages.nsh"
; 本文件会被 electron-builder 置于生成脚本最前部，早于 multiUserUi.nsh 的
; !include "nsDialogs.nsh"，因此这里先自行引入（该头文件自带防重复包含保护）
!include "nsDialogs.nsh"

; 自动创建的安装子文件夹名（与打包应用名保持一致）
!define APP_SUBFOLDER "Workbench"

Var WHELPER_VERIFYING

; ----------------------------------------------------------------------------
; 目录页回调：用户选择或输入安装目录后，自动追加以软件名命名的子文件夹，
; 并把最终路径同步显示到「目标文件夹」输入框（如 D:\app → D:\app\Workbench）。
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

  ; 已以 \Workbench 结尾时保持不变（避免重复追加）
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
; 「安装选项」页按钮宽度校正：
; 选择「所有用户」时，multiUserUi.nsh 会给「下一步」按钮叠加 UAC 盾牌
; （BCM_SETSHIELD），但按钮宽度不变，文字被整体右移，末尾的 ">" 被右边缘裁切
; （显示成残缺字符）。下面在选中「所有用户」（盾牌出现）时把按钮向左加宽，
; 为盾牌预留空间：右边缘保持不变，使文字重新居中、箭头完整显示。
;
; 位置说明：本文件在生成脚本最前部被 include，而页面变量
; （$MultiUser.InstallModePage.* 等）与原有回调函数 InstModeChange 是在页面宏
; 展开时才产生的，因此这里只声明 MUI_PAGE_CUSTOMFUNCTION_SHOW（它会被首个
; 展开的页面即安装选项页消费）；具体处理函数统一放到 customHeader 宏中定义，
; 该宏由 electron-builder 在所有页面展开之后插入，可安全引用页面变量与函数。
; ----------------------------------------------------------------------------
!ifndef BUILD_UNINSTALLER
  !ifndef INSTALL_MODE_PER_ALL_USERS
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW WorkbenchInstallModePageShow
  !endif
!endif

; ----------------------------------------------------------------------------
; 中文界面字体：NSIS 简体中文语言包默认使用「宋体 9」，
; 在部分系统缩放比例下按钮文字会偏移，改用系统 UI 字体并保持字号一致。
; 同时在此定义「安装选项」页按钮宽度校正所用的函数（见上文说明）。
; ----------------------------------------------------------------------------
!macro customHeader
  !ifdef LANG_SIMPCHINESE
    LangString ^Font ${LANG_SIMPCHINESE} "Microsoft YaHei UI"
    LangString ^FontSize ${LANG_SIMPCHINESE} "9"
  !endif

  !ifndef BUILD_UNINSTALLER
    !ifndef INSTALL_MODE_PER_ALL_USERS
      ; 「下一步」按钮是否已加宽（页面来回切换会重复触发页面回调，避免重复加宽）
      Var WHELPER_NEXT_BTN_WIDENED

      ; 单选按钮点击包装：先转发原有逻辑（叠加/移除盾牌、刷新说明文字），再校正宽度
      Function WorkbenchInstModeChange
        Pop $0
        Push $0
        Call InstModeChange
        Call WorkbenchSyncNextButtonWidth
      FunctionEnd

      ; 依据单选状态校正「下一步」按钮宽度：仅选中「所有用户」（按钮显示盾牌）时加宽
      Function WorkbenchSyncNextButtonWidth
        ; System::Store "S"~"L"：保存/恢复 System 插件寄存器并管理其缓冲区
        System::Store "S"
        Push $0
        Push $1
        Push $2
        Push $3
        Push $4
        Push $5
        Push $6
        Push $7
        Push $8
        StrCmp $WHELPER_NEXT_BTN_WIDENED "1" wh_sync_done
        ${NSD_GetState} $MultiUser.InstallModePage.AllUsers $3
        StrCmp $3 ${BST_CHECKED} 0 wh_sync_done
        ; 主窗口「下一步」按钮控件 ID 为 1（IDOK）
        GetDlgItem $0 $HWNDPARENT 1
        ; 读取按钮矩形（屏幕坐标）
        System::Call 'user32::GetWindowRect(pr0, @r1)i'
        ; 子窗口 SetWindowPos 使用父窗口客户区坐标，先把 RECT 的两个点由屏幕坐标转换过来
        System::Call 'user32::MapWindowPoints(p0, p$HWNDPARENT, pr1, i2)i'
        System::Call '*$1(i.r2, i.r3, i.r4, i.r5)'
        IntOp $6 $4 - $2 ; 宽度 = right - left
        IntOp $7 $5 - $3 ; 高度 = bottom - top
        ; 读到异常矩形（宽/高非正）时不做处理，避免破坏按钮
        IntCmp $6 1 wh_sync_done wh_sync_done
        IntCmp $7 1 wh_sync_done wh_sync_done
        IntOp $8 $7 + 0  ; 预留宽度取按钮高度（随系统 DPI 与字号自适应）
        IntOp $2 $2 - $8 ; 左边缘左移，右边缘保持不变
        IntOp $6 $6 + $8
        ; SWP_NOZORDER(0x4) | SWP_NOACTIVATE(0x10)
        System::Call 'user32::SetWindowPos(pr0, p0, ir2, ir3, ir6, ir7, i0x14)i'
        StrCpy $WHELPER_NEXT_BTN_WIDENED "1"
        wh_sync_done:
        Pop $8
        Pop $7
        Pop $6
        Pop $5
        Pop $4
        Pop $3
        Pop $2
        Pop $1
        Pop $0
        System::Store "L"
      FunctionEnd

      ; 安装选项页显示时的处理：把单选按钮回调换成包装函数，并按当前选择校正宽度
      Function WorkbenchInstallModePageShow
        ; 只有存在两个安装选项时页面才绑定过单选按钮回调（见 multiUserUi.nsh）
        StrCmp $HasTwoAvailableOptions "1" 0 wh_show_sync
        ${NSD_OnClick} $MultiUser.InstallModePage.AllUsers WorkbenchInstModeChange
        ${NSD_OnClick} $MultiUser.InstallModePage.CurrentUser WorkbenchInstModeChange
        wh_show_sync:
        Call WorkbenchSyncNextButtonWidth
      FunctionEnd
    !endif
  !endif
!macroend