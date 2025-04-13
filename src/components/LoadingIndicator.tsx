import React from "react";

interface LoadingIndicatorProps {
    text?: string;
    className?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ text = "Loading...", className }) => {
    return <div className={className ?? "text-xl"}>{text}</div>;
}; 