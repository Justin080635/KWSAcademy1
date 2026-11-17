import { useReducedMotion } from 'motion/react';
import {
  BriefcaseBusiness,
  Clapperboard,
  Compass,
  Layers,
  MessageSquareQuote,
  Target,
} from 'lucide-react';
import type { PillarId, StyleId } from '../../../domain/types.ts';

interface StyleEmblemProps {
  styleId: StyleId | 'BROAD';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'onDark' | 'brand';
  className?: string;
}

const SIZE_MAP = {
  sm: 36,
  md: 56,
  lg: 76,
};

const STYLE_ICON_MOTION: Record<
  StyleId | 'BROAD',
  { className: string; duration: string; delay: string }
> = {
  STORYTELLER: { className: 'kws-icon-float-tilt', duration: '3.1s', delay: '0s' },
  STRATEGIST: { className: 'kws-icon-sway', duration: '3.4s', delay: '-0.6s' },
  CREATOR: { className: 'kws-icon-pulse-breath', duration: '2.8s', delay: '-1.1s' },
  CONNECTOR: { className: 'kws-icon-drift', duration: '3.1s', delay: '-1.6s' },
  EXECUTOR: { className: 'kws-icon-pulse-breath', duration: '2.7s', delay: '-0.4s' },
  OPPORTUNITY_BUILDER: { className: 'kws-icon-float-tilt', duration: '3.2s', delay: '-1.3s' },
  BROAD: { className: 'kws-icon-sway', duration: '3.5s', delay: '-0.8s' },
};

const CAPABILITY_ICON_MOTION: Record<
  PillarId,
  { className: string; duration: string; delay: string }
> = {
  media_industry_intelligence: {
    className: 'kws-icon-sway',
    duration: '3.4s',
    delay: '0s',
  },
  marketing_brand_strategy: {
    className: 'kws-icon-pulse-breath',
    duration: '2.7s',
    delay: '-0.5s',
  },
  strategic_communications_storytelling: {
    className: 'kws-icon-float-tilt',
    duration: '3.1s',
    delay: '-1.1s',
  },
  digital_content_media_production: {
    className: 'kws-icon-float-tilt',
    duration: '3.3s',
    delay: '-1.7s',
  },
  campaign_project_execution: {
    className: 'kws-icon-drift',
    duration: '2.9s',
    delay: '-2.2s',
  },
  creative_business_professional_development: {
    className: 'kws-icon-drift',
    duration: '3.4s',
    delay: '-2.8s',
  },
};

