import React from "react";
import { cn } from "~/utils";

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children, className, ...props }) => {
    return (
        <h1
            className={cn("text-4xl font-extrabold tracking-tight text-center sm:text-5xl", className)}
            {...props}
        >
            {children}
        </h1>
    );
}; 