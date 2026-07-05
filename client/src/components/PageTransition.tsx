/**
 * PageTransition - Wrapper component for page transitions
 * Uses framer-motion for smooth fade + slide animations
 */

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        duration: 0.25,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
