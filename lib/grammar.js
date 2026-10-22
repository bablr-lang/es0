import { freezeClass } from '@bablr/agast-helpers/object';
import { get, getCooked } from '@bablr/agast-helpers/path';
import { list, printSource } from '@bablr/agast-helpers/tree';
import { buildCall } from '@bablr/agast-vm-helpers/builders';
import { parseTag, Property, traverseChildren, TreeNode } from 'agast';
import * as Tags from 'agast/node';

let evaluate = (target) => buildCall('evaluate', target);

export default class ES0EvaluatorGrammar {
  *Program(s, node) {
    s.scope = Object.create(null);

    for (let statement of list('statements', node)) {
      yield evaluate(statement);
    }
  }

  *VariableDeclaration(s, node) {
    for (let declarator of list('declarations', node)) {
      let left = getCooked(get('left', declarator));
      let rightNode = get('right', declarator);
      let value = rightNode ? yield evaluate(rightNode) : undefined;
      s.scope[left] = value;
    }
  }

  *ExpressionStatement(s, node) {
    yield evaluate('expression');
  }

  *AssignmentExpression(s, node) {
    let lValue = s.scope;
    let left = get('left', node);
    let sigilTag = parseTag(left[0]);
    let lName;

    if (sigilTag.value.name === Symbol.for('MemberExpression')) {
      lValue = yield evaluate(get('object', left));

      lName = getCooked(get('property', left));
    } else {
      lName = getCooked(left);
    }

    let value = yield evaluate('right');

    lValue[lName] = value;

    return value;
  }

  *MemberExpression(s, node) {
    let object = yield evaluate('object');
    let computed = !!get('openToken', node);
    let property = computed ? yield evaluate('property') : getCooked(get('property', node));

    return object[property];
  }

  *BinaryExpression(s, node) {
    let op = printSource(get('sigilToken', node));

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

  *UnaryExpression(s, node) {
    let isPrefix = parseTag(node[0]).value.attributes.position === 'prefix';
    let op = printSource(get('sigilToken', node));

    let value = yield evaluate('value');

    if (isPrefix) {
      // prettier-ignore
      switch (op) {
        case '+': return +value;
        case '-': return -value;
      }
    } else {
      throw new Error('not implemented');
    }
  }

  *TernaryExpression(s, node) {
    return yield evaluate('test') ? yield evaluate('consequent') : yield evaluate('alternate');
  }

  *Number(s, node) {
    let str = printSource(node);

    return get('decimalPart', node) ? parseFloat(str) : parseInt(str);
  }

  *DecimalInteger(s, node) {
    let str = printSource(node);

    return parseInt(str, 10);
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

  *Infinity() {
    return Infinity;
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
    let key = getCooked(get('key', node));
    let value = yield evaluate('value');

    return [key, value];
  }

  *Identifier(s, node) {
    let name = getCooked(node);

    if (!name in s.scope) throw new Error();

    return s.scope[name];
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
    return getCooked(get('content', node));
  }
}

freezeClass(ES0EvaluatorGrammar);
