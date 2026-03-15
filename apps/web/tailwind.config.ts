import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heebo: ['Heebo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        sans: ['Heebo', 'Inter', 'sans-serif'],
      },
      colors: {
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover': 'var(--bg-hover)',
        'border-default': 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'accent-teal': 'var(--accent-teal)',
        'accent-blue': 'var(--accent-blue)',
        'accent-amber': 'var(--accent-amber)',
        'accent-red': 'var(--accent-red)',
        'accent-green': 'var(--accent-green)',
        'accent-purple': 'var(--accent-purple)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'topbar-bg': 'var(--topbar-bg)',
        sherlocked: {
          'bg-base': '#0F1117',
          'bg-surface': '#1A1D27',
          'bg-elevated': '#22253A',
          'bg-hover': '#2A2D3E',
          border: '#2E3150',
          'border-subtle': '#1E2035',
          'text-primary': '#E8EAFF',
          'text-secondary': '#8B8FA8',
          'text-muted': '#555870',
          teal: '#00C4AA',
          blue: '#4A9EFF',
          amber: '#F59E0B',
          red: '#EF4444',
          green: '#10B981',
          purple: '#8B5CF6',
          sidebar: '#13161F',
          topbar: '#13161F',
        },
      },
      backgroundColor: {
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover': 'var(--bg-hover)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'topbar-bg': 'var(--topbar-bg)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        subtle: 'var(--border-subtle)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
    },
  },
  plugins: [],
}

export default config
