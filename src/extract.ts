import { Project, SourceFile, Node, PropertySignature, TypeLiteralNode } from "ts-morph";

const MAX_NESTING_DEPTH = 5;

export type FieldType =
  | { kind: "primitive"; text: string }
  | { kind: "object"; fields: FieldShape[] };

export interface FieldShape {
  name: string;
  optional: boolean;
  type: FieldType;
}

export interface TypeInfo {
  name: string;
  kind: "interface" | "type" | "nested";
  filePath: string;
  line: number;
  fields: FieldShape[];
  raw: string;
}

function normalizeTypeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractTypes(project: Project): TypeInfo[] {
  const result: TypeInfo[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    collectFromFile(sourceFile, result);
  }

  return result;
}

// Builds a FieldShape for one property, recursing into nested object
// literals. Nested literals are also registered as standalone synthetic
// TypeInfo entries in `out`, so they compete as dedup candidates in their
// own right (not just as a factor in their parent's similarity score).
function buildField(
  p: PropertySignature,
  ownerName: string,
  sourceFile: SourceFile,
  out: TypeInfo[],
  depth: number
): FieldShape {
  const typeNode = p.getTypeNode();
  const qualifiedName = `${ownerName}.${p.getName()}`;

  if (depth < MAX_NESTING_DEPTH && typeNode && Node.isTypeLiteral(typeNode)) {
    const fields = extractLiteralFields(typeNode, qualifiedName, sourceFile, out, depth + 1);

    // Register the nested shape itself as a dedup candidate.
    out.push({
      name: qualifiedName,
      kind: "nested",
      filePath: sourceFile.getFilePath(),
      line: typeNode.getStartLineNumber(),
      fields,
      raw: typeNode.getText(),
    });

    return { name: p.getName(), optional: p.hasQuestionToken(), type: { kind: "object", fields } };
  }

  const text = normalizeTypeText(typeNode?.getText() ?? p.getType().getText());
  return { name: p.getName(), optional: p.hasQuestionToken(), type: { kind: "primitive", text } };
}

function extractLiteralFields(
  literal: TypeLiteralNode,
  ownerName: string,
  sourceFile: SourceFile,
  out: TypeInfo[],
  depth: number
): FieldShape[] {
  return literal.getProperties().map((p) => buildField(p, ownerName, sourceFile, out, depth));
}

function collectFromFile(sourceFile: SourceFile, out: TypeInfo[]): void {
  for (const iface of sourceFile.getInterfaces()) {
    const fields = iface.getProperties().map((p) => buildField(p, iface.getName(), sourceFile, out, 0));

    out.push({
      name: iface.getName(),
      kind: "interface",
      filePath: sourceFile.getFilePath(),
      line: iface.getStartLineNumber(),
      fields,
      raw: iface.getText(),
    });
  }

  for (const alias of sourceFile.getTypeAliases()) {
    const typeNode = alias.getTypeNode();
    // Only handle object-literal type aliases: type X = { a: string; b?: number }
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      const fields = typeNode.getProperties().map((p) => buildField(p, alias.getName(), sourceFile, out, 0));

      out.push({
        name: alias.getName(),
        kind: "type",
        filePath: sourceFile.getFilePath(),
        line: alias.getStartLineNumber(),
        fields,
        raw: alias.getText(),
      });
    }
  }
}
