import { freezeClass, getPrototypeOf } from '@bablr/agast-helpers/object';
import { get, getCooked } from '@bablr/agast-helpers/path';
import { list, printSource } from '@bablr/agast-helpers/tree';
import { buildCall } from '@bablr/agast-vm-helpers/builders';
import { parseTag, Property, traverseChildren, TreeNode } from 'agast';
import * as Tags from 'agast/node';

let evaluate = (target) => buildCall('evaluate', target);

let setScoped = (key, value, obj) => {
  let protoObj = obj;

  while (protoObj) {
    if (key in protoObj) {
      protoObj[key] = value;
      return value;
    } else {
      protoObj = getPrototypeOf(obj);
    }
  }

  throw new Error();
};

export default class ES0EvaluatorGrammar {
  *Program(s, node) {
    s.scope = Object.create(null);
    s.abrupt = null;
    s.labels = [];

    for (let statement of list('statements', node)) {
      yield evaluate(statement);
    }
  }

  *Block(s, node) {
    s.scope = Object.create(s.scope);

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

  *IfStatement(s, node) {
    let alternate;
    if (yield evaluate('test')) {
      yield evaluate('consequent');
    } else if ((alternate = get('alternate', node))) {
      yield evaluate(alternate);
    }
  }

  *WhileStatement(s, node) {
    while (!(s.abrupt && (s.abrupt.break || s.abrupt.levels > 1)) && (yield evaluate('test'))) {
      s.abrupt = null;
      yield evaluate('body');
    }

    if (--s.abrupt.levels === 0) {
      s.abrupt = null;
    }
  }

  *DoStatement(s, node) {
    do {
      s.abrupt = null;
      yield evaluate('body');
    } while (!(s.abrupt && (s.abrupt.break || s.abrupt.levels > 1)) && (yield evaluate('test')));

    if (--s.abrupt.levels === 0) {
      s.abrupt = null;
    }
  }

  *LabelledStatement(s, node) {
    s.labels.push(getCooked(get('label', node)));
    yield evaluate('body');
    s.labels.pop();
  }

  *Break(s, node) {
    let label = getCooked(get('label', node));
    let levels = label ? 1 : s.labels.indexOf(label);
    if (levels === -1) throw new Error();
    s.abrupt = { break: true, levels, expr: null };
  }

  *Continue(s, node) {
    let label = getCooked(get('label', node));
    let levels = label ? 1 : s.labels.indexOf(label);
    if (levels === -1) throw new Error();
    s.abrupt = { break: false, levels, expr: null };
  }

  *Return(s, node) {
    let expr = evaluate('expression');

    s.abrupt = { break: false, levels: this.Infinity, expr };
  }

  *Throw(s, node) {
    let expr = evaluate('expression');

    s.abrupt = { break: true, levels: this.Infinity, expr };
  }

  *AssignmentExpression(s, node) {
    let lValue = s.scope;
    let left = get('left', node);
    let sigilTag = parseTag(left[0]);
    let lName;
    let assignMember = sigilTag.value.name === Symbol.for('MemberExpression');

    if (assignMember) {
      lValue = yield evaluate(get('object', left));

      lName = getCooked(get('property', left));
    } else {
      lName = getCooked(left);
    }

    let value = yield evaluate('right');

    if (assignMember) {
      lValue[lName] = value;
    } else {
      setScoped(lName, value, lValue);
    }

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

    let l = yield evaluate('left');
    let r = yield evaluate('right');

    // prettier-ignore
    switch (op) {
      case '||': return l || r;
      case '&&': return l && r;
      case '|': return l | r;
      case '^': return l ^ r;
      case '&': return l & r;
      case '===': return l === r;
      case '==': return l == r;
      case '!==': return l !== r;
      case '!=': return l != r;
      case '<=': return l <= r;
      case '<': return l < r;
      case '>=': return l >= r;
      case '>': return l > r;
      case 'instanceof': return l instanceof r;
      case 'in': return l in r;
      case '>>>': return l >>> r;
      case '<<': return l << r;
      case '>>': return l >> r;
      case '+': return l + r;
      case '-': return l - r;
      case '%': return l % r;
      case '*': return l * r;
      case '/': return l / r;
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
