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
import { JavascriptBodyParser } from "./body-parser";
import { DocGen } from "./js-doc-generator";

const UNNAMED_VAR = "argv";
const SINGLE_ELEMENT = 1;
export class JavascriptMethodAssembler {
  private docGen: DocGen;

  constructor() {
    this.docGen = new DocGen();
  }
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

  // we intentionally modify this to generate arguments name for the function body
  private determineInputName(input: iochild) {
    input.name = input.name.length === 0 ? this.getVarCounter() : input.name;
    return input;
  }

  private buildOutputLiteral(input: iochild) {
    const outputType = this.determineType(input.type);
    input.inferredTypes = outputType;

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
    return " (";
  }

  public build(Tree: Tree) {
    for (const fn of Tree) {
      // it is IMPORTANT that we parse signature literal AFTER parsing input and output literals.
      // because we need input and output literals to complete function signature literals.

      fn.attributes.inputs.literals = this.writeInput(fn.attributes.inputs.obj);
      fn.attributes.outputs.literals = this.writeOutput(
        fn.attributes.outputs.obj
      );
      fn.bodyLiteral = JavascriptBodyParser.parse(fn);
      fn.jsDoc = this.docGen.generateJsDoc(fn);
      fn.signatureLiteral = this.parseFnSignature(fn);
    }

    return Tree;
  }

  private writeInput(value: iochild[]) {
    if (value.length === 0) return "()";
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

  private parseInput(value: iochild[]) {
    let literal: string[] = [];
    for (const input of value) {
      const inputLiteral = this.buildInputLiteral(input);
      literal.push(inputLiteral);
    }
    this.resetCounter();

    return literal;
  }

  private buildInputLiteral(input: iochild): string {
    const inputType = this.determineType(input.type);
    const inputName = this.determineInputName(input).name;

    input.inferredTypes = inputType;
    const inputLiteral = inputName.concat(COLON, SPACE, inputType);

    return inputLiteral;
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
    fnObj.jsDoc = this.docGen.generateJsDoc(fnObj);
    const signature = FORMAT_LINE.concat(
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

  private determineType(value: string): string {
    return value.includes(arrayExt)
      ? this.inferTypes(value).concat(arrayExt)
      : this.inferTypes(value);
  }

  private inferTypes(value: string) {
    if (value.includes(int) || value.includes(uint)) return intMapping;
    else if (value === address) return addressMapping;
    else if (value === string) return stringMapping;
    else if (value === bool) return boolMapping;
    else return fallbackMapping;
  }
}
