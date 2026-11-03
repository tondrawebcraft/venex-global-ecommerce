/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { ink: '#1c211c', moss: '#4e6045', sand: '#f2efe8', clay: '#bc7054' }, fontFamily: { sans: ['Arial', 'Helvetica', 'sans-serif'], display: ['Georgia', 'serif'] } } },
  plugins: []
};

