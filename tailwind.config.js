/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F2F4F6",
        card: "#FFFFFF",
        point: "#3182F6",
        "point-hover": "#1B64DA",
        "text-strong": "#191F28",
        "text-body": "#333D4B",
        "text-muted": "#8B95A1",
        "text-disabled": "#B0B8C1",
        border: "#E5E8EB",
        "border-strong": "#D1D6DB",
        sunday: "#F04452",
        saturday: "#3182F6",
        success: "#00A63E",
        "success-bg": "#E5F6EA",
        pending: "#C77700",
        "pending-bg": "#FFF3E0",
        danger: "#D93636",
        "danger-bg": "#FFF1F1",
        "danger-border": "#FFD7D7",
        "tab-bg": "#E8EBEE",
        gcal: "#8B5CF6",
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.04)",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Apple SD Gothic Neo",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
