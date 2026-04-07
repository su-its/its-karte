import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Next.js App Router の src/pages/ との衝突を避けるため
    // FSD pages レイヤーを src/page/ (単数形) として使用
    // Steiger は page/ をレイヤーとして認識しないため、関連ルールを無効化
    files: ["./src/page/**"],
    rules: {
      "fsd/typo-in-layer-name": "off",
    },
  },
  {
    // page/ からの参照が Steiger に見えないため、widgets の参照チェックを無効化
    files: ["./src/widgets/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);
