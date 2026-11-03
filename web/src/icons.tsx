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
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#e6e6e6" />
      <g transform="translate(16 16) scale(0.8) translate(-16 -16)">
        <path
          fill="#1a1a1a"
          d="M2.8 11.6h6.4l8.2-6.8v21.6l-8.2-6.8H2.8c-.8 0-1.4-.6-1.4-1.4v-5.2c0-.8.6-1.4 1.4-1.4z"
        />
        <path
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2.25"
          strokeLinecap="round"
          d="M20.4 12.4a4.6 4.6 0 0 1 0 7.2"
        />
        <path
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2.25"
          strokeLinecap="round"
          d="M25.2 8.8a8.6 8.6 0 0 1 0 14.4"
        />
      </g>
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

export function IconBoard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4" width="4.5" height="16" rx="1" />
      <rect x="9.75" y="4" width="4.5" height="10" rx="1" />
      <rect x="16" y="4" width="4.5" height="13" rx="1" />
    </Svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
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
