const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 真实的 AI 流式接口
app.post('/generate/stream', async (req, res) => {
  console.log('\n--- 收到真实流式生成请求 ---');
  
  // 必须设置的 SSE 流式响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    // 1. 获取小程序传过来的所有设定和参数
    const { settings, userConfig, contextSummary, chosenBranch, nextChapterIndex } = req.body;
    
    // 2. 提取前端传来的 API Key
    const authHeader = req.headers.authorization;
    const apiKey = authHeader ? authHeader.split(' ')[1] : null;

    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ type: 'error', value: '未检测到 API Key，请返回小程序配置页填写' })}\n\n`);
      return res.end();
    }

    console.log(`准备生成第 ${nextChapterIndex} 章...`);

    // 3. 组装给 AI 的提示词 (Prompt Engineering) 
    let prompt = `你是一个互动小说家。请为我写第 ${nextChapterIndex} 章的正文。\n\n`;
    
    prompt += `【世界观设定】：${settings.worldview || '无'}\n`;
    prompt += `【人物设定】：${settings.characters || '无'}\n`;
    if (contextSummary) prompt += `【前情提要】：\n${contextSummary}\n`;
    if (chosenBranch) prompt += `【本章走向】：主角在上一章结尾选择了——"${chosenBranch}"，请顺着这个选择往下写。\n`;
    
    const povMap = { 'first': '第一人称(我)', 'second': '第二人称(你)', 'third': '第三人称(他/她)' };
    const pov = povMap[userConfig?.pov] || '第三人称';

    // 强制 AI 按规定格式输出（特别是分支选项）
    prompt += `\n【重要要求】：
1. 请直接输出小说正文，严禁输出任何多余的客套话或分析解释。
2. 视角必须使用 ${pov}。字数控制在 ${userConfig?.singleOutputLength || 800} 字左右。
3. 在正文最后，你必须为主角设计3个不同的行动选项作为下一章的分支。请严格以 "选项A：XXX|选项B：XXX|选项C：XXX" 的单行格式放在整篇文末，不要带换行，方便程序提取。`;

    // 4. 初始化 DeepSeek 客户端 (通过更换 baseURL 连入国内 DeepSeek)
    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com', // 指向 DeepSeek 官方 API
      apiKey: apiKey,
    });

    // 5. 先给前端发送一个生成的标题（让前端立马有响应）
    res.write(`data: ${JSON.stringify({ type: 'title', value: `第 ${nextChapterIndex} 章` })}\n\n`);

    // 6. 开启真实的 AI 流式请求
    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat', 
      messages: [{ role: 'user', content: prompt }],
      stream: true, 
    });

    let fullContent = '';

    // 7. 遍历流，实时把文字转给小程序
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ type: 'content', value: content })}\n\n`);
      }
    }

    // 8. 文本生成完了，用正则从全文末尾提取出那 3 个选项分支
    let branches = ["继续探索", "停下休息", "仔细观察四周"]; // 兜底的默认分支
    const branchMatch = fullContent.match(/选项A：(.*?)\|选项B：(.*?)\|选项C：(.*)/);
    if (branchMatch) {
      branches = [branchMatch[1].trim(), branchMatch[2].trim(), branchMatch[3].trim()];
    } else {
      // 容错匹配：如果 AI 不听话换行了
      const fallbackMatch = fullContent.match(/选项[A|1][：|:](.*?)\n.*选项[B|2][：|:](.*?)\n.*选项[C|3][：|:](.*)/s);
      if(fallbackMatch) branches = [fallbackMatch[1].trim(), fallbackMatch[2].trim(), fallbackMatch[3].trim()];
    }

    // 发送提取出来的分支数据给前端渲染按钮
    res.write(`data: ${JSON.stringify({ type: 'branches', value: JSON.stringify(branches) })}\n\n`);
    
    // 9. 完美收工，断开连接
    res.write(`data: ${JSON.stringify({ type: 'complete', value: '生成完成' })}\n\n`);
    res.end();
    console.log('--- 章节生成完毕 ---');

  } catch (error) {
    console.error('AI请求报错:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', value: `AI 接口请求失败：${error.message}` })}\n\n`);
    res.end();
  }
});

// 普通生成接口（非流式）- 保持兼容性
app.post('/generate', async (req, res) => {
  console.log('收到普通生成请求:', req.body);
  
  try {
    const { settings, userConfig, contextSummary, chosenBranch, nextChapterIndex } = req.body;
    const authHeader = req.headers.authorization;
    const apiKey = authHeader ? authHeader.split(' ')[1] : null;

    if (!apiKey) {
      return res.status(401).json({ error: '未检测到 API Key' });
    }

    // 构建提示词
    let prompt = `你是一个互动小说家。请为我写第 ${nextChapterIndex} 章的正文。\n\n`;
    prompt += `【世界观设定】：${settings.worldview || '无'}\n`;
    prompt += `【人物设定】：${settings.characters || '无'}\n`;
    if (contextSummary) prompt += `【前情提要】：\n${contextSummary}\n`;
    if (chosenBranch) prompt += `【本章走向】：主角选择了"${chosenBranch}"\n`;
    
    const povMap = { 'first': '第一人称(我)', 'second': '第二人称(你)', 'third': '第三人称(他/她)' };
    const pov = povMap[userConfig?.pov] || '第三人称';

    prompt += `\n【要求】：直接输出小说正文，使用${pov}，约${userConfig?.singleOutputLength || 800}字，并在文末提供3个选项分支。`;

    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    // 简单提取分支（这里可以进一步优化）
    const branches = ["继续探索", "停下休息", "仔细观察四周"];
    
    res.json({
      title: `第 ${nextChapterIndex} 章`,
      content: content,
      branches: branches
    });

  } catch (error) {
    console.error('AI请求报错:', error.message);
    res.status(500).json({ error: `AI 接口请求失败：${error.message}` });
  }
});

// 润色接口
app.post('/polish', (req, res) => {
  console.log('收到润色请求:', req.body);
  
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: '缺少文本内容' });
  }

  // 简单的文本润色模拟
  setTimeout(() => {
    const polishedText = text.replace(/([。！？])/g, '$1 ').trim();
    res.json({ text: polishedText });
  }, 1000);
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 AIBook 真实后端已启动在 http://localhost:${PORT}`);
  console.log(`📡 流式接口: http://localhost:${PORT}/generate/stream`);
  console.log(`📝 普通接口: http://localhost:${PORT}/generate`);
  console.log(`📝 润色接口: http://localhost:${PORT}/polish`);
  console.log(`💚 健康检查: http://localhost:${PORT}/health`);
});