import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
  pulseSpeed: number;
}

const NODE_COUNT = 38;
const CONNECT_DISTANCE = 165;
const MAX_SPEED = 0.22;

function createNodes(width: number, height: number): Node[] {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * MAX_SPEED,
    vy: (Math.random() - 0.5) * MAX_SPEED,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.008 + Math.random() * 0.012,
  }));
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (nodesRef.current.length === 0) {
        nodesRef.current = createNodes(w, h);
      }
    };

    setSize();
    window.addEventListener('resize', setSize);

    let running = true;
    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) frameRef.current = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const draw = (time: number) => {
      if (!running) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const nodes = nodesRef.current;
      const reduced = reducedMotionRef.current;

      ctx.clearRect(0, 0, w, h);

      for (const node of nodes) {
        if (!reduced) {
          node.x += node.vx;
          node.y += node.vy;
          node.pulse += node.pulseSpeed;

          if (node.x < 0 || node.x > w) node.vx *= -1;
          if (node.y < 0 || node.y > h) node.vy *= -1;
          node.x = Math.max(0, Math.min(w, node.x));
          node.y = Math.max(0, Math.min(h, node.y));
        }

        const glow = 0.5 + Math.sin(node.pulse) * 0.25;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${glow * 0.85})`;
        ctx.fill();

        // soft halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${glow * 0.18})`;
        ctx.fill();
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);

          if (dist > CONNECT_DISTANCE) continue;

          const proximity = 1 - dist / CONNECT_DISTANCE;
          const pulse = reduced
            ? 0.5
            : 0.5 + 0.5 * Math.sin(time * 0.001 + (a.pulse + b.pulse) * 0.5);
          const alpha = proximity * pulse * 0.48;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', setSize);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="neural-bg-root" aria-hidden>
      <div className="neural-bg-glow neural-bg-glow--a" />
      <div className="neural-bg-glow neural-bg-glow--b" />
      <canvas ref={canvasRef} className="neural-bg-canvas" />
    </div>
  );
}
