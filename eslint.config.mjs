import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/app/(protected)/inbox/_components/ConversationActionsModal.tsx",
      "src/app/(protected)/inbox/_components/OrcamentoModal.tsx",
      "src/app/(protected)/inbox/_components/TemplatesManagerModal.tsx",
      "src/app/(protected)/inbox/_components/WABSettingsModal.tsx",
      "src/components/financeiro/fechamento-dia.tsx",
      "src/components/navigation/navigation-progress.tsx",
      "src/hooks/use-push-subscription.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "src/app/(protected)/hoje/page.tsx",
      "src/app/(protected)/inbox/_components/SelectionContext.tsx",
    ],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
