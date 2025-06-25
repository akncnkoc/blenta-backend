import { resolve } from "node:path";
import viteFastify from "@fastify/vite/plugin";
import viteReact from "@vitejs/plugin-react";

export default {
  root: resolve(import.meta.dirname, "client"),
  plugins: [viteFastify(), viteReact({ jsxRuntime: "classic" })],
};
