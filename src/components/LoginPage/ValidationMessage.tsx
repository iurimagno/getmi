'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion/client';
import styles from './LoginPage.module.css';

interface ValidationMessageProps {
  id: string;
  message: string | null;
  role?: 'alert' | 'status';
}

export function ValidationMessage({
  id,
  message,
  role = 'alert',
}: ValidationMessageProps) {
  const shouldReduce = useReducedMotion();

  return (
    <AnimatePresence>
      {message && (
        <motion.span
          id={id}
          role={role}
          aria-live="polite"
          className={styles.fieldError}
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={
            shouldReduce
              ? { opacity: 1, height: 'auto', marginTop: 4 }
              : { opacity: 1, height: 'auto', marginTop: 4, transition: { duration: 0.15 } }
          }
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
        >
          {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
