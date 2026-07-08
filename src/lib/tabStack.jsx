import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TAB_PATHS = ['/', '/trips', '/vehicles', '/live-map', '/settings'];

function getTabBase(pathname) {
  if (pathname === '/') return '/';
  for (const p of TAB_PATHS) {
    if (p !== '/' && (pathname === p || pathname.startsWith(p + '/'))) {
      return p;
    }
  }
  return null;
}

const TabStackContext = createContext({ lastTabPaths: {}, recordPath: () => {} });

export function TabStackProvider({ children }) {
  const location = useLocation();
  const [lastTabPaths, setLastTabPaths] = useState({});

  const recordPath = useCallback((tabBase, path) => {
    setLastTabPaths(prev => ({ ...prev, [tabBase]: path }));
  }, []);

  useEffect(() => {
    const tabBase = getTabBase(location.pathname);
    if (tabBase) {
      setLastTabPaths(prev => prev[tabBase] === location.pathname ? prev : { ...prev, [tabBase]: location.pathname });
    }
  }, [location.pathname]);

  return (
    <TabStackContext.Provider value={{ lastTabPaths, recordPath }}>
      {children}
    </TabStackContext.Provider>
  );
}

export function useTabStack() {
  return useContext(TabStackContext);
}

export { getTabBase, TAB_PATHS };