"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Shared page enter/exit transition — wraps every route via template.tsx. */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? undefined : { opacity: 0, y: 10 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
