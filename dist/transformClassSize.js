"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = transformClassSize;

var _postcss = _interopRequireDefault(require("postcss"));

var _postcssSelectorParser = _interopRequireDefault(require("postcss-selector-parser"));

var _postcssValueParser = _interopRequireDefault(require("postcss-value-parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 转换 wxss 中的特定 class 宽高插件
 * @return {import('postcss').Plugin}
 */
const transformClassSizePlugin = ({
  classNames = []
} = {}) => {
  return {
    postcssPlugin: "transform-class-size",

    Once(root, {
      result
    }) {
      root.walkRules(rule => {
        let selectorMatch; // 判断 selector 是否命中对应 className

        (0, _postcssSelectorParser.default)(selectors => {
          selectorMatch = selectors.every(selector => {
            let lastClassNode;
            selector.walkClasses(node => {
              lastClassNode = node;
            });
            return lastClassNode && classNames.includes(lastClassNode.value);
          });
        }).processSync(rule.selector);
        if (!selectorMatch) return;
        const factor = 1;
        rule.walkDecls(/^(width|height)$/, decl => {
          // 必须要带单位才进行转换
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


async function transformClassSize(source, classNames, filename) {
  const {
    css
  } = await (0, _postcss.default)([transformClassSizePlugin({
    classNames
  })]).process(source, {
    from: undefined
  });
  return css;
}