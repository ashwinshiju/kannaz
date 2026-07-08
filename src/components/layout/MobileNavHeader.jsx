import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const childRoutes = [
  { pattern: /^\/vehicles\/[^/]+$/, title: 'Vehicle Profile', back: '/vehicles' },
];

export default function MobileNavHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const childRoute = childRoutes.find(r => r.pattern.test(pathname));
  if (!childRoute) return null;

  return (
    <div className="md:hidden flex items-center gap-1 mb-4 -mt-1">
      <button
        onClick={() => navigate(childRoute.back)}
        className="flex items-center gap-1 -ml-2 px-2 py-1.5 rounded-lg hover:bg-accent text-foreground transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h1 className="text-lg font-semibold font-heading">{childRoute.title}</h1>
    </div>
  );
}