import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { JIRA_WORKLOG_API_URL } from "../shared/jiraWorklog";

const worklogOrigin = new URL(JIRA_WORKLOG_API_URL);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    printUrls: true,
    // Same-origin proxy for Jira worklog API during local dev (avoids CORS; user's VPN still required).
    proxy: {
      "/jira-worklog-api": {
        target: worklogOrigin.origin,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/jira-worklog-api/, "/api"),
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
}));
