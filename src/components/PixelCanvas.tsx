import React, { useEffect, useRef } from "react";

interface Pixel {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulseAngle: number;
}

export function PixelCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Mouse coordinates for reactive interaction
    const mouse = { x: -1000, y: -1000, active: false };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    // Density based on screen area
    const pixelCount = Math.min(Math.floor((width * height) / 11000), 140);
    const pixels: Pixel[] = [];

    for (let i = 0; i < pixelCount; i++) {
      const baseAlpha = 0.15 + Math.random() * 0.55;
      pixels.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.floor(2 + Math.random() * 5), // 2px to 6px crisp squares
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: 0.015 + Math.random() * 0.03,
        pulseAngle: Math.random() * Math.PI * 2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle grid guides on canvas
      const gridSize = 40;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];

        // Motion drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen borders smoothly
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Pulsing monochromatic luminosity
        p.pulseAngle += p.pulseSpeed;
        p.alpha = p.baseAlpha + Math.sin(p.pulseAngle) * 0.2;

        // Mouse reaction (subtle magnetic avoidance / glow flare)
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140;
          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 1.8;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
            p.alpha = Math.min(p.alpha + 0.4, 0.95);
          }
        }

        const clampedAlpha = Math.max(0.08, Math.min(p.alpha, 0.95));

        // Draw crisp square pixel
        const px = Math.round(p.x);
        const py = Math.round(p.y);

        // Subtle outer glow halo for larger squares
        if (p.size >= 4 && clampedAlpha > 0.4) {
          ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha * 0.18})`;
          ctx.fillRect(px - 2, py - 2, p.size + 4, p.size + 4);
        }

        // Primary bright square pixel
        ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        ctx.fillRect(px, py, p.size, p.size);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ display: "block" }}
    />
  );
}
