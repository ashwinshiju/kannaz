import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Syncs a modal's open state with a URL search parameter so that the
 * Android hardware back button closes the modal instead of exiting the app.
 *
 * When the modal opens, a search param is pushed (new history entry).
 * When the back button removes the param, onClose is called.
 * When the modal closes programmatically, the param is removed (replace).
 */
export default function useModalHistory(open, onClose, paramKey = 'modal') {
  const [searchParams, setSearchParams] = useSearchParams();
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sync open state → URL
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const next = new URLSearchParams(searchParams);
      next.set(paramKey, 'open');
      setSearchParams(next);
    } else if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      const next = new URLSearchParams(searchParams);
      if (next.get(paramKey)) {
        next.delete(paramKey);
        setSearchParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paramKey]);

  // Detect back button (URL change → state)
  useEffect(() => {
    if (!searchParams.get(paramKey) && wasOpenRef.current) {
      wasOpenRef.current = false;
      onCloseRef.current(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, paramKey]);
}