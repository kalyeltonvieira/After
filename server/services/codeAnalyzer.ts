import * as ts from "typescript";

export type Certainty = "KNOWN" | "INFERRED" | "UNKNOWN";

export interface CodeSymbol {
  name: string;
  type: "function" | "class" | "component" | "interface" | "type" | "variable";
  line: number;
  endLine: number;
  exported: boolean;
}

export interface CodeImport {
  specifier: string;
  line: number;
  kind: "import" | "require" | "export";
}

export interface CodeCall {
  callee: string;
  line: number;
}

export interface CodeAnalysis {
  path: string;
  language: string;
  parser: "typescript" | "python" | "go" | "heuristic";
  symbols: CodeSymbol[];
  imports: CodeImport[];
  exports: string[];
  calls?: CodeCall[];
  certainty: Certainty;
  evidence: string[];
}

const detectLanguage = (p: string) => {
  const ext = p.toLowerCase().split(".").pop();
  switch (ext) {
    case "tsx":
      return "TypeScript React";
    case "ts":
      return "TypeScript";
    case "jsx":
      return "JavaScript React";
    case "js":
      return "JavaScript";
    case "py":
      return "Python";
    case "go":
      return "Go";
    case "rs":
      return "Rust";
    case "java":
      return "Java";
    case "json":
      return "JSON";
    default:
      return ext || "unknown";
  }
};

const lineOf = (s: string, p: number) => s.slice(0, p).split("\n").length;

const dedupe = <T>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = JSON.stringify(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

function tsAnalyze(path: string, source: string): CodeAnalysis {
  const kind = /\.tsx$/i.test(path)
    ? ts.ScriptKind.TSX
    : /\.jsx$/i.test(path)
    ? ts.ScriptKind.JSX
    : /\.ts$/i.test(path)
    ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;

  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const symbols: CodeSymbol[] = [];
  const imports: CodeImport[] = [];
  const calls: CodeCall[] = [];
  const exports = new Set<string>();

  const isExp = (n: ts.Node) =>
    Boolean((n as any).modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword));

  const visit = (n: ts.Node) => {
    const line = lineOf(source, n.getStart(file));
    const endLine = lineOf(source, n.getEnd());

    if (ts.isFunctionDeclaration(n) && n.name) {
      const isComponent = /^[A-Z]/.test(n.name.text);
      symbols.push({
        name: n.name.text,
        type: isComponent ? "component" : "function",
        line,
        endLine,
        exported: isExp(n),
      });
    } else if (ts.isClassDeclaration(n) && n.name) {
      symbols.push({
        name: n.name.text,
        type: "class",
        line,
        endLine,
        exported: isExp(n),
      });
    } else if (ts.isInterfaceDeclaration(n)) {
      symbols.push({
        name: n.name.text,
        type: "interface",
        line,
        endLine,
        exported: isExp(n),
      });
    } else if (ts.isTypeAliasDeclaration(n)) {
      symbols.push({
        name: n.name.text,
        type: "type",
        line,
        endLine,
        exported: isExp(n),
      });
    } else if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          const isFn =
            d.initializer &&
            (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
          const isComponent = isFn && /^[A-Z]/.test(d.name.text);
          symbols.push({
            name: d.name.text,
            type: isComponent ? "component" : isFn ? "function" : "variable",
            line,
            endLine,
            exported: isExp(n),
          });
        }
      }
    } else if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      imports.push({ specifier: n.moduleSpecifier.text, line, kind: "import" });
    } else if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "require" &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      imports.push({ specifier: n.arguments[0].text, line, kind: "require" });
    } else if (ts.isCallExpression(n)) {
      if (ts.isIdentifier(n.expression)) {
        calls.push({ callee: n.expression.text, line });
      } else if (ts.isPropertyAccessExpression(n.expression)) {
        calls.push({ callee: `${n.expression.expression.getText(file)}.${n.expression.name.text}`, line });
      }
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      imports.push({ specifier: n.moduleSpecifier.text, line, kind: "export" });
    }

    ts.forEachChild(n, visit);
  };

  visit(file);

  for (const s of file.statements) {
    if (ts.isExportAssignment(s)) exports.add("default");
    if (ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause)) {
      s.exportClause.elements.forEach((e) => exports.add(e.name.text));
    }
    const name = (s as any).name?.text;
    if (isExp(s) && name) exports.add(name);
  }

  const diagnostics = ((file as any).parseDiagnostics || []) as any[];
  return {
    path,
    language: detectLanguage(path),
    parser: "typescript",
    symbols: dedupe(symbols),
    imports: dedupe(imports),
    exports: [...exports],
    calls: dedupe(calls).slice(0, 50),
    certainty: diagnostics.length === 0 ? "KNOWN" : "INFERRED",
    evidence: [
      `TypeScript compiler AST parsed ${path}`,
      `${diagnostics.length} parser diagnostics`,
      `${symbols.length} code symbols detected`,
      `${imports.length} imports resolved`,
    ],
  };
}

