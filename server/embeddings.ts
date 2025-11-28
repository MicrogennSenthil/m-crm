import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TextChunk {
  text: string;
  metadata: {
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim(),
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map(t => t.trim()),
  });
  
  return response.data.map((d: { embedding: number[] }) => d.embedding);
}

export function chunkText(
  text: string,
  maxTokens: number = 800,
  overlap: number = 200
): TextChunk[] {
  const avgCharsPerToken = 4;
  const maxChars = maxTokens * avgCharsPerToken;
  const overlapChars = overlap * avgCharsPerToken;
  
  const chunks: TextChunk[] = [];
  let startPos = 0;
  let chunkIndex = 0;
  
  while (startPos < text.length) {
    let endPos = Math.min(startPos + maxChars, text.length);
    
    if (endPos < text.length) {
      const searchStart = Math.max(startPos + maxChars - 200, startPos);
      const searchEnd = Math.min(startPos + maxChars + 200, text.length);
      const searchText = text.slice(searchStart, searchEnd);
      
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      const sentenceBreak = searchText.search(/[.!?]\s+(?=[A-Z])/);
      const lineBreak = searchText.lastIndexOf('\n');
      
      let breakPoint = -1;
      if (paragraphBreak !== -1 && paragraphBreak > 0) {
        breakPoint = searchStart + paragraphBreak + 2;
      } else if (sentenceBreak !== -1 && sentenceBreak > 0) {
        breakPoint = searchStart + sentenceBreak + 1;
      } else if (lineBreak !== -1 && lineBreak > 0) {
        breakPoint = searchStart + lineBreak + 1;
      }
      
      if (breakPoint > startPos && breakPoint < endPos + 200) {
        endPos = breakPoint;
      }
    }
    
    const chunkText = text.slice(startPos, endPos).trim();
    
    if (chunkText.length > 50) {
      chunks.push({
        text: chunkText,
        metadata: {
          chunkIndex,
          startChar: startPos,
          endChar: endPos,
        },
      });
      chunkIndex++;
    }
    
    startPos = endPos - overlapChars;
    
    if (startPos >= text.length || endPos >= text.length) {
      break;
    }
    
    if (startPos < 0) startPos = 0;
  }
  
  return chunks;
}

export function extractTextFromContent(content: string, contentType: string): string {
  if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
    return content;
  }
  
  if (contentType.includes('text/html')) {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return content;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
