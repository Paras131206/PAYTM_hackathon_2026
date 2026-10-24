import type { SVGProps } from "react";

export function PaytmLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`paytm-brand-lockup ${className}`} aria-label="Paytm UPI Resolv">
      <div className="paytm-logo-text">
        <span className="paytm-pay">pay</span>
        <span className="paytm-tm">tm</span>
      </div>
      <div className="paytm-upi-tag">
        <span className="paytm-heart" aria-hidden>❤️</span>
        <span className="paytm-upi">UPI</span>
      </div>
      <span className="paytm-divider" aria-hidden>|</span>
      <span className="paytm-product">resolv</span>
    </div>
  );
}

export function RobotMascot({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`robot-mascot ${className}`}
      aria-hidden="true"
    >
      {/* Robot Head Body */}
      <rect x="22" y="24" width="56" height="46" rx="20" fill="url(#bot_head_grad)" stroke="#00BAF2" strokeWidth="2.5" />
      
      {/* Robot Ears / Headphones */}
      <rect x="14" y="36" width="8" height="22" rx="4" fill="#00BAF2" />
      <rect x="78" y="36" width="8" height="22" rx="4" fill="#00BAF2" />
      <circle cx="18" cy="47" r="2" fill="#FFFFFF" />
      <circle cx="82" cy="47" r="2" fill="#FFFFFF" />

      {/* Robot Antenna */}
      <line x1="50" y1="24" x2="50" y2="14" stroke="#00BAF2" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="12" r="4.5" fill="#00E5FF" />
      <circle cx="50" cy="12" r="2" fill="#FFFFFF" />

      {/* Screen Face */}
      <rect x="30" y="32" width="40" height="30" rx="12" fill="#061224" />
      
      {/* Cute Big Glowing Eyes */}
      <ellipse cx="41" cy="46" rx="5" ry="6.5" fill="#00BAF2" />
      <circle cx="42.5" cy="44.5" r="2" fill="#FFFFFF" />
      <circle cx="39.5" cy="48" r="0.9" fill="#FFFFFF" />

      <ellipse cx="59" cy="46" rx="5" ry="6.5" fill="#00BAF2" />
      <circle cx="60.5" cy="44.5" r="2" fill="#FFFFFF" />
      <circle cx="57.5" cy="48" r="0.9" fill="#FFFFFF" />

      {/* Cheerful Smile */}
      <path d="M46 54 Q50 58 54 54" stroke="#00BAF2" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Chest / Torso Hint */}
      <path d="M34 72 Q50 78 66 72 L69 86 Q50 90 31 86 Z" fill="url(#bot_head_grad)" stroke="#00BAF2" strokeWidth="1.8" />
      <circle cx="50" cy="80" r="3.5" fill="#00E5FF" />

      <defs>
        <linearGradient id="bot_head_grad" x1="22" y1="24" x2="78" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#122A4A" />
          <stop offset="1" stopColor="#0B1A2F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 5,
  color = "#00BAF2",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="progress-ring-bg"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="progress-ring-circle"
        />
      </svg>
      <div className="progress-ring-text">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function IconCases(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M6 8h12M6 12h8M6 16h5" />
    </svg>
  );
}

export function IconQueue(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

export function IconSystem(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconSparkles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}
