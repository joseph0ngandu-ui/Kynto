import React from 'react';
import { motion } from 'framer-motion';

const NeuralLogo = ({ size = 64, loop = false }) => {
    const draw = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: (i) => ({
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: {
                    delay: i * 0.2,
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: loop ? Infinity : 0,
                    repeatType: "reverse"
                },
                opacity: { delay: i * 0.1, duration: 0.1 }
            }
        })
    };

    return (
        <motion.svg
            width={size} height={size} viewBox="0 0 100 100" fill="none"
            initial="hidden" animate="visible"
        >
            <motion.path
                d="M 50 10 L 85 30 L 85 70 L 50 90 L 15 70 L 15 30 Z"
                stroke="currentColor"
                strokeWidth="2"
                variants={draw}
                custom={0}
                style={{ color: 'var(--accent)' }}
            />
            <motion.path
                d="M 50 25 L 72 38 L 72 62 L 50 75 L 28 62 L 28 38 Z"
                stroke="currentColor"
                strokeWidth="1"
                variants={draw}
                custom={1}
                style={{ color: 'var(--text)' }}
            />
            {[0, 120, 240].map((angle, i) => {
                const r1 = 30, r2 = 45;
                const rad = (angle * Math.PI) / 180;
                return (
                    <motion.line
                        key={angle}
                        x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)}
                        x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)}
                        stroke="currentColor"
                        strokeWidth="1"
                        variants={draw}
                        custom={2 + i * 0.1}
                        style={{ color: 'var(--accent)' }}
                    />
                );
            })}
        </motion.svg>
    );
};

export default NeuralLogo;
