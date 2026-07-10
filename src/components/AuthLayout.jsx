import React from "react";

const KANAZ_LOGO = 'https://media.base44.com/images/public/6a4c8bd5aa47eccb6a382770/29e671028_Kanas.png';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src={KANAZ_LOGO} alt="KANAZ" className="inline-block w-14 h-14 rounded-2xl object-cover mb-4" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}