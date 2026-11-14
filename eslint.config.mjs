import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler rules (eslint-plugin-react-hooks v7). The app predates them and uses the
      // usual "restore from localStorage after mount" and "latest callback in a ref" patterns,
      // which these flag. Kept as warnings so they stay visible without blocking CI.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      // The API route maps Yahoo responses that are deliberately left unvalidated
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])
