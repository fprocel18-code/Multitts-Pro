import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export default function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Sine wave parameters
    const waves = [
      { amplitude: 18, frequency: 0.008, speed: 0.08, color: "rgba(14, 165, 233, 0.6)" },  // Sky blue
      { amplitude: 12, frequency: 0.012, speed: -0.06, color: "rgba(56, 189, 248, 0.4)" }, // Light blue
      { amplitude: 6, frequency: 0.016, speed: 0.1, color: "rgba(129, 140, 248, 0.3)" },    // Indigo
      { amplitude: 4, frequency: 0.005, speed: -0.04, color: "rgba(14, 165, 233, 0.15)" }   // Subtle backdrop
    ];

    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw horizontal reference line
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw glowing waves
      waves.forEach((wave) => {
        ctx.beginPath();
        
        // Dynamic multiplier based on playing state
        // When playing, waves are larger and more chaotic
        // When paused, waves are calm, thin, and slowly oscillating ripples
        const ampMultiplier = isPlaying ? 1.5 : 0.15;
        const speedMultiplier = isPlaying ? 1.5 : 0.35;

        for (let x = 0; x < width; x++) {
          const rawY = Math.sin(x * wave.frequency + phaseRef.current * wave.speed * speedMultiplier);
          
          // Apply a bell curve envelope so the wave fades out gracefully at both left and right screen boundaries
          const envelope = Math.sin((x / width) * Math.PI);
          
          const y = centerY + rawY * wave.amplitude * ampMultiplier * envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = wave.color;
        ctx.lineWidth = isPlaying ? 2 : 1;
        ctx.stroke();
      });

      // Update oscillation phase
      phaseRef.current += 0.5;
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full h-24 bg-slate-950/60 rounded-xl border border-slate-900 overflow-hidden flex flex-col justify-center">
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-sky-500 animate-pulse" : "bg-slate-500"}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {isPlaying ? "Reproduciendo Voz" : "Modo de Espera"}
        </span>
      </div>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
