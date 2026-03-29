'use client';

import { motion, useReducedMotion } from 'framer-motion/client';
import type { ReactNode } from 'react';
import styles from './LoginPage.module.css';

interface LoginContainerProps {
  children: ReactNode;
}

export function LoginContainer({ children }: LoginContainerProps) {
  const shouldReduce = useReducedMotion();

  const variants = {
    hidden: shouldReduce
      ? { opacity: 0 }
      : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0, 0, 0.2, 1] },
    },
  };

  return (
    <div className={styles.page} role="main">
      <motion.div
        className={styles.card}
        variants={variants}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    </div>
  );
}
