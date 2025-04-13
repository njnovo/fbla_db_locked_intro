import React from "react";
import { cn } from "~/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "google" | "choice";
  size?: "sm" | "default" | "lg";
  // Add other props like isLoading, etc. if needed
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = "primary", size = "default", ...props }, ref) => {
    const baseClasses = "font-medium transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2";

    const variantClasses = {
      primary: "rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
      secondary: "rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500 shadow-sm",
      google: "flex w-full items-center justify-center gap-3 rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 shadow-sm",
      choice: "w-full rounded-md bg-white text-left text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 shadow-sm",
    };

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      default: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button"; 