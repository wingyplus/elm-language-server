import {
  Diagnostic,
  DiagnosticSeverity,
  IConnection,
  Position,
  Range,
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import { IForest } from "../../forest";

type INewTreeSitterCallback = (diagnostics: Map<string, Diagnostic[]>) => void;

export class TreeSitterDiagnostics {
  constructor(
    private connection: IConnection,
    private elmWorkspaceFolder: URI,
    private forest: IForest,
  ) {}

  public async createDiagnostics(
    filePath: URI,
  ): Promise<Map<string, Diagnostic[]>> {
    return await this.checkForErrors(
      this.connection,
      this.elmWorkspaceFolder.fsPath,
      filePath.fsPath,
    );
  }

  private async checkForErrors(
    connection: IConnection,
    rootPath: string,
    filename: string,
  ) {
    const diagnostics: Map<string, Diagnostic[]> = new Map();
    this.forest.treeIndex.forEach(a => {
      const diag: Diagnostic[] = [];
      const errors = a.tree.rootNode.descendantsOfType("ERROR");
      errors.forEach(b => {
        if (b) {
          diag.push(
            Diagnostic.create(
              Range.create(
                Position.create(b.startPosition.row, b.startPosition.column),
                Position.create(b.endPosition.row, b.endPosition.column),
              ),
              b.text,
              DiagnosticSeverity.Error,
            ),
          );
        }
      });
      const missing = a.tree.rootNode.descendantsOfType("MISSING");
      missing.forEach(b => {
        if (b) {
          diag.push(
            Diagnostic.create(
              Range.create(
                Position.create(b.startPosition.row, b.startPosition.column),
                Position.create(b.endPosition.row, b.endPosition.column),
              ),
              b.text,
              DiagnosticSeverity.Error,
            ),
          );
        }
      });
      diagnostics.set(a.uri, diag);
    });

    return diagnostics;
  }
}
