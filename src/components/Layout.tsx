import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <main className="flex min-h-screen flex-col items-center bg-white text-gray-800 antialiased">
      {children}
    </main>
  );
}; 