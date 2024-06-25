"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = extractImageClass;

var wxmlParser = _interopRequireWildcard(require("./utils/wxmlParser"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/**
 * 提取 wxml 中图片对应的 wxss className
 * @param {string} source
 * @param {string} filename
 * @returns {Promise<string[]>}
 */
async function extractImageClass(source, filename) {
  const wxmlAst = wxmlParser.parse(filename, source);
  const imageClasses = [];
  wxmlParser.walk(wxmlAst, {
    begin(path) {
      if (path.node.type !== "element" || !["image", "icon"].includes(path.node.tag)) return;
      let classAttr;
      path.node.attrs.forEach(attr => {
        if (attr.name === "class") classAttr = attr;
      });
      if (!classAttr || !classAttr.value || /\{\{/.test(classAttr.value)) return;
      imageClasses.push(...classAttr.value.split(" "));
    }

  });
  return imageClasses;
}