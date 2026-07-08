import React, { useState, useRef, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const THRESHOLD = 70;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (!isMobile || refreshingRef.current || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [isMobile]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile || !pulling.current || refreshingRef.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (window.scrollY <= 0) {
      if (diff > 0) {
        const newDist = Math.min(diff * 0.5, MAX_PULL);
        pullDistanceRef.current = newDist;
        setPullDistance(newDist);
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback(async () => {
    if (!isMobile || !pulling.current) return;
    pulling.current = false;
    if (pullDistanceRef.current >= THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    } else {
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, [isMobile, onRefresh]);

  if (!isMobile) return <>{children}</>;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pullDistance, transition: pulling.current ? 'none' : 'height 0.2s ease' }}
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <RefreshCw
            className="w-5 h-5 text-primary transition-opacity"
            style={{ opacity: pullDistance / THRESHOLD }}
          />
        )}
      </div>
      {children}
    </div>
  );
}