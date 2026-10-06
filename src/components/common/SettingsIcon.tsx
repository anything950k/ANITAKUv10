import React from 'react';

export const SETTINGS_ICON_D = "M2902 3610 c125 -42 325 -142 391 -197 16 -13 33 -23 38 -23 12 0 228 -142 289 -190 108 -85 190 -207 190 -282 0 -40 -31 -68 -73 -68 -31 0 -92 66 -102 109 -7 33 -119 143 -187 184 -20 12 -46 29 -59 38 -116 78 -271 169 -369 215 -30 14 -66 34 -80 44 -14 10 -61 25 -105 34 -126 25 -173 11 -450 -138 -66 -36 -138 -78 -180 -106 -22 -15 -72 -47 -110 -72 -39 -25 -98 -72 -133 -104 -52 -49 -67 -70 -83 -119 -38 -113 -49 -218 -49 -468 0 -351 23 -473 113 -596 26 -35 47 -72 47 -82 0 -31 -36 -59 -77 -59 -32 0 -44 7 -86 52 -51 55 -99 146 -117 219 -16 66 -24 620 -12 785 12 154 36 235 92 313 33 45 132 122 300 234 36 24 79 50 95 59 17 8 72 41 123 72 51 31 96 56 100 56 4 0 39 15 77 34 145 70 236 97 300 89 17 -3 69 -18 117 -33z  m31 -783 c102 -60 192 -166 214 -252 30 -114 12 -234 -47 -323 -45 -68 -80 -100 -163 -150 -44 -27 -67 -33 -133 -38 -43 -4 -105 -1 -137 5 -133 25 -287 181 -303 307 -11 94 0 207 24 245 12 19 28 48 36 64 17 35 53 70 119 114 84 57 102 62 227 59 106 -3 119 -5 163 -31z  m873 -371 c16 -12 20 -29 22 -113 2 -54 -1 -155 -7 -224 -18 -229 -71 -309 -316 -479 -71 -49 -134 -89 -170 -109 -22 -12 -69 -40 -105 -61 -197 -117 -378 -190 -470 -190 -70 0 -178 37 -325 111 -179 90 -195 102 -195 152 0 73 56 88 148 40 366 -195 394 -194 747 4 147 82 369 231 432 290 40 37 57 62 73 108 28 78 49 227 50 338 0 111 16 147 63 147 18 0 42 -6 53 -14z M2680 2702 c-89 -48 -103 -60 -136 -115 -18 -32 -37 -75 -40 -95 -21 -129 114 -283 250 -284 56 -1 119 23 169 63 36 28 86 122 94 175 5 39 1 54 -33 120 -34 66 -46 80 -98 112 -75 45 -151 54 -206 24z";

interface SettingsIconProps {
  className?: string;
  size?: number | string;
  color?: string;
  glow?: boolean;
  strokeWidth?: number | string;
  strokeColor?: string;
}

export const SettingsIcon: React.FC<SettingsIconProps> = ({
  className = '',
  size = 28,
  color = 'currentColor',
  glow = false,
  strokeWidth = 0.5,
  strokeColor,
}) => {
  const stroke = strokeColor || color;
  const numStrokeWidth = typeof strokeWidth === 'string' ? parseFloat(strokeWidth) : strokeWidth;

  return (
    <svg
      width={size}
      height={size}
      viewBox="148 138 256 256"
      fill="none"
      className={className}
      style={{
        filter: glow ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.85))' : 'none',
      }}
    >
      <g transform="translate(0, 513) scale(0.1, -0.1)" fill={color}>
        <path
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
          d={SETTINGS_ICON_D}
          stroke={numStrokeWidth > 0 ? stroke : undefined}
          strokeWidth={numStrokeWidth > 0 ? strokeWidth : undefined}
          vectorEffect={numStrokeWidth > 0 ? 'non-scaling-stroke' : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={numStrokeWidth > 0 ? { vectorEffect: 'non-scaling-stroke' } : undefined}
        />
      </g>
    </svg>
  );
};
