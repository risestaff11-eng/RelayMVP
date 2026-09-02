import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Execute the actual TS handlers/components in Node, substituting only runtime
// bindings (D1, cookies, email delivery). No production service is contacted.
export function typescriptLoader(overrides = {}) {
  const cache = new Map();
  function load(input) {
    const filename = input instanceof URL ? fileURLToPath(input) : input;
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const nativeRequire = createRequire(filename);
    function dependency(id) {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (!id.startsWith(".")) return nativeRequire(id);
      const base = resolve(dirname(filename), id);
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((path) => existsSync(path) && /\.tsx?$/.test(path));
      return target ? load(target) : nativeRequire(id);
    }
    runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(dependency, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load;
}
