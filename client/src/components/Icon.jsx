const P = {
  bag: 'M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 0 1 6 0v2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zm4 4a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  close: 'M6 6l12 12M18 6L6 18',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l5 5 9-10',
  back: 'M15 5l-7 7 7 7',
  bike: 'M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 15l4-7h5l5 7M9 8l3 7h2',
  store: 'M4 10l2-5h12l2 5M5 10v9h14v-9M4 10h16M10 19v-5h4v5',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 0 0 0-6m2 15a6 6 0 0 0-3-5.2',
  table: 'M3 9h18M5 9v10M19 9v10M8 9l1-4h6l1 4',
  chart: 'M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3',
  chef: 'M7 14v6h10v-6M7 14a4 4 0 1 1 1.5-7.7 4 4 0 0 1 7 0A4 4 0 1 1 17 14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v5l3 2',
  split: 'M12 3v18M5 8l-2 4 2 4M19 8l2 4-2 4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  sound: 'M4 10v4h4l5 4V6L8 10H4zm12-1a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  repeat: 'M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 0 0-9 3M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2 2a5 5 0 0 0 9-3',
}
export default function Icon({ name, size = 22, stroke = 2.2, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
