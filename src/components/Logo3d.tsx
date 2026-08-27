"use client";

import { motion } from "framer-motion";

/**
 * 3D animated wordmark: per-letter spring entrance, CSS extrusion depth,
 * and a gentle idle float. Usage: <Logo3d /> or <Logo3d size="lg" />
 */
export default function Logo3d({ size = "md" }: { size?: "md" | "lg" }) {
  const text = "Ajaia Docs";
  const cls =
    size === "lg"
      ? "text-5xl sm:text-6xl tracking-tight"
      : "text-3xl sm:text-4xl tracking-tight";

  return (
    <motion.h1
      className={`logo-3d font-extrabold select-none ${cls}`}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      aria-label="Ajaia Docs"
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ opacity: 0, y: 40, rotateX: -90, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{
            delay: 0.15 + i * 0.06,
            type: "spring",
            stiffness: 260,
            damping: 18,
          }}
          whileHover={{ y: -8, rotateX: 14, scale: 1.12, transition: { type: "spring", stiffness: 400, damping: 10 } }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.h1>
  );
}
