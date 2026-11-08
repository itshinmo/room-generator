import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Relative base keeps the build portable, including GitHub Pages project sites
// served from https://<user>.github.io/<repository>/.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
