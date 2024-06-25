"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tokenize = tokenize;
exports.parse = parse;
exports.walk = walk;
exports.codegen = codegen;

var _sourceMap = require("source-map");

// 正则声明
const startTagReg = /^<([-A-Za-z0-9_]+)((?:\s+[-A-Za-z0-9_:@.#]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/i;
const endTagReg = /^<\/([-A-Za-z0-9_]+)[^>]*>/i;
const attrReg = /^([-A-Za-z0-9_:@.#]+)(?:(\s*=\s*)(?:(?:(")((?:\\.|[^"])*)")|(?:(')((?:\\.|[^'])*)')|([^>\s]+)))?/i;
const commentReg = /^<!--([\s\S]*?)-->/;
const spaceReg = /^\s*/;
const textReg = /^[^<]+/; // 空元素

const voidSet = new Set([]); // 可能包含任意内容的元素

const rawTextSet = new Set(["wxs"]);

function getPositionMapper(fileName, content) {
  const lines = []; // lins[i] 代表 i 位置对应行号

  const columns = []; // column[i] 代表 i 位置对应行的起始列号

  let col = 0;
  let lin = 1;
  const l = content.length;

  for (let i = 0; i < l; ++i) {
    lines[i] = lin;
    columns[i] = col;

    if (content[i] === "\n") {
      lin += 1;
      col = i + 1;
    }
  }

  return (start, length) => {
    return {
      line: lines[start],
      column: start - columns[start],
      file: fileName,
      source: content.substr(start, length)
    };
  };
}

const DIRTY = Symbol("dirty");

function isDirtySourceNode(chunks) {
  return Array.isArray(chunks) ? chunks.some(chunk => isDirtySourceNode(chunk)) : chunks[DIRTY];
}

function posToSourceNode(pos, chunks = []) {
  var _pos$line, _pos$column, _pos$file;

  if (!Array.isArray(chunks)) chunks = [chunks];
  const dirty = !(pos !== null && pos !== void 0 && pos.source) || isDirtySourceNode(chunks);
  const node = new _sourceMap.SourceNode((_pos$line = pos === null || pos === void 0 ? void 0 : pos.line) !== null && _pos$line !== void 0 ? _pos$line : null, (_pos$column = pos === null || pos === void 0 ? void 0 : pos.column) !== null && _pos$column !== void 0 ? _pos$column : null, (_pos$file = pos === null || pos === void 0 ? void 0 : pos.file) !== null && _pos$file !== void 0 ? _pos$file : null, dirty ? chunks : pos.source);
  node[DIRTY] = dirty;
  return node;
}

class Stack extends Array {
  constructor(arr = []) {
    super(...arr);
  }

  top() {
    return this[this.length - 1];
  }

}

function tokenizeComment(content, start, tokens, positionMapper) {
  const match = content.match(commentReg);
  if (!match) return;
  const all = match[0];
  const text = match[1];
  tokens.push({
    type: "comment",
    content: {
      val: text,
      pos: positionMapper(start + 4, text.length)
    },
    pos: positionMapper(start, all.length)
  });
  return all.length;
}

function tokenizeRawText(tagName, content, start, tokens, positionMapper) {
  const match = content.match(new RegExp(`^(?:[^<]+|(?:<(?!/${tagName}[^>]*>)))+`));
  if (!match) return;
  const text = match[0];
  tokens.push({
    type: "text",
    raw: true,
    text,
    pos: positionMapper(start, text.length)
  });
  return text.length;
}

function tokenizeRawTextEndTag(tagName, content, start, tokens, positionMapper) {
  const match = content.match(new RegExp(`^</${tagName}[^>]*>`));
  if (!match) return;
  const all = match[0];
  tokens.push({
    type: "endTag",
    tag: {
      val: tagName,
      pos: positionMapper(start + 2, tagName.length)
    },
    pos: positionMapper(start, all.length)
  });
  return all.length;
}

function tokenizeEndTag(content, start, tokens, positionMapper) {
  const match = content.match(endTagReg);
  if (!match) return;
  const all = match[0];
  const tagName = match[1];
  tokens.push({
    type: "endTag",
    tag: {
      val: tagName,
      pos: positionMapper(start + 2, tagName.length)
    },
    pos: positionMapper(start, all.length)
  });
  return all.length;
}

function tokenizeStartTag(content, start, tokens, positionMapper) {
  const match = content.match(startTagReg);
  if (!match) return;
  const all = match[0];
  const tagName = match[1];
  const attrString = match[2];
  const unary = voidSet.has(tagName) || !!match[3];
  const attrs = tokenizeAttrs(attrString, start + 1 + tagName.length, positionMapper);
  tokens.push({
    type: "startTag",
    tag: {
      val: tagName,
      pos: positionMapper(start + 1, tagName.length)
    },
    attrs,
    unary,
    pos: positionMapper(start, all.length)
  });
  return all.length;
}

function tokenizeText(content, start, tokens, positionMapper) {
  const match = content.match(textReg);
  if (!match) return;
  const text = match[0];
  tokens.push({
    type: "text",
    raw: false,
    text,
    pos: positionMapper(start, text.length)
  });
  return text.length;
}

function tokenizeAttr(content, start, tokens, positionMapper) {
  var _ref, _match$;

  const match = content.match(attrReg);
  if (!match) return;
  const all = match[0];
  const nameStr = match[1];
  const equal = match[2];
  const quote = match[3] || match[5] || "";
  const valueStr = (_ref = (_match$ = match[4]) !== null && _match$ !== void 0 ? _match$ : match[6]) !== null && _ref !== void 0 ? _ref : match[7];
  const name = {
    val: nameStr,
    pos: positionMapper(start, nameStr.length)
  };
  let value;

  if (typeof valueStr === "string") {
    const valueStart = start + nameStr.length + equal.length + quote.length;
    value = {
      val: valueStr,
      pos: positionMapper(valueStart, valueStr.length)
    };
  }

  tokens.push({
    type: "attribute",
    name,
    value,
    pos: positionMapper(start, all.length)
  });
  return all.length;
}

function tokenizeSpace(content, start, tokens, positionMapper) {
  const match = content.match(spaceReg);
  if (!match) return;
  return match[0].length;
}

function tokenizeAttrs(content, start, positionMapper) {
  const tokens = [];

  while (content.length) {
    const offset = tokenizeAttr(content, start, tokens, positionMapper) || tokenizeSpace(content, start, tokens, positionMapper);

    if (!offset) {
      throw new Error("unexpected token " + content);
    }

    start += offset;
    content = content.substring(offset);
  }

  return tokens;
}
/**
 * 分词，将 wxml 切分为 Token
 */


function tokenize(fileName, content) {
  const tokens = [];
  let start = 0;
  const positionMapper = getPositionMapper(fileName, content);

  while (content.length) {
    const lastToken = tokens[tokens.length - 1];
    let offset;

    if (lastToken && lastToken.type === "startTag" && rawTextSet.has(lastToken.tag.val) && !lastToken.unary) {
      // 如果是包含任意元素的 tag，则只解析 text 和自己的 end tag
      offset = tokenizeRawText(lastToken.tag.val, content, start, tokens, positionMapper) || tokenizeRawTextEndTag(lastToken.tag.val, content, start, tokens, positionMapper);
    } else {
      offset = tokenizeComment(content, start, tokens, positionMapper) || tokenizeEndTag(content, start, tokens, positionMapper) || tokenizeStartTag(content, start, tokens, positionMapper) || tokenizeText(content, start, tokens, positionMapper);
    }

    if (!offset) {
      throw new Error("unexpected token " + content);
    }

    start += offset;
    content = content.substring(offset);
  }

  return tokens;
}

/**
 * 语法解析，将 wxml 分词后解析为 Wxml 节点树
 */
function parse(fileName, wxml) {
  const root = {
    type: "root",
    children: []
  };
  const stack = new Stack([root]);
  const tokens = tokenize(fileName, wxml);

  for (const token of tokens) {
    switch (token.type) {
      case "startTag":
        {
          const elem = {
            type: "element",
            tag: token.tag.val,
            attrs: token.attrs.map(token => {
              var _token$value;

              return {
                name: token.name.val,
                value: (_token$value = token.value) === null || _token$value === void 0 ? void 0 : _token$value.val,
                token
              };
            }),
            startTagToken: token,
            children: []
          };
          stack.top().children.push(elem);
          if (!token.unary) stack.push(elem);
          break;
        }

      case "endTag":
        {
          let top = stack.top(); // 关闭一个 tag 时，找到最近一个对应的 start tag

          while ((top = stack.top()) && top.type === "element" && top.tag !== token.tag.val) {
            stack.pop();
          }

          if (top.type !== "element") {
            // 没有找到对应的 start tag
            throw new Error("unexpected end tag " + token.tag.val);
          }

          top.endTagToken = token;
          stack.pop();
          break;
        }

      case "comment":
        {
          stack.top().children.push({
            type: "comment",
            content: token.content.val,
            token
          });
          break;
        }

      case "text":
        {
          const text = token.text;
          if (!text) break; // if (stack.top().type === 'root') {
          //   // 不能在根节点有 text
          //   throw new Error('unexpected text ' + token.text)
          // }

          stack.top().children.push({
            type: "text",
            raw: token.raw,
            text: token.text,
            token
          });
          break;
        }
    }
  }

  return root.children;
}

function getPath(parent, index, node) {
  return {
    node,

    replace(node) {
      parent[index] = node;
    },

    insertBefore(node) {
      parent.splice(index, 0, node);
      index += 1;
    },

    insertAfter(node) {
      if (index < parent.length - 1) {
        parent.splice(index + 1, 0, node);
      } else {
        parent.push(node);
      }
    }

  };
}
/**
 * 遍历
 */


function walk(ast, handler) {
  Array.from(ast).forEach((node, index) => {
    const path = getPath(ast, index, node);
    handler.begin && handler.begin(path);
    if (node.type === "element") walk(node.children, handler);
    handler.end && handler.end(path);
  });
}
/**
 * 代码生成
 */


function codegen(ast, options = {}) {
  const {
    sourceMap,
    prevMap,
    minimize
  } = {
    sourceMap: false,
    minimize: false,
    ...options
  };
  const rootNode = new _sourceMap.SourceNode();

  const _codegen = (elem, sourceNode) => {
    switch (elem.type) {
      case "text":
        {
          if (!minimize || elem.raw) {
            var _elem$token, _elem$token2;

            // 空字符串不生成 sourceMap
            sourceNode.add(posToSourceNode((_elem$token = elem.token) !== null && _elem$token !== void 0 && _elem$token.pos && elem.text.trim() ? (_elem$token2 = elem.token) === null || _elem$token2 === void 0 ? void 0 : _elem$token2.pos : undefined, elem.text));
          } else {
            var _elem$token3;

            const trimText = elem.text.trim();
            if (trimText) sourceNode.add(posToSourceNode((_elem$token3 = elem.token) === null || _elem$token3 === void 0 ? void 0 : _elem$token3.pos, trimText));
          }

          break;
        }

      case "comment":
        {
          if (!minimize) sourceNode.add( // comment 不生成 sourceMap
          posToSourceNode(undefined, ["<!--", elem.content, "-->"]));
          break;
        }

      case "element":
        {
          var _elem$startTagToken, _elem$startTagToken2, _elem$endTagToken, _elem$endTagToken2;

          // startTag
          sourceNode.add(posToSourceNode((_elem$startTagToken = elem.startTagToken) === null || _elem$startTagToken === void 0 ? void 0 : _elem$startTagToken.pos, ["<", posToSourceNode((_elem$startTagToken2 = elem.startTagToken) === null || _elem$startTagToken2 === void 0 ? void 0 : _elem$startTagToken2.tag.pos, elem.tag), ...elem.attrs.map(attr => {
            var _attr$token, _attr$token2, _attr$token3, _attr$token3$value;

            return [" ", posToSourceNode((_attr$token = attr.token) === null || _attr$token === void 0 ? void 0 : _attr$token.pos, [posToSourceNode((_attr$token2 = attr.token) === null || _attr$token2 === void 0 ? void 0 : _attr$token2.name.pos, attr.name), ...(attr.value === undefined ? [] : ['="', posToSourceNode((_attr$token3 = attr.token) === null || _attr$token3 === void 0 ? void 0 : (_attr$token3$value = _attr$token3.value) === null || _attr$token3$value === void 0 ? void 0 : _attr$token3$value.pos, attr.value), '"'])])];
          }), elem.endTagToken ? ">" : "/>"])); // content

          if (elem.children.length) {
            elem.children.forEach(child => _codegen(child, sourceNode));
          } // endTag


          if (elem.endTagToken) sourceNode.add(posToSourceNode((_elem$endTagToken = elem.endTagToken) === null || _elem$endTagToken === void 0 ? void 0 : _elem$endTagToken.pos, ["</", posToSourceNode((_elem$endTagToken2 = elem.endTagToken) === null || _elem$endTagToken2 === void 0 ? void 0 : _elem$endTagToken2.tag.pos, elem.tag), ">"]));
          break;
        }
    }
  };

  ast.forEach(elem => _codegen(elem, rootNode));
  let code, map;

  if (sourceMap) {
    const result = rootNode.toStringWithSourceMap();
    code = result.code;
    map = result.map;
  } else {
    code = rootNode.toString();
    map = undefined;
  }

  if (map && prevMap) {
    const prevConsumer = new _sourceMap.SourceMapConsumer(prevMap);
    map.applySourceMap(prevConsumer);
  }

  return {
    code,
    map
  };
}