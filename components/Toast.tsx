"use client";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
}

const typeStyles = {
  success: "bg-success",
  error: "bg-error",
  info: "bg-primary",
};

export function Toast({ message, type }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50">
      <div
        className={`${typeStyles[type]} text-white px-6 py-3 rounded-md shadow-lg animate-slide-in min-w-[250px]`}
      >
        {message}
      </div>
    </div>
  );
}
