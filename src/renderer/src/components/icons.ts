/**
 * 内置 SVG 图标库（24x24 viewBox，线性描边风格）。
 * 使用 fill="currentColor" 的图标通过 stroke="none" 覆盖描边模式。
 */
export const ICONS: Record<string, string> = {
  /* ------------------------------ 导航图标 ------------------------------ */
  home: '<path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.4v-6H9.4v6H5a1 1 0 0 1-1-1z"/>',
  calendar:
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  dumbbell:
    '<path d="M6.5 8.5v7M4 10.5v3M17.5 8.5v7M20 10.5v3M6.5 12h11"/>',
  timer:
    '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.8l2.5 1.5M9.5 3.2h5M18.4 6.2l1.2-1.2"/>',
  book: '<path d="M12 7C10 5.6 7.7 5 4 5v13c3.7 0 6 .6 8 2 2-1.4 4.3-2 8-2V5c-3.7 0-6 .6-8 2z"/><path d="M12 7v13"/>',
  film: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9.5h16M4 14.5h16M9 5v14M15 5v14"/>',
  headphone:
    '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><path d="M4 15h3.2v5H5a1 1 0 0 1-1-1zM20 15h-3.2v5H19a1 1 0 0 0 1-1z"/>',
  calendarDays:
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17.2h.01M12 17.2h.01"/>',
  gift:
    '<path d="M5 12h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M4 7.6h16V12H4zM12 7.6V21"/><path d="M12 7.6H8.4a2.3 2.3 0 1 1 0-4.6c2.9 0 3.6 4.6 3.6 4.6zM12 7.6h3.6a2.3 2.3 0 1 0 0-4.6C12.7 3 12 7.6 12 7.6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7.4A8 8 0 0 1 13 4a8 8 0 0 1 8 8z"/>',
  books:
    '<path d="M4 4h4.5v16H4zM10.5 4H15v16h-4.5z"/><path d="m16.8 5.6 3.7 1.1-4.2 13.8-3.7-1.1z"/>',
  shirt:
    '<path d="M9.5 4 4 7l1.6 4L8 10v11h8V10l2.4 1L20 7l-5.5-3-2.5 2z"/>',
  fire: '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.6 2.2-5 .3 1.8 1.1 2.8 2.1 2.8C11.3 7 12 5 12 3z"/>',
  robot:
    '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M8 13h.01M16 13h.01M9.5 17h5"/>',
  news:
    '<path d="M17 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h11a2 2 0 0 0 2-2V8h3v9.5a2.5 2.5 0 0 1-2.5 2.5"/><path d="M7 9h7M7 13h7M7 17h4"/>',
  notebook:
    '<path d="M7 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7z"/><path d="M7 3v18M4 7h3M4 12h3M4 17h3"/>',
  chart: '<path d="M5 20V10M11 20V4M17 20v-6"/><path d="M3 20h18"/>',
  grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M19.5 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.7 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.5l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.1z"/>',

  /* ------------------------------ 功能图标 ------------------------------ */
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash:
    '<path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14 6l4 4"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minimize: '<path d="M5 12h14"/>',
  maximize: '<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>',
  restore:
    '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M5.5 15.5V6a1.5 1.5 0 0 1 1.5-1.5h9"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"/>',
  compress: '<path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.7l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  bookmark:
    '<path d="M7 4.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V5.5a1 1 0 0 1 1-1z"/>',
  type: '<path d="M5 6.5V5h14v1.5M12 5v14M8.5 19h7"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  download: '<path d="M12 4v11M7.5 11.5 12 16l4.5-4.5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 20h14"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  list: '<path d="M8.5 6H20M8.5 12H20M8.5 18H20M4 6h.01M4 12h.01M4 18h.01"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 11a3.8 3.8 0 0 1-.6 7.5z"/>',
  mapPin:
    '<path d="M12 21.5s6.8-5.9 6.8-11a6.8 6.8 0 1 0-13.6 0c0 5.1 6.8 11 6.8 11z"/><circle cx="12" cy="10.2" r="2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
  sparkle:
    '<path d="M12 4l1.6 4.6L18 10l-4.4 1.4L12 16l-1.6-4.6L6 10l4.4-1.4z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',

  /* ------------------------------ 资产图标 ------------------------------ */
  wallet:
    '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 7.5V6a2 2 0 0 1 2-2h9"/><path d="M15 12.5h.01" stroke-width="2.4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M4 4l16 16"/><path d="M9.9 5.9A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-3.3 4M6.1 6.8A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1.1 0 2.1-.2 3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  piggy:
    '<path d="M5.5 12.5a6 6 0 0 1 6-6h1a6 6 0 0 1 5.7 4.1l1.8.4v3l-1.7.5a6 6 0 0 1-3.8 2.7V19h-2v-1.5h-2V19h-2v-2.3a6 6 0 0 1-3-4.2z"/><path d="M15.5 10h.01" stroke-width="2.2"/><path d="M5.5 11.5H4a1.5 1.5 0 0 0 0 3h1.2"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4.5h2.4l2.2 10.5h10.4l2.3-8H7"/>',
  hourglass: '<path d="M7 4h10M7 20h10M8 4v3.2L12 12l4-4.8V4M8 20v-3.2L12 12l4 4.8V20"/>',
  cake:
    '<path d="M5 13h14v7H5z"/><path d="M5 16.5c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0"/><path d="M12 9.5V13M12 6.5a1.5 1.5 0 0 0 1.5-1.5C13.5 3.5 12 2.5 12 2.5S10.5 3.5 10.5 5A1.5 1.5 0 0 0 12 6.5z"/>',
  coins:
    '<ellipse cx="9" cy="7.5" rx="5" ry="2.7"/><path d="M4 7.5v5c0 1.5 2.2 2.7 5 2.7s5-1.2 5-2.7v-5"/><path d="M14 10.5c2.7 0 5 1.2 5 2.7v4.3c0 1.5-2.2 2.7-5 2.7-1.5 0-2.9-.4-3.8-1"/>'
}