function pythonAnalyze(path: string, source: string): CodeAnalysis {
  const symbols: CodeSymbol[] = [];
  const imports: CodeImport[] = [];
  const exports: string[] = [];
  const lines = source.split("\n");

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    // def func(
    const defMatch = lineText.match(/^def\s+([A-Za-z_]\w*)\s*\(/);
    if (defMatch) {
      symbols.push({
        name: defMatch[1],
        type: "function",
        line: lineNum,
        endLine: lineNum,
        exported: !defMatch[1].startsWith("_"),
      });
      if (!defMatch[1].startsWith("_")) exports.push(defMatch[1]);
    }

    // class ClassName
    const classMatch = lineText.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: "class",
        line: lineNum,
        endLine: lineNum,
        exported: !classMatch[1].startsWith("_"),
      });
      if (!classMatch[1].startsWith("_")) exports.push(classMatch[1]);
    }

    // import x or from x import y
    const fromImport = lineText.match(/^\s*from\s+([A-Za-z0-9_.]+)\s+import/);
    if (fromImport) {
      imports.push({ specifier: fromImport[1], line: lineNum, kind: "import" });
    } else {
      const directImport = lineText.match(/^\s*import\s+([A-Za-z0-9_.]+)/);
      if (directImport) {
        imports.push({ specifier: directImport[1], line: lineNum, kind: "import" });
      }
    }
  });

  return {
    path,
    language: "Python",
    parser: "python",
    symbols: dedupe(symbols),
    imports: dedupe(imports),
    exports: dedupe(exports),
    certainty: "KNOWN",
    evidence: [
      `Python structural analyzer parsed ${path}`,
      `${symbols.length} definitions found`,
      `${imports.length} module imports found`,
    ],
  };
}

function goAnalyze(path: string, source: string): CodeAnalysis {
  const symbols: CodeSymbol[] = [];
  const imports: CodeImport[] = [];
  const exports: string[] = [];
  const lines = source.split("\n");

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    // func (r *Receiver) Method() or func Function()
    const funcMatch = lineText.match(/^func\s+(?:\([^)]+\)\s*)?([A-Za-z_]\w*)\s*\(/);
    if (funcMatch) {
      const name = funcMatch[1];
      const isExported = /^[A-Z]/.test(name);
      symbols.push({
        name,
        type: "function",
        line: lineNum,
        endLine: lineNum,
        exported: isExported,
      });
      if (isExported) exports.push(name);
    }

    // type StructName struct / interface
    const typeMatch = lineText.match(/^type\s+([A-Za-z_]\w*)\s+(struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const isExported = /^[A-Z]/.test(name);
      symbols.push({
        name,
        type: typeMatch[2] === "struct" ? "class" : "interface",
        line: lineNum,
        endLine: lineNum,
        exported: isExported,
      });
      if (isExported) exports.push(name);
    }

    // import "path"
    const importMatch = lineText.match(/^\s*(?:import\s+)?"([^"]+)"/);
    if (importMatch && (lineText.includes("import") || idx < 30)) {
      imports.push({ specifier: importMatch[1], line: lineNum, kind: "import" });
    }
  });

  return {
    path,
    language: "Go",
    parser: "go",
    symbols: dedupe(symbols),
    imports: dedupe(imports),
    exports: dedupe(exports),
    certainty: "KNOWN",
    evidence: [
      `Go structural AST analyzer parsed ${path}`,
      `${symbols.length} functions and structs detected`,
      `${imports.length} package imports found`,
    ],
  };
}

function heuristic(path: string, source: string): CodeAnalysis {
  const symbols: CodeSymbol[] = [];
  const imports: CodeImport[] = [];

  for (const p of [
    { r: /\bdef\s+([A-Za-z_]\w*)\s*\(/g, t: "function" as const },
    { r: /\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/g, t: "function" as const },
    { r: /\bfn\s+([A-Za-z_]\w*)\s*\(/g, t: "function" as const },
    { r: /\bclass\s+([A-Za-z_]\w*)/g, t: "class" as const },
  ]) {
    for (const m of source.matchAll(p.r)) {
      symbols.push({
        name: m[1],
        type: p.t,
        line: lineOf(source, m.index || 0),
        endLine: lineOf(source, m.index || 0),
        exported: false,
      });
    }
  }

  for (const p of [
    /\b(?:from|import)\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const m of source.matchAll(p)) {
      imports.push({ specifier: m[1], line: lineOf(source, m.index || 0), kind: "import" });
    }
  }

  return {
    path,
    language: detectLanguage(path),
    parser: "heuristic",
    symbols: dedupe(symbols),
    imports: dedupe(imports),
    exports: [],
    certainty: "INFERRED",
    evidence: [`Heuristic structural parser used for ${path}`],
  };
}

export function analyzeSource(path: string, source: string): CodeAnalysis {
  if (/\.(tsx?|jsx?)$/i.test(path)) {
    return tsAnalyze(path, source);
  }
  if (/\.py$/i.test(path)) {
    return pythonAnalyze(path, source);
  }
  if (/\.go$/i.test(path)) {
    return goAnalyze(path, source);
  }
  return heuristic(path, source);
}
