// components/Brand.tsx
import React from 'react';

type LogoVariant = 'green' | 'dark' | 'white' | 'auto';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
}

/**
 * Fees Please Text Logo Component
 * Renders the full typography logo with tagline.
 */
export function Logo({ variant = 'auto', className = '', alt = 'Fees Please', ...props }: LogoProps) {
  const baseClass = className;

  if (variant === 'green') {
    return (
      <img
        src="/branding/logo-green-1000x300.png"
        alt={alt}
        className={baseClass}
        {...props}
      />
    );
  }

  if (variant === 'dark') {
    return (
      <img
        src="/branding/logo-dark-1000x300.png"
        alt={alt}
        className={baseClass}
        {...props}
      />
    );
  }

  if (variant === 'white') {
    return (
      <img
        src="/branding/logo-white-1000x300.png"
        alt={alt}
        className={baseClass}
        {...props}
      />
    );
  }

  // 'auto' switches between dark logo (light mode) and white logo (dark mode)
  return (
    <>
      <img
        src="/branding/logo-dark-1000x300.png"
        alt={alt}
        className={`${baseClass} dark:hidden`}
        {...props}
      />
      <img
        src="/branding/logo-white-1000x300.png"
        alt={alt}
        className={`${baseClass} hidden dark:block`}
        {...props}
      />
    </>
  );
}

interface MarkProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: 192 | 512;
}

/**
 * Fees Please Circular Icon Mark
 * Renders the iconic crosshair FP symbol.
 */
export function Mark({ size = 192, className = '', alt = 'Fees Please Icon', ...props }: MarkProps) {
  const src = size === 512 ? '/branding/icon-512.png' : '/branding/icon-192.png';
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      {...props}
    />
  );
}
