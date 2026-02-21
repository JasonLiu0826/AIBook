const axios = require('axios');

// 测试数据
const testData = {
  settings: {
    characters: "主角林默，25岁，程序员，性格内向但观察力敏锐",
    worldview: "现代都市背景，融合超自然元素的悬疑世界",
    scenes: "老旧公寓、深夜街道、神秘图书馆",
    mainPlot: "寻找失踪父亲真相的过程中，发现了一个隐藏的超自然组织",
    storyNodes: "第一章：收到神秘信件；第二章：追踪神秘人影"
  },
  userConfig: {
    singleOutputLength: 800,
    pov: "third",
    aiProvider: "deepseek",
    apiKey: "" // 这里需要填入真实的 API Key 来测试
  },
  contextSummary: "",
  chosenBranch: "",
  nextChapterIndex: 1
};

async function testAIEndpoint() {
  try {
    console.log('🧪 开始测试 AI 生成接口...');
    
    const response = await axios.post('http://localhost:3000/generate/stream', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-deepseek-api-key-here' // 替换为真实的 API Key
      },
      responseType: 'stream'
    });

    console.log('✅ 请求发送成功，开始接收流式数据...');
    
    let fullResponse = '';
    
    response.data.on('data', (chunk) => {
      const data = chunk.toString();
      fullResponse += data;
      console.log('📥 收到数据块:', data.trim());
    });

    response.data.on('end', () => {
      console.log('✅ 数据接收完成');
      console.log('📊 完整响应:', fullResponse);
    });

    response.data.on('error', (error) => {
      console.error('❌ 流式数据错误:', error);
    });

  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP 错误:', error.response.status, error.response.data);
    } else {
      console.error('❌ 请求错误:', error.message);
    }
  }
}

// 执行测试
testAIEndpoint();