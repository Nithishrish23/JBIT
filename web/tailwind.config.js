/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem', // 20px
        lg: '2rem',    // 32px
        xl: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1280px', // Max container width 1280px
      },
    },
    extend: {
      colors: {
        // Brand Colors (Static, foundational)
        primary: {
          DEFAULT: 'var(--theme-brand-primary, #0f172a)', // Slate 900
          light: '#334155',
          dark: '#020617',
        },
        secondary: {
          DEFAULT: '#2563eb', // Blue 600
        },
        accent: {
          DEFAULT: '#3b82f6', // Blue 500
        },
        brandbg: {
          DEFAULT: '#f8fafc', // Slate 50
        },

        // Layout Colors (Static, foundational)
        pagebg: '#ffffff',
        cardbg: '#ffffff',
        sidebarbg: '#f8fafc',
        footerbg: '#0f172a',

        // Dynamic Theme Colors (from Admin Settings, with fallbacks to defaults)
        // Text Colors
        textprimary: 'var(--theme-text-primary, #000000)',
        textsecondary: 'var(--theme-text-secondary, #475569)',
        textmuted: 'var(--theme-text-muted, #94a3b8)',
        textinverse: 'var(--theme-text-inverse, #ffffff)',

        // Status Colors
        success: 'var(--theme-status-success, #10b981)',
        warning: 'var(--theme-status-warning, #f59e0b)',
        error: 'var(--theme-status-error, #ef4444)',
        info: 'var(--theme-status-info, #3b82f6)',

        // Button Colors
        button: {
          bg: 'var(--theme-button-bg, #2563eb)',
          text: 'var(--theme-button-text, #ffffff)',
        },
        // Header Colors
        header: {
          bg: 'var(--theme-header-bg, #ffffff)', 
          text: 'var(--theme-header-text, #0f172a)', 
        },
        // Footer Colors
        footer: {
          bg: 'var(--theme-footer-bg, #0f172a)', 
          text: 'var(--theme-footer-text, #f8fafc)', 
        },
        // Banner Colors
        banner: {
          bg: 'var(--theme-banner-bg, #f1f5f9)', 
          text: 'var(--theme-banner-text, #0f172a)', 
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Roboto"', '"Segoe UI"', 'sans-serif'],
        serif: ['"Roboto Slab"', 'serif'], // Fallback serif if needed, but mostly unused
      },
      fontSize: {
        // Headings
        'h1': ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'h2': ['36px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'h3': ['28px', { lineHeight: '1.4' }],
        'h4': ['24px', { lineHeight: '1.4' }], 
        'h5': ['20px', { lineHeight: '1.5' }],
        'h6': ['16px', { lineHeight: '1.5' }],

        // Body
        'body': ['16px', { lineHeight: '1.6' }],
        'subtext': ['14px', { lineHeight: '1.5' }],
        'caption': ['12px', { lineHeight: '1.5' }],

        // Pricing
        'price-lg': ['32px', { lineHeight: '1', fontWeight: '700' }],
        'price-normal': ['22px', { lineHeight: '1', fontWeight: '600' }],
      },
      borderRadius: {
        'card': '12px',
        'btn': '6px',
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'luxury': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px -3px rgba(59, 130, 246, 0.5)', // Blue glow
      },
      spacing: {
        '18': '4.5rem', // 72px
        '22': '5.5rem', // 88px
        '26': '6.5rem', // 104px
        'section': '5rem', // 80px (Approx 64-96px)
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/line-clamp'),
  ],
}