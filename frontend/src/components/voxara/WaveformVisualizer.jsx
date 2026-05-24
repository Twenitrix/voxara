import { useEffect, useRef } from 'react';

export default function WaveformVisualizer({ isActive = true, barCount = 40, color = '#00F5A0' }) {
    const canvasRef = useRef(null);
    const animFrameRef = useRef(null);
    const barsRef = useRef(Array.from({ length: barCount }, () => Math.random() * 0.3));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();

        const animate = () => {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);

            const barWidth = rect.width / barCount;
            const gap = 2;
            const maxHeight = rect.height * 0.8;
            const centerY = rect.height / 2;

            barsRef.current = barsRef.current.map((h, i) => {
                if (isActive) {
                    const target = 0.15 + Math.sin(Date.now() * 0.003 + i * 0.4) * 0.35 + Math.random() * 0.15;
                    return h + (target - h) * 0.12;
                } else {
                    return h + (0.05 - h) * 0.05;
                }
            });

            barsRef.current.forEach((h, i) => {
                const barH = h * maxHeight;
                const x = i * barWidth + gap / 2;
                const w = Math.max(1, barWidth - gap);
                const radius = Math.max(0, Math.min(w / 2, barH / 2));

                if (barH <= 0) return;

                const gradient = ctx.createLinearGradient(x, centerY - barH / 2, x, centerY + barH / 2);
                gradient.addColorStop(0, color + '40');
                gradient.addColorStop(0.5, color);
                gradient.addColorStop(1, color + '40');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, centerY - barH / 2, w, barH, radius);
                ctx.fill();
            });

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animate();
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [isActive, barCount, color]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
        />
    );
}
