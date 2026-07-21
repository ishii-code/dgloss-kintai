import type { Config } from "tailwindcss";

/** peco-ui カラー。Primary #FCB900 / Secondary #FF6900。iPad 優先のためタップ領域広め。 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FCB900",
          foreground: "#1A1A1A",
        },
        secondary: {
          DEFAULT: "#FF6900",
          foreground: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
