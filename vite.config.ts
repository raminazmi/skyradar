import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// عنوان خادم Laravel في التطوير — يمكن تجاوزه عبر BACKEND_URL.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // وكيل التطوير: يمرّر كل طلبات /api إلى خادم Laravel من جهة الخادم،
  // فيصبح المتصفّح يطلب من نفس الأصل (5173) ويختفي CORS تماماً.
  server: {
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
});
