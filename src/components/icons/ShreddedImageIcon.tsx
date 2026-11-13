import React from 'react';

interface ShreddedImageIconProps {
  className?: string;
}

export const ShreddedImageIcon: React.FC<ShreddedImageIconProps> = ({
  className = 'w-10 h-10 text-red-500',
}) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Top half of photo frame */}
      <path
        d="M11 32V15C11 11.6863 13.6863 9 17 9H47C50.3137 9 53 11.6863 53 15V32"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Sun circle in upper left */}
      <circle cx="22.5" cy="18.5" r="3.2" fill="currentColor" />
      {/* Mountain peaks clipped at shredder cut line */}
      <path
        d="M14.5 32L25.5 21.5L33 28.5L40.5 20L50 32H14.5Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      {/* Shredder slot / horizontal cut line */}
      <line
        x1="6"
        y1="33"
        x2="58"
        y2="33"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      {/* Paper-shredded strips hanging from the bottom half */}
      <path
        d="M13.5 36.5L13.5 49C13.5 50.8 12.6 52.3 11.8 53.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M21 36.5V54.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeOpacity="0.88"
      />
      <path
        d="M28.5 36.5V50.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M36 36.5V56"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path
        d="M43.5 36.5V51.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M50.5 36.5L50.5 49C50.5 50.8 51.4 52.3 52.2 53.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
    </svg>
  );
};
