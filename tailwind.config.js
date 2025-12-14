module.exports = {
  content: [
    "./views/**/*.hbs",
    "./public/**/*.js"
  ],
  safelist: [
    // Button variants
    'btn',
    'btn-primary',
    'btn-secondary',
    'btn-outline',
    'btn-outline-secondary',
    'btn-outline-danger',
    'btn-ghost',
    'btn-ghost-primary',
    'btn-danger',
    'btn-soft-primary',
    'btn-soft-secondary',
    // Button sizes
    'btn-xs',
    'btn-sm',
    'btn-md',
    'btn-lg',
    'btn-xl',
    'btn-icon',
    'btn-icon-sm',
    'btn-icon-lg',
    // Cards
    'card',
    'card-hover',
    'card-compact',
    'card-gradient',
    'card-glass',
    // Badges
    'badge',
    'badge-widiba',
    'badge-relaxbanking',
    'badge-traderepublic',
    'badge-success',
    'badge-warning',
    'badge-danger',
    'badge-info',
    'badge-subtle',
    // Amounts
    'amount-in',
    'amount-out',
    'amount-zero',
    'amount-large',
    'amount-card',
    'amount-card-label',
    'amount-card-value',
    // Forms
    'form-input',
    'form-select',
    'form-label',
    'form-helper',
    'form-error',
    'input-fintech',
    'label-fintech',
    // Alerts
    'alert',
    'alert-success',
    'alert-error',
    'alert-warning',
    'alert-info',
    'alert-icon',
    'alert-content',
    'alert-title',
    'alert-message',
    // Progress
    'progress-bar',
    'progress-bar-fill',
    'progress-bar-indeterminate',
    // Upload
    'upload-progress-card',
    'upload-step',
    'upload-step-icon',
    // Spinners
    'spinner',
    'spinner-lg',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          dark: '#6D28D9',
          light: '#A78BFA',
          subtle: '#EDE9FE',
        },
        accent: {
          DEFAULT: '#10B981',
          dark: '#059669',
          light: '#6EE7B7',
          subtle: '#D1FAE5',
        },
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
