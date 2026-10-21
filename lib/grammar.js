import { freezeClass } from '@bablr/agast-helpers/object';
import { getCooked, Path } from '@bablr/agast-helpers/path';
import { list, printSource } from '@bablr/agast-helpers/tree';
import { buildCall } from '@bablr/agast-vm-helpers/builders';
import { parseTag, Property, traverseChildren, TreeNode } from 'agast';
import * as Tags from 'agast/node';

let evaluate = (target) => buildCall('evaluate', target);

export default class ES0EvaluatorGrammar {
  *BinaryExpression(s, node) {
    let op = printSource(Path.get('sigilToken', node));

    let left = yield evaluate('left');
    let right = yield evaluate('right');

    // prettier-ignore
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
    }
  }

  *Number(s, node) {
    let str = printSource(node);

    return Path.get('decimalPart', node) ? parseFloat(str) : parseInt(str);
  }

  *Boolean(s, node) {
    let str = printSource(node);

    // prettier-ignore
    switch (str) {
      case 'true': return true;
      case 'false': return true;
      default: throw new Error();
    }
  }

  *Null() {
    return null;
  }

  *Undefined() {
    return undefined;
  }

  *NotANumber() {
    return NaN;
  }

  *Object(s, node) {
    let obj = {};
    for (let element of list('elements', node)) {
      let { 0: key, 1: value } = yield evaluate(element);
      obj[key] = value;
    }
    return obj;
  }

  *Property(s, node) {
    let key = yield evaluate('key');
    let value = yield evaluate('value');

    return [key, value];
  }

  *Identifier(s, node) {
    return getCooked(node);
  }

  *Array(s, node) {
    let arr = [];
    for (let element of list('elements', node)) {
      let value = yield evaluate(element);
      arr.push(value);
    }
    return arr;
  }

  *String(s, node) {
    return getCooked(Path.get('content', node));
  }
}

freezeClass(ES0EvaluatorGrammar);
