// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214.3 31.8% 91.4%)",
        input: "hsl(214.3 31.8% 91.4%)",
        ring: "hsl(221.2 83.2% 53.3%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        primary: {
          DEFAULT: "hsl(221.2 83.2% 53.3%)",
          foreground: "hsl(210 40% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(210 40% 96%)",
          foreground: "hsl(222.2 84% 4.9%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(210 40% 96%)",
          foreground: "hsl(215.4 16.3% 46.9%)",
        },
        accent: {
          DEFAULT: "hsl(210 40% 96%)",
          foreground: "hsl(222.2 84% 4.9%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222.2 84% 4.9%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222.2 84% 4.9%)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin": "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
  safelist: [
    // Ensure commonly used classes are never purged
    'animate-pulse',
    'animate-spin',
    'transition-all',
    'duration-200',
    'duration-300',
    'hover:shadow-lg',
    'hover:shadow-xl',
    'hover:border-blue-200',
    'hover:scale-110',
    'group-hover:scale-110',
    'group-hover:shadow-lg',
    'bg-gradient-to-r',
    'bg-gradient-to-br',
    'from-blue-50',
    'to-blue-100',
    'from-green-50',
    'to-green-100',
    'from-orange-50',
    'to-orange-100',
    'from-purple-50',
    'to-purple-100',
    'from-blue-600',
    'to-blue-700',
    'from-gray-50',
    'to-gray-100',
    'text-emerald-600',
    'text-blue-600',
    'text-purple-600',
    'rounded-xl',
    'rounded-2xl',
    'rounded-3xl',
    'rounded-bl-3xl',
  ]
}

export default config;