import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const targetPath = path.resolve(
  process.cwd(),
  "node_modules/typescript-plugin-css-modules/dist/helpers/createDtsExports.js",
);

const replacementBlock = `    if (options.goToDefinition && cssExports.sourceMap) {
        // Create a new source map consumer.
        var smc_1 = new source_map_js_1.SourceMapConsumer(cssExports.sourceMap);
        // Split original CSS file into lines.
        var cssLines_1 = (_c = (_b = cssExports.css) === null || _b === void 0 ? void 0 : _b.split('\\n')) !== null && _c !== void 0 ? _c : [];
        // Keep object property declarations aligned with the original CSS lines so
        // default-import member access (\`styles.foo\`) can jump to the class line.
        var propertyLines_1 = Array.from(Array(cssLines_1.length || 1), function () { return ''; });
        // Preserve named exports for compatibility, even though their definitions
        // are appended after the default export block.
        var namedExportLines_1 = [];
        // Create a list of filtered classnames and hashed classnames.
        var filteredClasses_1 = Object.entries(cssExports.classes)
            .map(function (_a) {
            var classname = _a[0], originalClassname = _a[1];
            return [
                // TODO: Improve this. It may return multiple valid classnames and we
                // want to handle all of those.
                (0, classTransforms_1.transformClasses)(options.classnameTransform)(classname)[0],
                originalClassname,
            ];
        })
            .filter(function (_a) {
            var classname = _a[0];
            return isValidVariable(classname);
        });
        filteredClasses_1.forEach(function (_a) {
            var classname = _a[0], originalClassname = _a[1];
            var matchedLine;
            var matchedColumn;
            for (var i = 0; i < cssLines_1.length; i++) {
                var match = new RegExp(
                // NOTE: This excludes any match not starting with:
                // - \`.\` for classnames,
                // - \`:\` or \` \` for animation names,
                // and any matches followed by valid CSS selector characters.
                "[:.\\\\s]".concat(originalClassname, "(?![_a-zA-Z0-9-])"), 'g').exec(cssLines_1[i]);
                if (match) {
                    matchedLine = i;
                    matchedColumn = match.index;
                    break;
                }
            }
            var lineNumber = smc_1.originalPositionFor({
                // Lines start at 1, not 0.
                line: matchedLine ? matchedLine + 1 : 1,
                column: matchedColumn ? matchedColumn : 0,
            }).line;
            var targetLine = lineNumber ? lineNumber - 1 : 0;
            propertyLines_1[targetLine] += "  ".concat(classnameToProperty(classname));
            namedExportLines_1.push(classnameToNamedExport(classname));
        });
        propertyLines_1[0] = "declare let _classes: {".concat(propertyLines_1[0]);
        if (options.allowUnknownClassnames) {
            propertyLines_1[propertyLines_1.length - 1] += '\\n  [key: string]: string;';
        }
        propertyLines_1[propertyLines_1.length - 1] += '\\n};\\nexport default _classes;';
        dts = propertyLines_1.join('\\n') + '\\n';
        if (options.namedExports !== false && namedExportLines_1.length) {
            dts += namedExportLines_1.join('\\n') + '\\n';
        }
    }
    else {
        dts += "declare let _classes:\\n  ".concat(processedClasses.map(classnameToProperty).join('\\n  ')).concat(options.allowUnknownClassnames ? '\\n  [key: string]: string;' : '', "\\n};\\nexport default _classes;\\n");
        if (options.namedExports !== false &&
            filteredClasses.length) {
            dts += filteredClasses.join('\\n') + '\\n';
        }
    }`;

const source = readFileSync(targetPath, "utf8");

if (source.includes("default-import member access (`styles.foo`) can jump to the class line.")) {
  process.exit(0);
}

const pattern =
  /    if \(options\.goToDefinition && cssExports\.sourceMap\) \{[\s\S]*?    if \(options\.customTemplate\) \{/;

if (!pattern.test(source)) {
  throw new Error("Unsupported typescript-plugin-css-modules version for local patch");
}

writeFileSync(
  targetPath,
  source.replace(pattern, `${replacementBlock}\n    if (options.customTemplate) {`),
);
