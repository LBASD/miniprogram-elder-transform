"use strict";

var _fastGlob = _interopRequireDefault(require("fast-glob"));

var _transformFontSize = _interopRequireDefault(require("./transformFontSize"));

var _transformPageMeta = _interopRequireDefault(require("./transformPageMeta"));

var _transformClassSize = _interopRequireDefault(require("./transformClassSize"));

var _extractImageClass = _interopRequireDefault(require("./extractImageClass"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _yargs = _interopRequireDefault(require("yargs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function transformWxss(cwd) {
  const entries = await (0, _fastGlob.default)("**/*.wxss", {
    cwd,
    absolute: true
  });

  for (const entry of entries) {
    const source = await _fs.default.promises.readFile(entry, "utf8");
    const output = await (0, _transformFontSize.default)(source, entry);
    await _fs.default.promises.writeFile(entry, output, "utf8");
  }
}

async function transformPagesWxml(cwd) {
  const appJsonPath = _path.default.join(cwd, "app.json");

  if (!_fs.default.existsSync(appJsonPath)) return;
  const appJson = JSON.parse(await _fs.default.promises.readFile(appJsonPath, "utf8"));
  const subpackages = appJson.subpackages || [];
  const subPages = subpackages.reduce((arr, item) => {
    const res = (item.pages || []).map(i => item.root + i);
    return arr.concat(res);
  }, []);
  const pages = [...appJson.pages, ...subPages];

  for (const page of pages) {
    const entry = _path.default.join(cwd, (page[0] === "/" ? "." + page : page) + ".wxml");

    const source = await _fs.default.promises.readFile(entry, "utf8");
    const output = await (0, _transformPageMeta.default)(source, entry);
    await _fs.default.promises.writeFile(entry, output, "utf8");
  }
}

async function transformImageSize(cwd) {
  const wxmlEntries = await (0, _fastGlob.default)("**/*.wxml", {
    cwd,
    absolute: true
  });
  const allImageClasses = [];

  for (const wxmlEntry of wxmlEntries) {
    const wxmlSource = await _fs.default.promises.readFile(wxmlEntry, "utf8");
    const imageClasses = await (0, _extractImageClass.default)(wxmlSource, wxmlEntry);
    allImageClasses.push(...imageClasses);
  }

  const wxssEntries = await (0, _fastGlob.default)("**/*.(wxss|css|less|sass|scss)", {
    cwd,
    absolute: true
  });

  for (const wxssEntry of wxssEntries) {
    const wxssSource = await _fs.default.promises.readFile(wxssEntry, "utf8");
    const output = await (0, _transformClassSize.default)(wxssSource, allImageClasses, wxssEntry);
    await _fs.default.promises.writeFile(wxssEntry, output, "utf8");
  }
}

const argv = (0, _yargs.default)(process.argv.slice(2)).usage("$0 <baseDir>", "transform mini program source code", yargs => {
  yargs.positional("baseDir", {
    describe: "directory to transform",
    type: "string",
    coerce: baseDir => _path.default.join(process.cwd(), baseDir || "")
  });
}).argv;

async function main() {
  try {
    await transformWxss(argv.baseDir);
    await transformPagesWxml(argv.baseDir);
    await transformImageSize(argv.baseDir);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();