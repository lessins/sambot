export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: Role;
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}

export interface AgentConfig {
  model: string;
  maxIterations: number;
  systemPrompt: string;
  tools: ToolDefinition[];
  temperature: number;
  verbose: boolean;
}

export interface RunOptions {
  input: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}

export interface AgentRun {
  sessionId: string;
  input: string;
  output: string;
  steps: AgentStep[];
  duration: number;
  tokensUsed: number;
}

export interface AgentStep {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  timestamp: number;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  content: string;
  embedding?: number[];
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Plugin {
  name: string;
  version: string;
  tools: ToolDefinition[];
  execute(toolName: string, args: Record<string, unknown>): Promise<string>;
}
