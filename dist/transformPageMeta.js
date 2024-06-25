"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = transformPageMeta;

var wxmlParser = _interopRequireWildcard(require("./utils/wxmlParser"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/**
 * 转换 wxml 的 <page-meta> 设置
 * @param {string} source
 * @param {string} filename
 */
async function transformPageMeta(source, filename) {
  const ast = wxmlParser.parse(filename, source);
  let rootPath;
  let pageMeta;
  wxmlParser.walk(ast, {
    begin(path) {
      if (!rootPath) rootPath = path;
      if (path.node.type !== "element" || path.node.tag !== "page-meta") return;
      pageMeta = path.node;
    }

  });

  if (!pageMeta) {
    // 顶部插入一个 <page-meta>
    pageMeta = {
      type: "element",
      tag: "page-meta",
      attrs: [],
      children: []
    };
    rootPath.insertBefore(pageMeta);
    rootPath.insertBefore({
      type: "text",
      text: "\n"
    }); // 插入换行
  }

  let hasRootFontSize = false;
  pageMeta.attrs.forEach(attr => {
    if (attr.name === "root-font-size") {
      hasRootFontSize = true;

      if (attr.value !== "system") {
        console.warn(`cannot change <page-meta root-font-size="system"> in ${filename}`);
      } else {
        attr.value = "system";
      }
    }
  }); // 给 <page-meta> 添加一个 root-font-size

  if (!hasRootFontSize) {
    pageMeta.attrs.push({
      name: "root-font-size",
      value: "system"
    });
  }

  const {
    code
  } = wxmlParser.codegen(ast);
  return code;
}