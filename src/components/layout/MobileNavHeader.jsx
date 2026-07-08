import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const childRoutes = [
  { pattern: /^\/vehicles\/[^/]+$/, title: 'Vehicle Profile', back: '/vehicles' },
];

function titleize(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Page';
  const last = segments[segments.length - 1];
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function MobileNavHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const isChildRoute = childRoutes.some(r => r.pattern.test(pathname)) ||
    pathname.split('/').filter(Boolean).length >= 2;

  if (!isChildRoute) return null;

  const mapped = childRoutes.find(r => r.pattern.test(pathname));
  const title = mapped?.title || titleize(pathname);

  return (
    <div className="md:hidden flex items-center gap-1 mb-4 -mt-1">
      <button
        onClick={() => mapped ? navigate(mapped.back) : navigate(-1)}
        className="flex items-center gap-1 -ml-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h1 className="text-lg font-semibold font-heading">{title}</h1>
    </div>
  );
}