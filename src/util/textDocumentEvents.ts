import { EventEmitter } from "events";
import {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  TextDocumentsConfiguration,
} from "vscode-languageserver";
import { IDocumentEvents } from "./documentEvents";
import { TextDocument } from "vscode-languageserver-textdocument";

export type DidChangeCallback = (document: TextDocument) => void;
export type DidCloseCallback = (document: TextDocument) => void;
export type DidOpenCallback = (document: TextDocument) => void;
export type DidSaveCallback = (document: TextDocument) => void;

export interface ITextDocumentEvents {
  on(event: "change", listener: DidChangeCallback): this;
  on(event: "close", listener: DidCloseCallback): this;
  on(event: "open", listener: DidOpenCallback): this;
  on(event: "save", listener: DidSaveCallback): this;
}

// This is loosely based on https://github.com/Microsoft/vscode-languageserver-node/blob/73180893ca/server/src/main.ts#L124
// With some simplifications and the ability to support multiple listeners
export class TextDocumentEvents<T> extends EventEmitter
  implements ITextDocumentEvents {
  // a single store of documents shared by all workspaces
  private _documents: { [uri: string]: T };
  private _configuration: TextDocumentsConfiguration<T>;

  constructor(
    configuration: TextDocumentsConfiguration<T>,
    events: IDocumentEvents,
  ) {
    super();
    this._documents = Object.create(null);
    this._configuration = configuration;

    events.on("open", (params: DidOpenTextDocumentParams) => {
      const td = params.textDocument;
      const document = this._configuration.create(
        td.uri,
        td.languageId,
        td.version,
        td.text,
      );
      this._documents[params.textDocument.uri] = document;
      this.emit("open", Object.freeze({ document }));
    });

    events.on("change", (params: DidChangeTextDocumentParams) => {
      const td = params.textDocument;
      const changes = params.contentChanges;
      if (changes.length === 0) {
        return;
      }

      let document = this._documents[td.uri];

      const { version } = td;
      if (version === null || version === void 0) {
        throw new Error(
          `Received document change event for ${td.uri} without valid version identifier`,
        );
      }

      document = this._configuration.update(document, changes, version);

      this._documents[td.uri] = document;

      this.emit("change", Object.freeze({ document }));
    });

    events.on("save", (params: DidSaveTextDocumentParams) => {
      const document = this._documents[params.textDocument.uri];
      if (document) {
        this.emit("save", Object.freeze({ document }));
      }
    });

    events.on("close", (params: DidCloseTextDocumentParams) => {
      const document = this._documents[params.textDocument.uri];
      if (document) {
        delete this._documents[params.textDocument.uri];
        this.emit("close", Object.freeze({ document }));
      }
    });
  }

  /**
   * Returns the document for the given URI. Returns undefined if
   * the document is not managed by this instance.
   *
   * @param uri The text document's URI to retrieve.
   * @return the text document or `undefined`.
   */
  public get(uri: string): T | undefined {
    return this._documents[uri];
  }
}
