/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      black: '#000000',
      white: '#ffffff',
      transparent: 'transparent',
      background: 'hsl(222, 47%, 4%)',
      foreground: 'hsl(210, 40%, 98%)',
      primary: {
        DEFAULT: 'hsl(190, 100%, 50%)',
        hover: 'hsl(190, 100%, 45%)',
        dark: 'hsl(190, 100%, 35%)',
      },
      secondary: 'hsl(217, 32%, 17%)',
      card: 'hsl(222, 47%, 6%)',
      border: 'hsl(217, 32%, 17%)',
      destructive: 'hsl(350, 100%, 50%)',
      warning: 'hsl(40, 100%, 50%)',
      accent: {
        cyan: 'hsl(190, 100%, 50%)',
        red: 'hsl(350, 100%, 50%)',
        orange: 'hsl(40, 100%, 50%)',
      },
    },
    fontFamily: {
      sans: ['Rajdhani', 'sans-serif'],
      heading: ['Chakra Petch', 'sans-serif'],
      mono: ['monospace'],
    },
    extend: {
      spacing: {
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
      },
      borderRadius: {
        'sm': 'var(--radius)',
        'md': 'var(--radius-xl)',
        'lg': 'var(--radius-2xl)',
        'xl': '1.25rem',
      },
      boxShadow: {
        'neon': '0 0 10px hsl(190, 100%, 50%)',
        'neon-lg': '0 0 20px hsl(190, 100%, 50%)',
        'glow': '0 0 15px rgba(0, 255, 255, 0.5)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'radar': 'radar-pulse 1.5s ease-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 255, 255, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.8)' },
        },
        'radar-pulse': {
          '0%': { transform: 'scale(0.5)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'gradient-glow': 'radial-gradient(circle at center, hsl(190, 100%, 50%, 0.1) 0%, transparent 70%)',
        'mesh-bg': 'linear-gradient(45deg, #0a0f1f 25%, transparent 25%, transparent 75%, #0a0f1f 75%, #0a0f1f)',
      },
    },
  },
  plugins: [],
}
