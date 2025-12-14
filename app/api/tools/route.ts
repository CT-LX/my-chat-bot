import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import * as z from "zod";
import { createAgent, createMiddleware, ToolMessage, tool, HumanMessage, AIMessage } from "langchain";
import { NextRequest, NextResponse } from 'next/server';

interface MessageIntf {
  role: string // 角色
  content: string // 消息内容
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: '消息不能为空' },
        { status: 400 }
      )
    }

    const alibabaApiKey = process.env.ALIBABA_API_KEY
    if (!alibabaApiKey) {
      return NextResponse.json(
        { error: 'API Key 未配置，请设置 ALIBABA_API_KEY' },
        { status: 500 }
      )
    }

    const model = new ChatAlibabaTongyi({
      model: "qwen-plus", // qwen-max
      temperature: 0.1,
      maxTokens: 1000,
      alibabaApiKey,
    });
    const searchDatabase = tool(
      ({ query, limit }) => `Found ${limit} results for '${query}'`,
      {
        name: "search_database",
        description: "Search the customer database for records matching the query.",
        schema: z.object({
          query: z.string().describe("Search terms to look for"),
          limit: z.number().describe("Maximum number of results to return"),
        }),
      }
    );
    
    // 定义工具
    const search = tool(
      ({ query }) => `Results for: ${query}`,
      {
        name: "search",
        description: "Search for information",
        schema: z.object({
          query: z.string().describe("The query to search for"),
        }),
      }
    );

    const getWeather = tool(
      ({ location }) => `Weather in ${location}: Sunny, 72°F`,
      {
        name: "get_weather",
        description: "Get weather information for a location",
        schema: z.object({
          location: z.string().describe("The location to get weather for"),
        }),
      }
    );
    const tools = [search, getWeather, searchDatabase];

    // 绑定工具到模型 - 检查模型是否支持 bindTools
    let modelWithTools;
    try {
      if (typeof (model as any).bindTools === 'function') {
        modelWithTools = (model as any).bindTools(tools);
      } else {
        // 模型不支持 bindTools，返回错误
        return NextResponse.json(
          { 
            error: '当前模型版本不支持工具调用功能。ChatAlibabaTongyi 需要更新版本的 @langchain/community 才能支持 bindTools。',
            details: '请运行: npm install @langchain/community@latest',
            suggestion: '或者暂时使用 /api/chat 端点（不支持工具调用）'
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('绑定工具失败:', error);
      return NextResponse.json(
        { 
          error: `工具绑定失败: ${error.message}`,
          details: '请确保 @langchain/community 版本 >= 0.3.0'
        },
        { status: 500 }
      );
    }

    // 工具错误处理
    const handleToolErrors = createMiddleware({
      name: "HandleToolErrors",
      wrapToolCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch (error) {
          // Return a custom error message to the model
          return new ToolMessage({
            content: `Tool error: Please check your input and try again. (${error})`,
            tool_call_id: request.toolCall.id!,
          });
        }
      },
    });


    const agent = createAgent({
      // model,
      model: modelWithTools,
      tools,
      middleware: [handleToolErrors]
    });

    const langchainMessages = messages.map((msg: MessageIntf) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
      // 将未知角色视为用户消息
      return new HumanMessage(msg.content);
    });

    const response = await agent.invoke({
      messages: langchainMessages,
    })
    // 找到最后一个 AIMessage 作为最终响应
    const aiMessages = response.messages.filter((msg): msg is AIMessage => msg instanceof AIMessage);
    const lastAIMessage = aiMessages[aiMessages.length - 1];
    const content = lastAIMessage?.content || '';

    return NextResponse.json({
      content: content,
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}




// 智能体遵循 ReAct（“推理 + 行动”）模式，在简短的推理步骤和有针对性的工具调用之间交替进行，并将由此产生的观察结果输入到后续决策中，直到能够给出最终答案