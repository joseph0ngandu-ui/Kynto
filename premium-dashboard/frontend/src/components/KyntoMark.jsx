/* KyntoMark — Official Kynto logo, animated
 * Props:
 *   size      = 40         – width/height in px
 *   animated  = true       – enable all animations
 *   bg        = false      – show white background rect
 */
import React from 'react';

let _uid = 0;

const KyntoMark = ({ size = 40, animated = true, bg = false }) => {
    const [id] = React.useState(() => `km${++_uid}`);

    /* ─────────────────────────────────────────────────────────────────────
       Timing design (matches ~2.5s loading screen):
         0.00s  K spine slides in from left        (1.3s)
         0.40s  Right bracket slides in from right (1.3s) → done @1.70s
         0.55s  K upper arm drops from top         (1.4s) → done @1.95s
         0.70s  Bracket shadow fades               (0.9s) → done @1.60s
         0.85s  Cream connector drops              (1.0s) → done @1.85s
         1.10s  Bottom hook rises                  (1.3s) → done @2.40s
         1.35s  Hook overlap fades                 (1.0s) → done @2.35s
         1.60s–2.4s  Zigzag overlays fade in (5×, stagger 0.2s)
       Idle: glow breathe 3.5s · scale pulse 4.5s · shimmer cascade 10s
    ───────────────────────────────────────────────────────────────────── */
    const css = `
        /* ── Whole-logo glow breathe ─── */
        @keyframes ${id}Glow {
            0%, 100% {
                filter:
                    drop-shadow(0 0 3px  rgba(230,57,70,0.20))
                    drop-shadow(0 0 0px  rgba(230,57,70,0));
            }
            50% {
                filter:
                    drop-shadow(0 0 16px rgba(230,57,70,0.65))
                    drop-shadow(0 0 36px rgba(230,57,70,0.22))
                    drop-shadow(0 0 6px  rgba(240,240,240,0.12));
            }
        }

        /* ── Entrance: right bracket slides from right ─── */
        @keyframes ${id}SlideR {
            from { opacity: 0; transform: translateX(22px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        /* ── Entrance: K spine slides from left ─── */
        @keyframes ${id}SlideL {
            from { opacity: 0; transform: translateX(-20px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        /* ── Entrance: drops from top ─── */
        @keyframes ${id}SlideD {
            from { opacity: 0; transform: translateY(-18px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        /* ── Entrance: rises from bottom ─── */
        @keyframes ${id}SlideU {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        /* ── Entrance: simple fade ─── */
        @keyframes ${id}FadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        /* ── Entrance: zigzag fade to resting opacity ─── */
        @keyframes ${id}ZigIn {
            from { opacity: 0; }
            to   { opacity: 0.45; }
        }

        /* ── Idle: scale breathe on K body ─── */
        @keyframes ${id}Pulse {
            0%, 100% { transform: scale(1);     transform-origin: 125px 125px; }
            50%      { transform: scale(1.018); transform-origin: 125px 125px; }
        }

        /* ── Idle: zigzag shimmer (bright flash then back to rest) ─── */
        @keyframes ${id}Zap {
            0%, 10%, 100% { opacity: 0.45; }
            3%, 7%         { opacity: 1.00; }
        }

        /* ── Applied classes ─── */

        /* Whole SVG glow */
        .${id}wrap {
            animation: ${id}Glow 3.5s ease-in-out infinite;
            overflow: visible;
        }

        /* Main shapes — entrance only */
        .${id}s1 { animation: ${id}SlideR 1.3s cubic-bezier(0.16,1,0.3,1) 0.40s both; }
        .${id}s2 { animation: ${id}FadeIn 0.9s ease                        0.70s both; }
        .${id}s3 { animation: ${id}SlideD 1.0s cubic-bezier(0.16,1,0.3,1) 0.85s both; }
        .${id}s4 { animation: ${id}SlideU 1.3s cubic-bezier(0.16,1,0.3,1) 1.10s both; }
        .${id}s5 { animation: ${id}FadeIn 1.0s ease                        1.35s both; }

        /* K upper arm — entrance then scale breathe */
        .${id}body {
            animation:
                ${id}SlideD 1.4s cubic-bezier(0.16,1,0.3,1) 0.55s both,
                ${id}Pulse  4.5s ease-in-out                 2.0s  infinite;
        }
        /* K spine — entrance then scale breathe */
        .${id}spine {
            animation:
                ${id}SlideL 1.3s cubic-bezier(0.16,1,0.3,1) 0.00s both,
                ${id}Pulse  4.5s ease-in-out                 1.35s infinite;
        }

        /* Zigzags — entrance then shimmer cascade
           Entrance ends exactly as shimmer cycle begins for each. */
        .${id}z0 {
            animation:
                ${id}ZigIn 0.9s ease 1.60s both,
                ${id}Zap   10s  ease-in-out 2.50s infinite;
        }
        .${id}z1 {
            animation:
                ${id}ZigIn 0.9s ease 1.80s both,
                ${id}Zap   10s  ease-in-out 4.50s infinite;
        }
        .${id}z2 {
            animation:
                ${id}ZigIn 0.9s ease 2.00s both,
                ${id}Zap   10s  ease-in-out 6.50s infinite;
        }
        .${id}z3 {
            animation:
                ${id}ZigIn 0.9s ease 2.20s both,
                ${id}Zap   10s  ease-in-out 8.50s infinite;
        }
        .${id}z4 {
            animation:
                ${id}ZigIn 0.9s ease 2.40s both,
                ${id}Zap   10s  ease-in-out 0.50s infinite;
        }
    `;

    const A = animated;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 250 250"
            fill="none"
            className={A ? `${id}wrap` : ''}
            style={{ overflow: 'visible', flexShrink: 0 }}
        >
            {A && <style>{css}</style>}

            <defs>
                {/* z0, z1 — near the K arm: red gradient (matches bracket family) */}
                <linearGradient id={`${id}g0`} x1="116.005" y1="31.8672" x2="121.903" y2="41.6143" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#e63946"/>
                    <stop offset="1" stopColor="#e63946" stopOpacity="0.15"/>
                </linearGradient>
                <linearGradient id={`${id}g1`} x1="108.81" y1="47.2656" x2="120.16" y2="83.6611" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#e63946"/>
                    <stop offset="1" stopColor="#e63946" stopOpacity="0.10"/>
                </linearGradient>
                {/* z2, z3 — on the K spine: steel grey gradient (matches spine family) */}
                <linearGradient id={`${id}g2`} x1="74.2382" y1="130.527" x2="74.2382" y2="154.611" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#94a3b8"/>
                    <stop offset="1" stopColor="#94a3b8" stopOpacity="0.10"/>
                </linearGradient>
                <linearGradient id={`${id}g3`} x1="71.1644" y1="140.563" x2="71.1644" y2="162.397" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#94a3b8"/>
                    <stop offset="1" stopColor="#94a3b8" stopOpacity="0.10"/>
                </linearGradient>
                {/* z4 — near the hook: red gradient (matches hook family) */}
                <linearGradient id={`${id}g4`} x1="129.794" y1="171.727" x2="129.794" y2="205.449" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#e63946"/>
                    <stop offset="1" stopColor="#e63946" stopOpacity="0.15"/>
                </linearGradient>
            </defs>

            {bg && <rect width="250" height="250" fill="#080808"/>}

            {/* ── Right bracket (slides in from right) ── */}
            <path className={A ? `${id}s1` : ''}
                d="M 240.77,58.94 C 221.51,59.77 207.66,65.38 207.66,82.56 V 117.21 L 224.16,134.41 C 215.96,139.21 197.05,141.11 185.06,135.74 L 240.77,188.94 V 58.94 Z"
                fill="#e63946"/>

            {/* ── Bracket shadow (deep red for depth) ── */}
            <path className={A ? `${id}s2` : ''}
                d="M 207.66,98.09 L 224.16,134.41 L 207.66,117.21 V 98.09 Z"
                fill="#9f1239"/>

            {/* ── Fill connector (near-white matches --text) ── */}
            <path className={A ? `${id}s3` : ''}
                d="M 151.28,66.62 L 224.16,134.41 C 215.96,139.21 197.05,141.11 185.06,135.74 V 189.38 H 160.61 C 176.21,167.13 171.11,141.19 150.98,121.06 L 151.28,66.62 Z"
                fill="#f0f0f0"/>

            {/* ── Bottom hook (red — same family as bracket) ── */}
            <path className={A ? `${id}s4` : ''}
                d="M 49.35,196.72 C 61.09,199.18 74.94,194.77 83.73,186.98 L 96.07,199.33 L 126.68,168.72 C 132.08,163.32 129.91,154.94 123.25,150.29 L 116.28,140.11 L 137.51,118.88 L 150.98,132.35 C 165.91,147.28 166.25,171.88 150.38,187.75 L 96.19,243 L 49.35,196.72 Z"
                fill="#e63946"/>

            {/* ── Hook overlap (slightly muted red) ── */}
            <path className={A ? `${id}s5` : ''}
                d="M 126.38,152.11 C 141.16,165.21 148.75,179.92 138.28,199.71 L 150.38,187.61 C 164.94,173.05 165.01,150.14 150.16,133.49 L 137.51,118.88 L 116.28,140.11 L 126.38,152.11 Z"
                fill="#c8303c"/>

            {/* ── K upper arm — steel grey (secondary, techy) ── */}
            <path className={A ? `${id}body` : ''}
                d="M 146.79,6 L 187.91,47.71 L 167.32,69.51 L 146.79,49.05 L 116.21,80.81 C 110.81,86.21 111.03,93.81 116.43,99.21 L 131.36,113.41 L 110.13,134.64 L 93.08,117.59 C 78.15,104.12 77.93,79.06 93.52,63.47 L 146.79,6 Z"
                fill="#94a3b8"/>

            {/* ── K spine — same steel grey ── */}
            <path className={A ? `${id}spine` : ''}
                d="M 58.98,59.16 H 83.13 C 67.26,79.29 68.87,106.26 86.91,125.22 L 91.02,128.89 V 153.95 C 91.02,171.13 75.08,188.87 55.54,188.87 C 43.8,188.87 34.64,183.04 28.52,175.51 L 8.32,151.21 L 29.33,130.2 L 48.87,152.33 C 53.18,157.21 58.98,155.28 58.98,148.46 V 59.16 Z"
                fill="#94a3b8"/>

            {/* ── Zigzag overlays — entrance then shimmer cascade ── */}
            <path className={A ? `${id}z0` : ''} opacity={A ? undefined : '0.5'} fill={`url(#${id}g0)`}
                d="M 106.09,47.27 L 120.65,32.71 L 122.04,34.1 L 124.13,32.01 L 125.82,33.7 L 123.41,36.11 L 122.04,34.75 L 120.65,36.14 L 122.04,37.53 L 120.16,39.41 L 118.47,37.72 L 116.86,39.33 L 118.47,40.94 L 116.78,42.63 L 115.09,40.94 L 113.41,42.63 L 115.09,44.31 L 113.41,45.99 L 111.72,44.31 L 110.03,45.99 L 111.72,47.68 L 109.85,49.55 L 108.16,47.86 L 106.09,47.27 Z"/>
            <path className={A ? `${id}z1` : ''} opacity={A ? undefined : '0.5'} fill={`url(#${id}g1)`}
                d="M 102.17,52.11 C 96.12,66.13 98.72,83.24 115.01,96.04 C 111.03,89.77 112.72,84.16 117.16,79.72 L 115.62,78.18 L 117.86,75.94 L 116.17,74.26 L 117.86,72.57 L 119.55,74.26 L 120.65,73.16 L 117.86,70.37 L 119.55,68.68 L 117.86,67 L 116.17,68.68 L 114.49,67 L 116.17,65.32 L 114.49,63.63 L 112.8,65.32 L 111.11,63.63 L 112.8,61.94 L 111.11,60.26 L 112.8,58.57 L 111.11,56.89 L 112.8,55.2 L 114.49,56.89 L 116.17,55.2 L 114.49,53.52 L 112.8,55.2 L 111.11,53.52 L 109.43,55.2 L 107.74,53.52 L 109.43,51.83 L 107.74,50.15 L 106.06,51.83 L 104.37,50.15 L 102.17,52.11 Z"/>
            <path className={A ? `${id}z2` : ''} opacity={A ? undefined : '0.5'} fill={`url(#${id}g2)`}
                d="M 59.06,136.04 L 60.74,137.72 L 59.06,139.41 V 142.83 L 60.74,144.51 L 59.06,146.2 V 149.06 L 60.74,150.75 L 59.06,152.44 L 60.74,154.12 L 62.43,152.44 L 64.12,154.12 L 65.8,152.44 L 67.49,154.12 L 69.18,152.44 L 70.86,154.12 L 72.55,152.44 L 74.24,154.12 L 75.92,152.44 L 74.24,150.75 L 75.92,149.06 L 77.61,150.75 L 79.3,149.06 L 77.61,147.38 L 79.3,145.69 L 80.98,147.38 L 82.67,145.69 L 80.98,144.01 L 82.67,142.32 L 84.36,144.01 L 86.04,142.32 L 84.36,140.64 L 86.04,138.95 L 87.73,140.64 L 89.42,138.95 L 87.73,137.27 L 89.42,135.58 L 87.73,133.9 L 89.42,132.21 L 87.73,130.53 H 85.21 L 83.52,132.21 L 81.84,130.53 L 80.15,132.21 L 78.46,130.53 L 76.78,132.21 L 75.09,130.53 L 73.41,132.21 L 71.72,130.53 L 70.03,132.21 L 68.35,130.53 L 66.66,132.21 L 64.97,130.53 L 63.29,132.21 L 61.6,130.53 L 59.06,131.92 V 136.04 Z"/>
            <path className={A ? `${id}z3` : ''} opacity={A ? undefined : '0.5'} fill={`url(#${id}g3)`}
                d="M 51.46,154.76 C 56.71,160.81 61.96,162.75 68.64,162.31 C 78.76,161.64 87.13,154.12 90.87,142.02 L 89.42,140.56 L 87.73,142.25 L 86.04,140.56 L 84.36,142.25 L 82.67,140.56 L 80.98,142.25 L 79.3,140.56 L 77.61,142.25 L 75.92,140.56 L 74.24,142.25 L 72.55,140.56 L 70.86,142.25 L 69.18,140.56 L 67.49,142.25 L 69.18,143.93 L 67.49,145.62 L 65.8,143.93 L 64.12,145.62 L 65.8,147.3 L 64.12,148.99 L 62.43,147.3 L 60.74,148.99 L 59.06,147.3 L 57.19,149.17 C 57.19,152.67 54.71,156.01 51.46,154.76 Z"/>
            <path className={A ? `${id}z4` : ''} opacity={A ? undefined : '0.5'} fill={`url(#${id}g4)`}
                d="M 128.11,171.73 L 126.42,173.42 L 128.11,175.1 L 126.42,176.79 L 128.11,178.47 L 126.42,180.16 L 128.11,181.85 L 126.42,183.53 L 128.11,185.22 L 126.42,186.9 L 124.73,185.22 L 123.05,186.9 L 124.73,188.59 L 123.05,190.28 L 124.73,191.96 L 123.05,193.65 L 124.73,195.33 L 123.05,197.02 L 124.73,198.7 L 123.05,200.39 L 124.73,202.08 L 123.05,203.76 L 124.73,205.45 L 126.42,203.76 L 128.11,205.45 L 129.79,203.76 L 128.11,202.08 L 129.79,200.39 L 131.48,202.08 L 133.17,200.39 L 131.48,198.7 L 133.17,197.02 L 134.85,198.7 L 136.54,197.02 L 134.85,195.33 L 136.54,193.65 L 134.85,191.96 L 136.54,190.28 L 134.85,188.59 L 136.54,186.9 L 134.85,185.22 L 136.54,183.53 L 134.85,181.85 L 136.54,180.16 C 135.15,176.35 133.21,174.18 128.11,171.73 Z"/>
        </svg>
    );
};

export default KyntoMark;
