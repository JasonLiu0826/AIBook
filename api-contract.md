# 后端生成接口约定

小程序端通过 `src/services/ai.ts` 的 `generateChapter` 调用你的后端，请按以下约定实现接口。

## 请求

- **方法**: `POST`
- **URL**: `{AIBOOK_API_BASE}/generate`（例如 `https://your-api.com/aibook/generate`）
- **Header**: `Content-Type: application/json`
- **Body** (JSON):

| 字段 | 类型 | 说明 |
|------|------|------|
| characters | string | 人物设定 MD |
| worldview | string | 世界观/背景 MD |
| scenes | string | 环境场景 MD |
| mainPlot | string | 故事主线 MD |
| storyNodes | string | 重要故事节点 MD |
| singleOutputLength | number | 单次输出字数上限 |
| pov | string | 人称，如 "第一人称（我）" / "第二人称（你）" / "第三人称（他/她/角色名）" |
| contextSummary | string | 前文摘要（用于续写） |
| chosenBranch | string | 用户选择的分支文案或自定义输入 |
| nextChapterIndex | number | 下一章序号（从 1 开始） |

## 响应

- **Status**: `200`
- **Body** (JSON):

```json
{
  "title": "第一章 标题",
  "content": "本章正文内容……",
  "branches": ["分支选项A", "分支选项B", "分支选项C"]
}
```

- `title`: 本章标题
- `content`: 本章正文（建议按 `singleOutputLength` 控制长度）
- `branches`: 固定 3 个字符串，章末供用户选择的剧情分支

后端需自行接入大模型（如 OpenAI / 国内大模型），根据上述参数拼装 prompt，并按约定返回 JSON。小程序端不持有 API Key，仅请求你的后端。

---

## 润色接口（可选，设定页「AI 润色」使用）

- **方法**: `POST`
- **URL**: `{AIBOOK_API_BASE}/polish`
- **Body** (JSON): `{ "text": "用户输入的待润色文字" }`
- **响应** (JSON): `{ "text": "润色后的文字" }`

未配置或未实现时，设定编辑页点击「AI 润色」会提示「请先配置润色接口（API 预留）」。