export function StyleEmblem({
  styleId,
  size = 'md',
  tone = 'brand',
  className = '',
}: StyleEmblemProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const px = SIZE_MAP[size];
  const primary =
    tone === 'onDark' ? '#ffffff' : 'var(--kws-accent)';
  const gold = 'var(--kws-gold)';
  const subtleFill =
    tone === 'onDark'
      ? 'rgba(255, 255, 255, 0.12)'
      : 'var(--kws-tint-bg)';
  const ringBorder =
    tone === 'onDark'
      ? 'rgba(255, 255, 255, 0.25)'
      : 'var(--kws-border)';
  const motionSpec = STYLE_ICON_MOTION[styleId];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: subtleFill,
        border: `1.5px solid ${ringBorder}`,
      }}
      aria-hidden="true"
    >
      {!prefersReducedMotion && (
        <span
          className="kws-emblem-glow pointer-events-none absolute -inset-1 rounded-full"
          style={{
            background:
              tone === 'onDark'
                ? 'radial-gradient(circle, rgba(232,206,156,0.42) 0%, rgba(255,255,255,0.12) 48%, transparent 74%)'
                : 'radial-gradient(circle, rgba(95,27,71,0.24) 0%, rgba(198,164,106,0.22) 48%, transparent 74%)',
          }}
        />
      )}
      <svg
        width={Math.round(px * 0.56)}
        height={Math.round(px * 0.56)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={prefersReducedMotion ? 'relative z-10' : `relative z-10 ${motionSpec.className}`}
        style={
          prefersReducedMotion
            ? undefined
            : {
                animationDuration: motionSpec.duration,
                animationDelay: motionSpec.delay,
              }
        }
      >
        {styleId === 'STORYTELLER' && (
          <>
            <path
              d="M6 19.5C6 12.5 11.5 7 18.5 7C22.8 7 26.2 10.2 26.2 14.3C26.2 18.4 22.8 21.5 18.5 21.5H12.5L7.5 25.5V19.5Z"
              stroke={primary}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="15" cy="14.2" r="1.6" fill={gold} />
            <circle cx="20.2" cy="14.2" r="1.6" fill={primary} />
          </>
        )}
        {styleId === 'STRATEGIST' && (
          <>
            <circle cx="16" cy="16" r="10.5" stroke={primary} strokeWidth="2.1" />
            <polygon
              points="16,8.5 19,16 16,23.5 13,16"
              stroke={primary}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <polygon points="16,8.5 19,16 16,16" fill={gold} />
            <circle cx="16" cy="16" r="2" fill={primary} />
          </>
        )}
        {styleId === 'CREATOR' && (
          <>
            <rect
              x="6.5"
              y="7.5"
              width="12"
              height="12"
              rx="3"
              stroke={primary}
              strokeWidth="2.1"
            />
            <circle
              cx="19.5"
              cy="19.5"
              r="6.2"
              stroke={gold}
              strokeWidth="2.2"
            />
            <circle cx="12.5" cy="13.5" r="1.8" fill={gold} />
          </>
        )}
        {styleId === 'CONNECTOR' && (
          <>
            <circle cx="11.5" cy="12" r="4.2" stroke={primary} strokeWidth="2.1" />
            <circle cx="21.5" cy="11.5" r="3.6" stroke={gold} strokeWidth="2.1" />
            <circle cx="17" cy="21.5" r="4" stroke={primary} strokeWidth="2.1" />
            <path
              d="M14.8 14.5L18.2 18.5M14.8 12H18.4"
              stroke={gold}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </>
        )}
        {styleId === 'EXECUTOR' && (
          <>
            <circle cx="16" cy="16" r="10.2" stroke={primary} strokeWidth="2.1" />
            <path
              d="M11.2 16.3L14.6 19.7L21.5 12.6"
              stroke={gold}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {styleId === 'OPPORTUNITY_BUILDER' && (
          <>
            <path
              d="M6.5 22.5L13.5 15.5L18 19.5L25.5 10.5"
              stroke={primary}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20.2 10.5H25.5V15.8"
              stroke={gold}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="25.5" cy="10.5" r="2" fill={gold} />
          </>
        )}
        {styleId === 'BROAD' && (
          <>
            <circle cx="16" cy="16" r="10.2" stroke={primary} strokeWidth="2" />
            <circle cx="16" cy="9.5" r="2" fill={gold} />
            <circle cx="21.6" cy="19" r="2" fill={primary} />
            <circle cx="10.4" cy="19" r="2" fill={gold} />
            <circle cx="16" cy="16" r="2.2" fill={primary} />
          </>
        )}
      </svg>
    </div>
  );
}

export function CapabilityIcon({
  pillarId,
  className = 'h-5 w-5',
}: {
  pillarId: PillarId;
  className?: string;
}) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const motionSpec = CAPABILITY_ICON_MOTION[pillarId];

  const renderIcon = () => {
    switch (pillarId) {
      case 'media_industry_intelligence':
        return <Compass className={className} aria-hidden="true" />;
      case 'marketing_brand_strategy':
        return <Target className={className} aria-hidden="true" />;
      case 'strategic_communications_storytelling':
        return <MessageSquareQuote className={className} aria-hidden="true" />;
      case 'digital_content_media_production':
        return <Clapperboard className={className} aria-hidden="true" />;
      case 'campaign_project_execution':
        return <Layers className={className} aria-hidden="true" />;
      case 'creative_business_professional_development':
        return <BriefcaseBusiness className={className} aria-hidden="true" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center ${
        prefersReducedMotion ? '' : motionSpec.className
      }`}
      style={
        prefersReducedMotion
          ? undefined
          : {
              animationDuration: motionSpec.duration,
              animationDelay: motionSpec.delay,
            }
      }
      aria-hidden="true"
    >
      {renderIcon()}
    </span>
  );
}
