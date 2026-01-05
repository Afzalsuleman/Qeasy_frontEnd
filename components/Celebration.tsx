"use client";

import React, { useEffect, useState } from "react";

export interface CelebrationProps {
  message: string;
  onComplete?: () => void;
}

export default function Celebration({ message, onComplete }: CelebrationProps) {
  const [show, setShow] = useState(true);
  const [confetti, setConfetti] = useState<Array<{
    id: number;
    x: number;
    y: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    // Generate confetti particles
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 0.5,
    }));
    setConfetti(particles);

    // Hide after animation
    const timer = setTimeout(() => {
      setShow(false);
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center">
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {confetti.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-bounce"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDelay: `${particle.delay}s`,
                backgroundColor: [
                  "#4f46e5",
                  "#10b981",
                  "#f59e0b",
                  "#ef4444",
                  "#8b5cf6",
                ][particle.id % 5],
              }}
            />
          ))}
        </div>

        {/* Party Popper Emoji */}
        <div className="text-6xl mb-4 animate-bounce">🎉</div>

        {/* Success Message */}
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Success!
        </h2>
        <p className="text-lg text-gray-600 mb-6">{message}</p>

        {/* Animated Checkmark */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

