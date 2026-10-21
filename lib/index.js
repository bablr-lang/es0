import {
  buildPathSegment,
  buildTypePathSegment,
  getRootProperty,
  list,
  Path,
} from '@bablr/agast-helpers/path';
import { printSource } from '@bablr/agast-helpers/tree';
import {
  GapNode,
  NullNode,
  parseTag,
  parseTagType,
  Property,
  traverseChildren,
  TreeNode,
} from 'agast';
import { treeParse } from 'bablr';
import * as Tags from 'agast/node';
import es0 from '@bablr/language-en-es3';
import es0eval from './grammar.js';
import { getProduction } from '@bablr/helpers/grammar';
import { continue_, wait } from '@bablr/stream-iterator';
import { isArray, isString } from '@bablr/agast-helpers/object';

let es0eval_ = new es0eval();

export const parse = (text, matcher) => {
  return treeParse(es0, matcher, text);
};

export function* evaluate(expression) {
  // check for node validity
  let s = {};

  let node = expression;
  let nodeType = parseTagType(node);

  if (nodeType === GapNode) throw new Error();
  if (nodeType === NullNode) return null;
  if (nodeType !== TreeNode) throw new Error();

  let sigilTag = parseTag(node[0]);

  if (sigilTag.value.type === Symbol.for('_')) {
    node = Path.get(buildTypePathSegment('_'), node);
    sigilTag = parseTag(node[0]);
  }

  let iter = getProduction(es0eval_, sigilTag.value.name)(s, node);
  let step;

  let states = [];
  let state = null;
  let returnValue;

  for (;;) {
    for (;;) {
      step = iter.next(returnValue);

      returnValue = undefined;

      while (step === null || step instanceof Promise) {
        if (step === null) yield continue_(), (step = iter.next());
        if (step instanceof Promise) step = yield wait(step);
      }
      if (step.done) break;

      let { verb, arguments: args } = step.value;

      switch (verb) {
        case 'evaluate': {
          let { 0: target } = args;

          let targetName;
          let targetNode;
          if (isString(target)) {
            targetNode = Path.get(target, node);
          } else if (isArray(target)) {
            targetNode = target;
          } else {
            throw new Error();
          }

          let sigilTag = parseTag(targetNode[0]);
          targetName = sigilTag.value.name.description;
          states.push({ node, iter, step, state });
          state = null;
          node = targetNode;
          nodeType = parseTagType(node);
          iter = getProduction(es0eval_, targetName)(s, targetNode);
        }
      }
    }

    returnValue = step.value;

    if (!states.length) break;

    ({ node, iter, step, state } = states.pop());
  }

  return returnValue;
}
