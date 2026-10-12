import type { ReactElement, SVGProps } from 'react';

const paths: Record<string, ReactElement> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-10.5Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  grid: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />,
  tag: <path d="M12.6 3H21v8.4L11.7 20.7a2 2 0 0 1-2.8 0l-5.6-5.6a2 2 0 0 1 0-2.8L12.6 3Zm3.9 4.6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  receipt: <path d="M6 2h12a1 1 0 0 1 1 1v19l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1Zm2 5h8M8 10h8M8 14h5" />,
  user: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 0c-4.4 0-8 2.7-8 6v3h16v-3c0-3.3-3.6-6-8-6Z" />,
  cart: <path d="M4 4h2.4l2.2 11.2A2 2 0 0 0 10.6 17h8.2a2 2 0 0 0 2-1.6L22 8H7M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />,
  pin: <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  edit: <path d="M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />,
  check: <path d="m4.5 12.5 5 5L19.5 7" />,
  checkCircle: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-4-10 3 3 5.5-5.5" />,
  clock: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2" />,
  phone: <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  mail: <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7L3.5 6.5" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  flame: <path d="M12 22c4 0 7-2.7 7-7 0-3-1.7-5.3-3.3-7C14.3 6.5 13 5 13 2c-3 1.7-4.5 4.5-4.5 7 0 .8-1.3 1.6-2 2.7C5.6 13 5 14.4 5 15c0 4.3 3 7 7 7Z" />,
  star: <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />,
  upload: <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  logout: <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4m7 13 5-5-5-5m5 5H10" />,
  bike: <path d="M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM9 7.5h4l3.5 7M7 7.5h2" />,
  bag: <path d="M6 8h12l1 13H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2" />,
  info: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v.5M11 11h1v6h1" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />,
  sparkle: <path d="M12 3v4m0 10v4m9-9h-4M7 12H3m14.5-5.5-2.8 2.8M9.3 14.7l-2.8 2.8m0-11 2.8 2.8m5.4 5.4 2.8 2.8" />,
  copy: <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Zm-4 6H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />,
  card: <path d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 5h18M6 15h4" />,
  cash: <path d="M2 6h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 9h.01M19 15h.01" />,
  walk: <path d="M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10.5 22l1.5-6-2.5-2.5.8-5L7 11l-1.5 3M14 8.5l3 1.5 2.5 3.5M13.5 16 17 22" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = 'h-5 w-5', filled = false, ...rest }: { name: IconName; className?: string; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      {paths[name]}
    </svg>
  );
}
