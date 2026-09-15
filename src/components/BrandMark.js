import React from 'react';

/**
 * HPAIR brand lockup.
 *
 * Built as inline SVG + real text rather than an image for three reasons: it
 * stays crisp at any size, the words are selectable and readable by screen
 * readers, and it adds no network request to the critical path.
 *
 * On the shield: this is an original mark drawn in the style of the HPAIR
 * banner -- a crimson shield with three bars abstracting the three books of the
 * Harvard arms. It deliberately does not reproduce Harvard's VERITAS crest,
 * which is a registered mark and not mine to redraw. To use the official asset
 * instead, drop the PNG into `public/` and swap the <svg> for an <img>; the
 * surrounding type is what carries the identity either way.
 */

function Shield({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 48"
      role="img"
      aria-label="HPAIR shield"
      focusable="false"
    >
      <path
        d="M3 3 H37 V25 C37 34.5 28.5 41.6 20 45 C11.5 41.6 3 34.5 3 25 Z"
        fill="currentColor"
      />
      <g fill="#fff">
        <rect x="10" y="11" width="20" height="4.6" rx="0.7" />
        <rect x="10" y="18.4" width="20" height="4.6" rx="0.7" />
        <rect x="10" y="25.8" width="20" height="4.6" rx="0.7" />
      </g>
    </svg>
  );
}

/**
 * @param {'light'|'dark'} tone  'light' for the crimson header, 'dark' on white.
 */
export default function BrandMark({ tone = 'light' }) {
  return (
    <div className={`brand brand-${tone}`}>
      <Shield className="brand-shield" />
      <span className="brand-type">
        <span className="brand-name">HPAIR</span>
        <span className="brand-full">
          Harvard College Project for
          <br />
          Asian and International Relations
        </span>
      </span>
    </div>
  );
}
