declare function defineAppConfig(config: Record<string, unknown>): Record<string, unknown>
declare function definePageConfig(config: Record<string, unknown>): Record<string, unknown>

// 添加 Node.js 进程类型声明（用于环境变量访问）
declare var process: {
  env: Record<string, string | undefined>;
}
