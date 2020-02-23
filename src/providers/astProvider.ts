import { readFileSync } from "fs";

import {
  DidChangeTextDocumentParams,
  IConnection,
  VersionedTextDocumentIdentifier,
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import Parser, { Point, SyntaxNode, Tree } from "web-tree-sitter";
import { ElmWorkspace } from "../elmWorkspace";
import { ElmWorkspaceMatcher } from "../util/elmWorkspaceMatcher";
import {
  TextDocumentContentChangeEvent,
  Range,
} from "vscode-languageserver-textdocument";
import { PositionUtil } from "../positionUtil";
import { ITextDocumentEvents } from "../util/textDocumentEvents";

export class ASTProvider {
  constructor(
    private connection: IConnection,
    elmWorkspaces: ElmWorkspace[],
    private textDocumentEvents: ITextDocumentEvents,
    private parser: Parser,
  ) {
    textDocumentEvents.on(
      "change",
      new ElmWorkspaceMatcher(elmWorkspaces, (params: DidChangeCallBack) =>
        URI.parse(params.textDocument.uri),
      ).handlerForWorkspace(this.handleChangeTextDocument),
    );
  }

  protected handleChangeTextDocument = async (
    params: DidChangeTextDocumentParams,
    elmWorkspace: ElmWorkspace,
  ): Promise<void> => {
    this.connection.console.info(
      `Changed text document, going to parse it. ${params.textDocument.uri}`,
    );
    const forest = elmWorkspace.getForest();
    const imports = elmWorkspace.getImports();
    const document: VersionedTextDocumentIdentifier = params.textDocument;

    let tree: Tree | undefined = forest.getTree(document.uri);
    if (tree === undefined) {
      const fileContent: string = readFileSync(
        URI.parse(document.uri).fsPath,
        "utf8",
      );
      tree = this.parser.parse(fileContent);
    }

    for (const changeEvent of params.contentChanges) {
      const fullDocument = this.textDocumentEvents.get(document.uri);
      if (ASTProvider.isIncremental(changeEvent) && fullDocument) {
        // range is range of the change. end is exclusive
        const { range } = changeEvent;
        const oldStartIndex: number = range.start.line * range.start.character;
        const oldEndIndex: number = range.end.line * range.end.character;
        if (tree) {
          tree.edit({
            // end index for new version of text
            newEndIndex: range.end.line * range.end.character - 1,
            // position in new doc change ended
            newEndPosition: PositionUtil.FROM_VS_POSITION(
              range.end,
            ).toTSPosition(),

            // end index for old version of text
            oldEndIndex,
            // position in old doc change ended.
            oldEndPosition: this.computeEndPosition(
              oldStartIndex,
              oldEndIndex,
              tree,
            ),

            // index in old doc the change started
            startIndex: oldStartIndex,
            // position in old doc change started
            startPosition: PositionUtil.FROM_VS_POSITION(
              range.start,
            ).toTSPosition(),
          });
          tree = this.parser.parse(fullDocument.getText(), tree);
        }
      } else {
        tree = this.parser.parse(changeEvent.text);
      }
    }
    if (tree) {
      forest.setTree(document.uri, true, true, tree);
      imports.updateImports(document.uri, tree, forest);
    }
  };

  private computeEndPosition = (
    startIndex: number,
    endIndex: number,
    tree: Tree,
  ): Point => {
    const node: SyntaxNode = tree.rootNode.descendantForIndex(
      startIndex,
      endIndex,
    );

    return node.endPosition;
  };

  private static isIncremental(
    event: TextDocumentContentChangeEvent,
  ): event is { range: Range; rangeLength?: number; text: string } {
    const candidate: {
      range: Range;
      rangeLength?: number;
      text: string;
    } = event as any;
    return (
      candidate !== undefined &&
      candidate !== null &&
      typeof candidate.text === "string" &&
      candidate.range !== undefined &&
      (candidate.rangeLength === undefined ||
        typeof candidate.rangeLength === "number")
    );
  }
}
