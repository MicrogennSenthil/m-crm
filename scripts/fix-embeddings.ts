import { db } from "../server/db";
import { knowledgeBaseChunks, knowledgeBaseSources } from "../shared/schema";
import { generateEmbeddings } from "../server/embeddings";
import { eq, isNull, sql } from "drizzle-orm";

async function fixMissingEmbeddings() {
  console.log("Checking for chunks with missing embeddings...");
  
  // Get all chunks without embeddings
  const result = await db.execute(sql`
    SELECT c.id, c.content, c.source_id, s.title
    FROM knowledge_base_chunks c
    JOIN knowledge_base_sources s ON c.source_id = s.id
    WHERE c.embedding IS NULL
    ORDER BY c.source_id, c.chunk_index
  `);
  
  const chunksToFix = result.rows as any[];
  console.log(`Found ${chunksToFix.length} chunks needing embeddings`);
  
  if (chunksToFix.length === 0) {
    console.log("No missing embeddings found!");
    return;
  }
  
  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  let fixed = 0;
  
  for (let i = 0; i < chunksToFix.length; i += batchSize) {
    const batch = chunksToFix.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunksToFix.length/batchSize)}...`);
    
    try {
      // Generate embeddings for batch
      const texts = batch.map(c => c.content);
      const embeddings = await generateEmbeddings(texts);
      
      // Update each chunk
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embeddingString = `[${embeddings[j].join(',')}]`;
        
        await db.execute(sql`
          UPDATE knowledge_base_chunks 
          SET embedding = ${embeddingString}::vector 
          WHERE id = ${chunk.id}
        `);
        
        fixed++;
        console.log(`  ✓ Fixed: ${chunk.title} (chunk ${chunk.id.substring(0,8)}...)`);
      }
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`  ✗ Error in batch:`, error);
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Fixed ${fixed}/${chunksToFix.length} chunks`);
  console.log(`========================================`);
}

fixMissingEmbeddings()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Failed:", err);
    process.exit(1);
  });
