"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * 3D animated wordmark: per-letter spring entrance, CSS extrusion depth,
 * cursor parallax tilt (desktop), and a gentle idle float.
 * Usage: <Logo3d /> or <Logo3d size="lg" />
 */
export default function Logo3d({ size = "md" }: { size?: "md" | "lg" }) {
  const text = "Ajaia Docs";
  const cls =
    size === "lg"
      ? "text-5xl sm:text-6xl tracking-tight"
      : "text-3xl sm:text-4xl tracking-tight";
  const reduced = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);

  // cursor parallax tilt (desktop, skipped for reduced motion)
  useEffect(() => {
    if (reduced || window.matchMedia("(pointer: coarse)").matches) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `perspective(600px) rotateY(${dx * 10}deg) rotateX(${-dy * 8}deg)`;
    };
    const onLeave = () => {
      el.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg)";
    };
    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  return (
    <motion.h1
      ref={ref}
      className={`logo-3d font-extrabold select-none transition-transform duration-200 ease-out ${cls}`}
      animate={reduced ? undefined : { y: [0, -4, 0] }}
      transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformStyle: "preserve-3d" }}
      aria-label="Ajaia Docs"
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
          initial={reduced ? undefined : { opacity: 0, y: 40, rotateX: -90, scale: 0.6 }}
          animate={reduced ? undefined : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={
            reduced
              ? undefined
              : { delay: 0.15 + i * 0.06, type: "spring", stiffness: 260, damping: 18 }
          }
          whileHover={
            reduced
              ? undefined
              : { y: -8, rotateX: 14, scale: 1.12, transition: { type: "spring", stiffness: 400, damping: 10 } }
          }
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.h1>
  );
}
