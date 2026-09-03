import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Broad source inventory, not a hand-maintained list of three buttons. New
// pages, dialogs, attributes, options, templates and API errors enter the gate.
// Provider prompts, parsing tokens, logs and HTML email templates aren't UI.
const ignoredProperties = new Set(["systemInstruction", "prompt", "schema", "responseJsonSchema", "html", "subject", "keywords"]);
const ignoredCalls = new Set(["includes", "startsWith", "endsWith", "split", "replace", "replaceAll", "match", "test", "indexOf", "querySelector", "querySelectorAll"]);
const providerOnlyVariables = new Set(["typeRoles", "angles", "missionSchema", "fieldSchema"]);
function files(directory, extension = /\.tsx?$/) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name), extension) : extension.test(entry.name) ? [join(directory, entry.name)] : []);
}
function ignored(node) {
  for (let current = node; current; current = current.parent) {
    if (ts.isJsxElement(current) && current.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && ["data-no-translate", "data-i18n-data"].includes(attribute.name.getText()))) return true;
    if (ts.isPropertyAssignment(current) && ignoredProperties.has(current.name.getText().replace(/["']/g, ""))) return true;
    if (ts.isVariableDeclaration(current) && providerOnlyVariables.has(current.name.getText()) && current.getSourceFile().fileName.replaceAll("\\", "/").includes("/api/programs/")) return true;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      if (current.expression.expression.getText() === "console" || ignoredCalls.has(current.expression.name.text)) return true;
    }
  }
  return false;
}

export function collectCssCaptions(root = process.cwd()) {
  const captions = [];
  for (const filename of files(join(root, "app"), /\.css$/)) {
    const css = readFileSync(filename, "utf8");
    const rules = [...css.matchAll(/([^{}]+)\{[^{}]*?\bcontent\s*:\s*"([^"{}]+)"[^{}]*\}/g)];
    const kazakhSelectors = new Set(rules.filter((rule) => rule[1].includes('[lang="kk"]')).flatMap((rule) => rule[1].split(",").map((selector) => selector.replace(/\s+/g, " ").trim())));
    for (const match of rules) {
      if (match[1].includes('[lang="kk"]') || !/[А-Яа-яЁё]/.test(match[2])) continue;
      const selectors = match[1].split(",").map((selector) => selector.replace(/\s+/g, " ").trim());
      captions.push({
        text: match[2].replace(/\s+/g, " ").trim(),
        file: relative(root, filename).replaceAll("\\", "/"),
        line: css.slice(0, match.index).split("\n").length,
        missingSelectors: selectors.filter((selector) => !kazakhSelectors.has(`html[lang="kk"] ${selector}`)),
      });
    }
  }
  return captions;
}
export function collectInterfaceMessages(root = process.cwd()) {
  const messages = new Map();
  for (const filename of ["app", "lib", "db"].flatMap((dir) => files(join(root, dir)))) {
    const file = relative(root, filename).replaceAll("\\", "/");
    if (file === "lib/kazakh-translations.ts" || file.startsWith("lib/i18n/")) continue;
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      let text;
      if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
      else if (ts.isTemplateExpression(node)) text = node.head.text + node.templateSpans.map((span, i) => `{{${i}}}` + span.literal.text).join("");
      if (text && /[А-Яа-яЁё]/.test(text) && !/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(text) && !ignored(node)) {
        text = text.replace(/\s+/g, " ").trim();
        const locations = messages.get(text) ?? [];
        locations.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
        messages.set(text, locations);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  // Pseudo-element captions aren't DOM text nodes (notably mobile table labels).
  // Keep them in the inventory too; their explicit html[lang="kk"] CSS rule is
  // checked separately from the catalog's runtime text translation.
  for (const { text, file, line } of collectCssCaptions(root)) {
    const locations = messages.get(text) ?? [];
    locations.push({ file, line });
    messages.set(text, locations);
  }
  return messages;
}
