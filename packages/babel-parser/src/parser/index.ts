import type { Options } from "../options";
import type * as N from "../types";
import type { PluginList } from "../plugin-utils";
import { getOptions } from "../options";
import StatementParser from "./statement";
import ScopeHandler from "../util/scope";

export type PluginsMap = Map<
  string,
  {
    [x: string]: any;
  }
>;

export default class Parser extends StatementParser {
  // Forward-declaration so typescript plugin can override jsx plugin
  // todo(flow->ts) - this probably can be removed
  // abstract jsxParseOpeningElementAfterName(
  //   node: N.JSXOpeningElement,
  // ): N.JSXOpeningElement;

  constructor(options: Options | undefined | null, input: string) {
    options = getOptions(options);
    super(options, input);

    this.options = options;
    this.initializeScopes();
    this.plugins = pluginsMap(this.options.plugins);
    this.filename = options.sourceFilename;
  }

  // This can be overwritten, for example, by the TypeScript plugin.
  getScopeHandler(): {
    new (...args: any): ScopeHandler;
  } {
    return ScopeHandler;
  }

  parse(): N.File {
    // 进入到初始作用域中
    this.enterInitialScopes();
    // 初始化 file、program 节点
    const file = this.startNode() as N.File;
    const program = this.startNode() as N.Program;
    // 获取并更新下一个 token 信息
    this.nextToken();
    file.errors = null;
    // 从当前文件入口开始解析
    this.parseTopLevel(file, program);
    file.errors = this.state.errors;
    // 返回解析结果，即 ast
    return file;
  }
}

function pluginsMap(plugins: PluginList): PluginsMap {
  const pluginMap: PluginsMap = new Map();
  for (const plugin of plugins) {
    const [name, options] = Array.isArray(plugin) ? plugin : [plugin, {}];
    if (!pluginMap.has(name)) pluginMap.set(name, options || {});
  }
  return pluginMap;
}
