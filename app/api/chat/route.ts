// NextRequest 扩展了Web 请求 API
// NextResponse 扩展了Web 响应 API
import { NextRequest, NextResponse } from 'next/server';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { HumanMessage, AIMessage } from '@langchain/core/messages';


export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: '消息不能为空' },
        { status: 400 }
      );
    }

    // 从环境变量获取 API Key（服务端可以访问）
    const apiKey = process.env.ALIBABA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key 未配置，请设置 ALIBABA_API_KEY' },
        { status: 500 }
      );
    }

    // 初始化千问模型
    const model = new ChatAlibabaTongyi({
      model: 'qwen-max',
      temperature: 0.7,
      alibabaApiKey: apiKey,
    });


    // 构建消息历史（转换为 LangChain 消息格式）
    const langchainMessages = messages.map((msg: { role: string; content: string }) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    });

    // 调用模型
    const response = await model.invoke(langchainMessages);

    return NextResponse.json({
      content: response.content,
    });
  } catch (error: any) {
    console.error('聊天 API 错误:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}