import { memo } from 'react';

const emojis = {
    wave: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path fill="#1B4F72" d="M4.861 9.147c.94-.657 2.357-.531 3.201.166l-.968-1.407c-.779-1.111-.378-2.606.866-3.2.752-.36 1.602-.24 2.204.243l.047-.02c-.122-.867.396-1.735 1.335-2.04.897-.293 1.828.078 2.291.741l4.6 6.878.182-.213c.626-.864 1.937-1.108 2.87-.398.742.564.98 1.474.705 2.292l.114-.019c.84-.06 1.65.564 1.88 1.479.164.652.02 1.31-.335 1.79l-4.628 8.455c-1.03 1.51-2.7 3.034-5.378 3.034-2.414 0-4.312-.627-5.64-1.864-1.16-1.08-1.862-2.56-2.154-4.085-.352-1.825-1.242-4.723-2.353-6.722l-.686-1.076c-.874-1.286-.322-3.009 1.045-3.734z" />
            <path fill="#00F5A0" d="M8.062 9.313c-.94-.89-2.484-.913-3.201-.166-.93.97-.42 2.558 1.045 3.734l.686 1.076c1.111 2 2.001 4.897 2.353 6.722.292 1.525.994 3.005 2.154 4.085 1.328 1.237 3.226 1.864 5.64 1.864 2.678 0 4.348-1.524 5.378-3.034l4.628-8.455c.355-.48.499-1.138.335-1.79-.23-.915-1.04-1.539-1.88-1.479" opacity="0.3" />
        </svg>
    ),
    fire: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path fill="#F59E0B" d="M18 2c0 8-6 10-6 16 0 4.418 2.686 8 6 8s6-3.582 6-8c0-6-6-8-6-16z" />
            <path fill="#00F5A0" d="M18 10c0 4-3 6-3 10 0 2.761 1.343 5 3 5s3-2.239 3-5c0-4-3-6-3-10z" />
            <path fill="#1B4F72" d="M18 16c0 2.5-1.5 4-1.5 6 0 1.38.672 2.5 1.5 2.5s1.5-1.12 1.5-2.5c0-2-1.5-3.5-1.5-6z" />
        </svg>
    ),
    sparkle: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path fill="#00F5A0" d="M18 2l2.5 8.5L29 13l-8.5 2.5L18 24l-2.5-8.5L7 13l8.5-2.5z" />
            <path fill="#1B4F72" d="M28 4l1 3.5L32.5 9 29 10.5 28 14l-1-3.5L23.5 9 27 7.5z" opacity="0.7" />
            <path fill="#1B4F72" d="M8 22l1 3.5L12.5 27 9 28.5 8 32l-1-3.5L3.5 27 7 25.5z" opacity="0.5" />
        </svg>
    ),
    smile: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="16" fill="#1B4F72" />
            <circle cx="12" cy="14" r="2.5" fill="white" />
            <circle cx="24" cy="14" r="2.5" fill="white" />
            <path d="M10 22c2 4 6 6 8 6s6-2 8-6" stroke="#00F5A0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
    ),
    neutral: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="16" fill="#1B4F72" />
            <circle cx="12" cy="14" r="2.5" fill="white" />
            <circle cx="24" cy="14" r="2.5" fill="white" />
            <line x1="11" y1="23" x2="25" y2="23" stroke="#00F5A0" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    ),
    sad: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="16" fill="#1B4F72" />
            <circle cx="12" cy="14" r="2.5" fill="white" />
            <circle cx="24" cy="14" r="2.5" fill="white" />
            <path d="M10 26c2-4 6-6 8-6s6 2 8 6" stroke="#F59E0B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
    ),
    check: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="16" fill="#00F5A0" />
            <path d="M10 18l5 5 11-11" stroke="#1B4F72" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    warning: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path d="M18 3L2 33h32L18 3z" fill="#F59E0B" />
            <line x1="18" y1="14" x2="18" y2="23" stroke="#1B4F72" strokeWidth="3" strokeLinecap="round" />
            <circle cx="18" cy="28" r="1.5" fill="#1B4F72" />
        </svg>
    ),
    muscle: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path fill="#1B4F72" d="M8 26c0-4 3-7 7-7h6c4 0 7 3 7 7v2H8v-2z" />
            <path fill="#00F5A0" d="M14 12c0-3.3 2.7-6 4-6s4 2.7 4 6v7h-8v-7z" />
            <circle cx="18" cy="8" r="3" fill="#1B4F72" />
        </svg>
    ),
    walk: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="6" r="4" fill="#1B4F72" />
            <path d="M18 12v8l-4 8m4-8l4 8m-8-12l-4-2m8 2l4-2" stroke="#1B4F72" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="6" r="2" fill="#00F5A0" opacity="0.5" />
        </svg>
    ),
    stairs: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path d="M6 30h8v-8h8v-8h8v-8" stroke="#1B4F72" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 30h8v-8h8v-8h8v-8" stroke="#00F5A0" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" strokeDasharray="4 4" />
        </svg>
    ),
    breath: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#1B4F72" strokeWidth="2" />
            <path d="M12 18c0-3 2.7-6 6-6s6 3 6 6" stroke="#00F5A0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M14 20c0 2 1.8 4 4 4s4-2 4-4" stroke="#1B4F72" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
        </svg>
    ),
    trophy: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path d="M10 6h16v10c0 4.4-3.6 8-8 8s-8-3.6-8-8V6z" fill="#F59E0B" />
            <path d="M10 8H6v4c0 2.2 1.8 4 4 4V8zm16 0h4v4c0 2.2-1.8 4-4 4V8z" fill="#F59E0B" opacity="0.7" />
            <rect x="14" y="24" width="8" height="4" rx="1" fill="#1B4F72" />
            <rect x="11" y="28" width="14" height="3" rx="1.5" fill="#1B4F72" />
            <path d="M15 12h6" stroke="#00F5A0" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    lock: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <rect x="8" y="16" width="20" height="16" rx="3" fill="#94A3B8" />
            <path d="M12 16V11c0-3.3 2.7-6 6-6s6 2.7 6 6v5" stroke="#94A3B8" strokeWidth="3" fill="none" />
            <circle cx="18" cy="24" r="2.5" fill="#64748B" />
        </svg>
    ),
    mic: (
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <rect x="13" y="4" width="10" height="18" rx="5" fill="#1B4F72" />
            <path d="M8 18c0 5.5 4.5 10 10 10s10-4.5 10-10" stroke="#1B4F72" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <line x1="18" y1="28" x2="18" y2="33" stroke="#1B4F72" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="13" y1="33" x2="23" y2="33" stroke="#1B4F72" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="15" y="8" width="6" height="2" rx="1" fill="#00F5A0" opacity="0.6" />
            <rect x="15" y="12" width="6" height="2" rx="1" fill="#00F5A0" opacity="0.4" />
        </svg>
    ),
};

function CustomEmoji({ name, size = 24 }) {
    const style = { width: size, height: size, display: 'inline-flex', flexShrink: 0 };
    return <span style={style}>{emojis[name] || emojis.sparkle}</span>;
}

export default memo(CustomEmoji);