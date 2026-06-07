import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // SWC transform so NestJS decorators + emitDecoratorMetadata work under Vitest.
    swc.vite({
      module: { type: "es6" },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{spec,test}.ts", "test-utils/**/*.{spec,test}.ts"],
    root: "./",
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.{test,spec}.ts",
        "**/__tests__/**",
        "**/*.d.ts",
        "src/main.ts",
        "**/*.module.ts",
        "prisma/migrations/**",
      ],
    },
  },
});
