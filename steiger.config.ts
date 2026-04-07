import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Next.js App Router の src/pages/ との衝突を避けるため
    // FSD pages レイヤーを src/page/ (単数形) として使用
    files: ["./src/page/**"],
    rules: {
      "fsd/typo-in-layer-name": "off",
    },
  },
]);
