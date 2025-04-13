import React from "react";

interface ErrorMessageProps {
    message: string;
    className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className }) => {
    return <div className={className ?? "text-red-500 text-xl"}>Error: {message}</div>;
}; 