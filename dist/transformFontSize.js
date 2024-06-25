"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = transformFontSize;

var _postcss = _interopRequireDefault(require("postcss"));

var _postcssValueParser = _interopRequireDefault(require("postcss-value-parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 转换 wxss 中的 font-size 插件
 * @return {import('postcss').Plugin}
 */
const transformFontSizePlugin = (options = {}) => {
  return {
    postcssPlugin: "transform-font-size",

    Once(root, {
      result
    }) {
      root.walkRules(rule => {
        let fontSizeValue;
        const factor = 1;
        rule.walkDecls("font-size", decl => {
          // font-size 必须要带单位才进行转换
          const unit = _postcssValueParser.default.unit(decl.value);

          if (!unit) return;
          fontSizeValue = decl.value;
          decl.value = `calc(${decl.value} + ${factor} * (1rem - 16px))`;
        });
        if (!fontSizeValue) return;
        rule.walkDecls(decl => {
          if (!["height", "line-height", "min-height", "max-height"].includes(decl.prop)) return; // line-height 必须要带单位才进行转换

          const unit = _postcssValueParser.default.unit(decl.value);

          if (!unit) return;
          decl.value = `calc(${decl.value} + ${factor} * (1rem - 16px))`;
        });
      });
    }

  };
};
/**
 * @param {string} source
 * @param {string} filename
 * @return {Promise<string>}
 */


async function transformFontSize(source, filename) {
  const {
    css
  } = await (0, _postcss.default)([transformFontSizePlugin()]).process(source, {
    from: undefined
  });
  return css;
}