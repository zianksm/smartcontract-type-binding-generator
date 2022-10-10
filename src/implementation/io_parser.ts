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
  functionLiteral,
  _function,
} from "./type-mapping";
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
  FAT_ARROW,
  EMPTY_STRING,
  PROMISE,
  OPEN_ANGLE_BRACKET,
  CLOSE_ANGLE_BRACKET,
  OPEN_BRACKET,
  CLOSE_BRACKET,
} from "./token";
import AbiGrouper from "./grouper";

const UNNAMED_VAR = "argv";
export default class IoParser extends AbiGrouper {
  private unnamedCounter: number = 0;

  private incrementCounter() {
    this.unnamedCounter++;
  }
  private resetCounter() {
    this.unnamedCounter = 0;
  }
  private getVarCounter(): string {
    return UNNAMED_VAR.concat(this.unnamedCounter.toString());
  }
  private buildInputLiteral(input: iochild): string {
    const inputType = this.determineType(input.type);
    const inputName =
      input.name.length === 0 ? this.getVarCounter() : input.name;
    this.incrementCounter();
    const inputLiteral = inputName.concat(COLON, SPACE, inputType);

    return inputLiteral;
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
    const outputType = this.determineType(input.type);

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

  protected parse(abi: ABI) {
    const fnGroup = this.group(abi);

    for (const fn of fnGroup) {
      // it is IMPORTANT that we parse signature literal AFTER parsing input and output literals.
      // because we need input and output literals to complete function signature literals.

      fn.attributes.inputs.literals = this.writeInput(fn.attributes.inputs.obj);
      fn.attributes.outputs.literals = this.writeOutput(
        fn.attributes.outputs.obj
      );
      fn.signatureLiteral = this.parseFnSignature(fn);
    }

    return fnGroup;
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
    let params = this.getAsyncOutput();
    let literal = this.parseOutput(value);
    for (const i in value) {
      if (i == lastIndex.toString()) {
        params = params.concat(literal[i]);
        break;
      }
      params = params.concat(literal[i].concat(COMMA, SPACE));
    }

    return params.concat(CLOSE_BRACKET, CLOSE_ANGLE_BRACKET, SPACE);
  }

  private getAsyncOutput() {
    return PROMISE.concat(OPEN_ANGLE_BRACKET, OPEN_BRACKET);
  }

  private parseFnSignature(fnObj: functionLiteral) {
    const signature = EXPORT.concat(
      SPACE,
      ASYNC,
      SPACE,
      _function,
      SPACE,
      fnObj.name,
      fnObj.attributes.inputs.literals as any,
      this.determineOutput(fnObj),
      // function implementation will starts here
      SPACE,
      // TODO : populate function body with ethers js
      // just put open and close brace for now
      OPEN_BRACE,
      // this space will become function implementation later
      CLOSE_BRACE,
      NEWLINE
    );

    return signature;
  }

  private determineOutput(fnObj: functionLiteral) {
    const _eval = fnObj.attributes.outputs.obj.length;

    if (_eval === 0 || _eval === undefined || _eval === null)
      // make this Promise<T>
      return COLON.concat(SPACE, fallbackMapping);
    else return COLON.concat(SPACE, fnObj.attributes.outputs.literals as any);
  }

  private determineType(value: string): string {
    if (value.includes(int) || value.includes(uint)) return intMapping;
    else if (value === address) return addressMapping;
    else if (value === string) return stringMapping;
    else if (value === bool) return boolMapping;
    else return fallbackMapping;
  }
}
