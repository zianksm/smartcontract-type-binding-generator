import { TypeInferer } from "./../type-inferer";
import {
  iochild,
  int,
  uint,
  intMapping,
  address,
  addressMapping,
  string,
  stringMapping,
  bool,
  boolMapping,
  fallbackMapping,
  ABI,
  Branch,
  _function,
  arrayExt,
  Tree,
} from "../type-mapping";
import {
  COLON,
  SPACE,
  OPEN_PAR,
  COMMA,
  CLOSE_PAR,
  OPEN_BRACE,
  CLOSE_BRACE,
  EXPORT,
  ASYNC,
  NEWLINE,
  EMPTY_STRING,
  PROMISE,
  OPEN_ANGLE_BRACKET,
  CLOSE_ANGLE_BRACKET,
  OPEN_BRACKET,
  CLOSE_BRACKET,
  FORMAT_LINE,
  PUBLIC_IDENT,
} from "../token";
import { TreeBuilder } from "../tree-builder";
import { TypescriptBodyParser } from "./body-parser";

const UNNAMED_VAR = "argv";
const SINGLE_ELEMENT = 1;
export class TypescriptMethodAssembler {
  private unnamedCounter: number = 0;

  private incrementCounter() {
    this.unnamedCounter++;
  }
  private resetCounter() {
    this.unnamedCounter = 0;
  }
  private getVarCounter(): string {
    this.incrementCounter();
    return UNNAMED_VAR.concat(this.unnamedCounter.toString());
  }
  private buildInputLiteral(input: iochild): string {
    const inputType = TypeInferer.infer(input.type, false);
    const inputName = this.determineInputName(input).name;
    const inputLiteral = inputName.concat(COLON, SPACE, inputType);

    return inputLiteral;
  }

  // we intentionally modify this to generate arguments name for the function body
  private determineInputName(input: iochild) {
    input.name = input.name.length === 0 ? this.getVarCounter() : input.name;
    return input;
  }

  private parseInput(value: iochild[]) {
    let literal: string[] = [];
    for (const input of value) {
      const inputLiteral = this.buildInputLiteral(input);
      literal.push(inputLiteral);
    }
    this.resetCounter();

    return literal;
  }

  // TODO : make return type in Promise<T>
  private buildOutputLiteral(input: iochild) {
    const outputType = TypeInferer.infer(input.type, true);

    return outputType;
  }
  private parseOutput(value: iochild[]) {
    let literal: string[] = [];
    for (const output of value) {
      const outputLiteral = this.buildOutputLiteral(output);
      literal.push(outputLiteral);
    }

    return literal;
  }
  private getStartingParam() {
    return SPACE.concat(OPEN_PAR);
  }

  public build(Tree: Tree) {
    for (const fn of Tree) {
      // it is IMPORTANT that we parse signature literal AFTER parsing input and output literals.
      // because we need input and output literals to complete function signature literals.

      fn.attributes.inputs.literals = this.writeInput(fn.attributes.inputs.obj);
      fn.attributes.outputs.literals = this.writeOutput(
        fn.attributes.outputs.obj
      );
      fn.bodyLiteral = TypescriptBodyParser.parse(fn);
      fn.signatureLiteral = this.parseFnSignature(fn);
    }

    return Tree;
  }

  private writeInput(value: iochild[]) {
    if (value.length === 0) return OPEN_PAR.concat(CLOSE_PAR);
    const lastIndex = value.length - 1;
    let params = this.getStartingParam();
    let literal = this.parseInput(value);
    for (const i in value) {
      if (i == lastIndex.toString()) {
        params = params.concat(literal[i]);
        break;
      }
      params = params.concat(literal[i].concat(COMMA, SPACE));
    }

    return params.concat(CLOSE_PAR, SPACE);
  }

  private writeOutput(value: iochild[]) {
    if (value.length === 0) return EMPTY_STRING;
    const lastIndex = value.length - 1;
    let params = this.getAsyncOutput(value.length);
    let literal = this.parseOutput(value);
    for (const i in value) {
      if (i == lastIndex.toString()) {
        params = params.concat(literal[i]);
        break;
      }
      params = params.concat(literal[i].concat(COMMA, SPACE));
    }

    if (value.length === SINGLE_ELEMENT) {
      return params.concat(CLOSE_ANGLE_BRACKET, SPACE);
    } else {
      return params.concat(CLOSE_BRACKET, CLOSE_ANGLE_BRACKET, SPACE);
    }
  }

  private getAsyncOutput(length: number) {
    if (length === SINGLE_ELEMENT) return PROMISE.concat(OPEN_ANGLE_BRACKET);
    else return PROMISE.concat(OPEN_ANGLE_BRACKET, OPEN_BRACKET);
  }

  private parseFnSignature(fnObj: Branch) {
    const signature = FORMAT_LINE.concat(
      PUBLIC_IDENT,
      SPACE,
      ASYNC,
      SPACE,
      fnObj.name,
      fnObj.attributes.inputs.literals as string,
      this.determineOutput(fnObj),
      // function implementation will starts here
      SPACE,
      OPEN_BRACE,
      fnObj.bodyLiteral as string,
      NEWLINE,
      FORMAT_LINE,
      CLOSE_BRACE,
      NEWLINE,
      NEWLINE
    );

    return signature;
  }

  private determineOutput(fnObj: Branch) {
    const _eval = fnObj.attributes.outputs.obj.length;
    const constant = fnObj.constant;

    if (_eval === 0 || _eval === undefined || _eval === null || !constant)
      return COLON.concat(
        SPACE,
        PROMISE,
        OPEN_ANGLE_BRACKET,
        fallbackMapping,
        CLOSE_ANGLE_BRACKET
      );
    else return COLON.concat(SPACE, fnObj.attributes.outputs.literals as any);
  }
}
