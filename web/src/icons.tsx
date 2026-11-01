import type { ReactNode } from 'react';

type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconLogo({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <ellipse cx="12" cy="9.1" rx="6.1" ry="5.2" fill="#fff" />
      <circle cx="9.85" cy="8.55" r="1.15" fill="currentColor" />
      <circle cx="14.15" cy="8.55" r="1.15" fill="currentColor" />
      <circle cx="10.2" cy="8.25" r="0.32" fill="#fff" />
      <circle cx="14.5" cy="8.25" r="0.32" fill="#fff" />
      <path
        d="M6.6 12.1 C 3.8 12.6 3 14.4 2.7 16.6
           M17.4 12.1 C 20.2 12.6 21 14.4 21.3 16.6
           M7.4 13.4 C 5.2 15.2 4.4 18.2 4.1 21
           M9.4 14.3 C 8.2 16.6 7.6 18.8 7.5 21.2
           M11.1 14.6 C 10.6 17.2 10.3 19.2 10.4 21.4
           M12.9 14.6 C 13.4 17.2 13.7 19.2 13.6 21.4
           M14.6 14.3 C 15.8 16.6 16.4 18.8 16.5 21.2
           M16.6 13.4 C 18.8 15.2 19.6 18.2 19.9 21"
        fill="none"
        stroke="#fff"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.1l1.9 1.1M17.5 15.8l1.9 1.1M4.6 16.9l1.9-1.1M17.5 8.2l1.9-1.1" />
    </Svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 6H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
      <path d="M15 8l4 4-4 4M10 12h9" />
    </Svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 5L7 12l7 7" />
    </Svg>
  );
}

export function IconCaret({ open, size = 14 }: IconProps & { open?: boolean }) {
  return (
    <Svg size={size} className={open ? 'caret-icon open' : 'caret-icon'}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function IconChevron({ open, size = 16 }: IconProps & { open?: boolean }) {
  return (
    <Svg size={size} className={open ? 'chevron-icon open' : 'chevron-icon'}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15v-4M12 15V8M16 15v-7" />
    </Svg>
  );
}

export function IconFeed(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </Svg>
  );
}

export function IconAt(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M15 12v2.2a2 2 0 0 0 3.5 1.2" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.2-3.2 3.5-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
    </Svg>
  );
}

export function IconAccounts(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="16" cy="8.5" r="2" />
      <path d="M4.8 18c.9-2.6 2.6-3.8 4.2-3.8 1.7 0 3.3 1.2 4.2 3.8" />
      <path d="M14 14.2c1.4 0 2.8.9 3.6 3" />
    </Svg>
  );
}

export function IconTwitter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5l14 14M19 5L5 19" />
    </Svg>
  );
}

export function IconInstagram(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="16.4" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconComment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </Svg>
  );
}
