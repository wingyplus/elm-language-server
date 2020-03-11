import { infer, typeToString, Expression, Type } from "./typeInference";

const initialEnv = {
  true: tn("Bool"),
  false: tn("Bool"),
  "!": tfunc(tn("Bool"), tn("Bool")),
  "&&": tfunc(tn("Bool"), tn("Bool"), tn("Bool")),
  "||": tfunc(tn("Bool"), tn("Bool"), tn("Bool")),
  "==": tfunc(tv("A"), tv("A"), tv("Bool")),
  "+": tfunc(tn("Int"), tn("Int"), tn("Int")),
};

describe("test type inference", () => {
  test("simple int", () => {
    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          c("+", i(1), i(2)),
        )[0],
      ),
    ).toEqual("Int");
    /**
     * Should output "Int"
     */
  });

  test("mismatch", () => {
    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          c("+", "true", "false"),
        )[0],
      ),
    ).toThrow();
    /**
     * should output
     * Type mismatch:
     *     Expected a Bool
     *     Found Int
     */
  });

  test("mismatch", () => {
    expect(
      typeToString(
        infer(
          {
            next: 0,
            env: initialEnv,
          },
          eLet("id", f("x", "x"), c("==", c("id", i(1)), c("id", "true"))),
        )[0],
      ),
    ).toContain(["Type mismatch", "Expected Bool", "Found Int"]);
  });
});

function v(name: string): Expression {
  return {
    nodeType: "Var",
    name,
  };
}

function i(value: number): Expression {
  return {
    nodeType: "Int",
    value,
  };
}

function f(param: string, body: Expression | string): Expression {
  return {
    nodeType: "Function",
    param,
    body: typeof body === "string" ? v(body) : body,
  };
}

function c(
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
  const rhs = e(_rhs),
    body = e(_body);
  return {
    nodeType: "Let",
    name,
    rhs,
    body,
  };
}

function tn(name: string): Type {
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
