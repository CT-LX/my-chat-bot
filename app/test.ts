import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { HumanMessage } from "@langchain/core/messages";


// Use qwenMax
const qwenMax = new ChatAlibabaTongyi({
  model: "qwen-max", // Available models: qwen-turbo, qwen-plus, qwen-max
  temperature: 0.3,
  alibabaApiKey: process.env.ALIBABA_API_KEY, // In Node.js defaults to process.env.ALIBABA_API_KEY
});
const messages = [new HumanMessage("Hello")];
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

const res2 = await qwenMax.invoke(messages);
console.log(res2)
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/