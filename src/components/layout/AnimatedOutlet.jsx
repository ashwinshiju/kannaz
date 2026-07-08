import React, { useRef } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const isMobile = useIsMobile();
  const prevPathRef = useRef(location.pathname);

  const prevDepth = prevPathRef.current.split('/').filter(Boolean).length;
  const currDepth = location.pathname.split('/').filter(Boolean).length;
  const isPush = currDepth > prevDepth;
  prevPathRef.current = location.pathname;

  const variants = isMobile
    ? {
        initial: isPush ? { x: '100%', opacity: 0 } : { x: '-25%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: isPush ? { x: '-25%', opacity: 0 } : { x: '100%', opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: isMobile ? 0.22 : 0.15, ease: [0.4, 0, 0.2, 1] }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}