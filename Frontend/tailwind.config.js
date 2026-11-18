/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Surfaces & text (neumorphism needs one base surface colour)
        base: v('surface'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        // Brand + semantic
        primary: { DEFAULT: v('primary'), soft: v('primary-soft') },
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        chart: v('chart-1'),
      },
      boxShadow: {
        // Raised
        neu: '8px 8px 16px rgb(var(--shadow-dark)), -8px -8px 16px rgb(var(--shadow-light))',
        'neu-sm': '4px 4px 8px rgb(var(--shadow-dark)), -4px -4px 8px rgb(var(--shadow-light))',
        'neu-lg': '14px 14px 28px rgb(var(--shadow-dark)), -14px -14px 28px rgb(var(--shadow-light))',
        // Pressed / inset (inputs, active states)
        'neu-in': 'inset 5px 5px 10px rgb(var(--shadow-dark)), inset -5px -5px 10px rgb(var(--shadow-light))',
        'neu-in-sm': 'inset 3px 3px 6px rgb(var(--shadow-dark)), inset -3px -3px 6px rgb(var(--shadow-light))',
        // Focus ring that sits on top of a neu shadow
        ring: '0 0 0 3px rgb(var(--primary) / 0.35)',
      },
      borderRadius: {
        neu: '1.25rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },
  plugins: [],
};
