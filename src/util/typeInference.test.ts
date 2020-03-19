import { infer, typeToString, Expression, Type } from "./typeInference";
import * as Path from "path";
import Parser, { SyntaxNode } from "web-tree-sitter";

const initialEnv = {
  true: tnamed("Bool"),
  false: tnamed("Bool"),
  "!": tfunc(tnamed("Bool"), tnamed("Bool")),
  "&&": tfunc(tnamed("Bool"), tnamed("Bool"), tnamed("Bool")),
  "||": tfunc(tnamed("Bool"), tnamed("Bool"), tnamed("Bool")),
  "==": tfunc(tv("A"), tv("A"), tv("Bool")),
  "+": tfunc(tnamed("Int"), tnamed("Int"), tnamed("Int")),
};

let parser: Parser;

beforeAll(async () => {
  await Parser.init();
  const absolute = Path.join(__dirname, "/../../", "tree-sitter-elm.wasm");
  const pathToWasm = Path.relative(process.cwd(), absolute);
  const language = await Parser.Language.load(pathToWasm);
  parser = new Parser();
  return parser.setLanguage(language);
});

describe("test type inference", () => {
  test("simple int", () => {
    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          call("+", int(1), int(2)),
        )[0],
      ),
    ).toEqual("Int");
    /**
     * Should output "Int"
     */
  });

  test("simple int", () => {
    const tree = parser.parse("0");

    const mapped = mapSyntaxNodeToTypeTree(tree.rootNode);

    if (!mapped) return;

    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          mapped,
        )[0],
      ),
    ).toEqual("Int");
    /**
     * Should output "Int"
     */
  });

  test("simple string", () => {
    const tree = parser.parse('"bla"');

    const mapped = mapSyntaxNodeToTypeTree(tree.rootNode);
    if (!mapped) return;

    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          mapped,
        )[0],
      ),
    ).toEqual("Int");
    /**
     * Should output "Int"
     */
  });

  // test("mismatch", () => {
  //   expect(
  //     typeToString(
  //       infer(
  //         {
  //           next: 0,
  //           env: initialEnv,
  //         },
  //         call("+", "true", "false"),
  //       )[0],
  //     ),
  //   ).toThrow();
  //   /**
  //    * should output
  //    * Type mismatch:
  //    *     Expected a Bool
  //    *     Found Int
  //    */
  // });

  // test("mismatch", () => {
  //   expect(
  //     typeToString(
  //       infer(
  //         {
  //           next: 0,
  //           env: initialEnv,
  //         },
  //         eLet(
  //           "id",
  //           func("x", "x"),
  //           call("==", call("id", int(1)), call("id", "true")),
  //         ),
  //       )[0],
  //     ),
  //   ).toContain(["Type mismatch", "Expected Bool", "Found Int"]);
  // });
});

function v(name: string): Expression {
  return {
    nodeType: "Var",
    name,
  };
}

function int(value: number): Expression {
  return {
    nodeType: "Int",
    value,
  };
}

function func(param: string, body: Expression | string): Expression {
  return {
    nodeType: "Function",
    param,
    body: typeof body === "string" ? v(body) : body,
  };
}

function call(
  f: Expression | string,
  ..._args: (Expression | string)[]
): Expression {
  const args = _args.map(a => (typeof a === "string" ? v(a) : a));
  return args.reduce(
    (func, arg) => ({
      nodeType: "Call",
      func: typeof func === "string" ? v(func) : func,
      arg: typeof arg === "string" ? v(arg) : arg,
    }),
    typeof f === "string" ? v(f) : f,
  );
}

function e(expr: Expression | string): Expression {
  if (typeof expr === "string") {
    return v(expr);
  } else {
    return expr;
  }
}

function eIf(
  _cond: Expression | string,
  _trueBranch: Expression | string,
  _falseBranch: Expression | string,
): Expression {
  const cond = e(_cond);
  const trueBranch = e(_trueBranch);
  const falseBranch = e(_falseBranch);
  return {
    nodeType: "If",
    cond,
    trueBranch,
    falseBranch,
  };
}

function eLet(
  name: string,
  _rhs: string | Expression,
  _body: string | Expression,
): Expression {
  const rhs = e(_rhs);
  const body = e(_body);
  return {
    nodeType: "Let",
    name,
    rhs,
    body,
  };
}

function tnamed(name: string): Type {
  return {
    nodeType: "Named",
    name,
  };
}
function tv(name: string): Type {
  return {
    nodeType: "Var",
    name,
  };
}
function tfunc(...types: Type[]): Type {
  return types.reduceRight((to, from) => ({
    nodeType: "Function",
    from,
    to,
  }));
}

function mapSyntaxNodeToTypeTree(
  node: SyntaxNode | null,
): Expression | undefined {
  if (!node) return;

  switch (node.type) {
    case "number_constant_expr":
      return int((node.text as unknown) as number);

    case "string_constant_expr":
      return v("String");

    default:
      return mapSyntaxNodeToTypeTree(node.firstNamedChild);
  }
}
