import React from "react";
import { cn } from "~/utils"; // Assuming you have a utility for classnames like shadcn/ui

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
   children: React.ReactNode;
}

export const Container: React.FC<ContainerProps> = ({ children, className, ...props }) => {
    return (
        <div
         className={cn("container mx-auto max-w-6xl px-4 py-10", className)}
         {...props}
        >
         {children}
        </div>
    );
};

// Helper function (if you don't have one) in src/utils/index.ts or similar
// import { type ClassValue, clsx } from "clsx"
// import { twMerge } from "tailwind-merge"
// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs))
// } 