import { pipeline, env } from '@xenova/transformers';
import { cosineSimilarity, extractDomain } from './utils.js';

// Configure transformers.js to not use remote code where possible, 
// and to serve models from local cache (IndexedDB)
env.allowLocalModels = false; // MV3 extensions can't easily read local file system
env.useBrowserCache = true;   // Cache models in the browser so we only download once

// CRITICAL FIX: ONNX's multi-threading checks use 'eval()', which violates MV3 CSP.
// We must restrict it to a single thread to prevent the 'unsafe-eval' crash.
env.backends.onnx.wasm.numThreads = 1;

// MV3 forbids remotely hosted code, so load the ONNX WASM binaries bundled in
// dist/ (copied by build.mjs) instead of transformers.js' default CDN.
const runtimeAPI = typeof browser !== "undefined" ? browser : chrome;
env.backends.onnx.wasm.wasmPaths = runtimeAPI.runtime.getURL('dist/');

let embedder = null;

/**
 * Singleton to get the feature extraction pipeline
 */
async function getEmbedder() {
    if (!embedder) {
        console.log("Loading embedding model (this may take a moment on first run)...");
        // Using a highly optimized, tiny embedding model (MiniLM)
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true, // Use int8 quantization for smaller size & speed
        });
        console.log("Model loaded successfully!");
    }
    return embedder;
}

/**
 * Embeds a string to a mathematical vector.
 */
export async function embedText(text) {
    const extractor = await getEmbedder();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.data; // Float32Array of embeddings
}

/**
 * Mathematically groups tabs based on cosine similarity of their titles/URLs.
 * Uses a simple agglomerative thresholding approach.
 */
export async function clusterTabs(tabs, similarityThreshold = 0.45, { domainBonus = 0.3 } = {}) { // Lowered for broader grouping
    console.log(`Starting clustering for ${tabs.length} tabs...`);
    
    // 1. Generate embeddings for all tabs
    const tabData = [];
    for (const tab of tabs) {
        // Combine Title and URL to create a richer semantic meaning
        const textToEmbed = `${tab.title || ''} ${new URL(tab.url).hostname}`;
        const embedding = await embedText(textToEmbed);
        tabData.push({ tab, embedding });
    }

    // 2. Group based on similarity
    const clusters = []; // Array of arrays containing tab data

    for (const item of tabData) {
        let bestCluster = null;
        let bestScore = -1;

        // Compare the current tab with the first item of each existing cluster
        for (const cluster of clusters) {
            // Compare against the 'centroid' or just the first item of the cluster
            const repItem = cluster[0]; 
            
            // Calculate Cosine Similarity
            let score = cosineSimilarity(item.embedding, repItem.embedding);
            
            // Domain bonus
            try {
                const host1 = extractDomain(item.tab.url);
                const host2 = extractDomain(repItem.tab.url);
                if (host1 === host2 && host1 !== '') {
                    score += domainBonus; // Bonus for same website (disabled for duplicate detection)
                }
            } catch(e) {}
            
            if (score > similarityThreshold && score > bestScore) {
                bestScore = score;
                bestCluster = cluster;
            }
        }

        if (bestCluster) {
            bestCluster.push(item);
        } else {
            // Create a new cluster
            clusters.push([item]);
        }
    }

    // 3. Format output
    return clusters.map((cluster, index) => {
        return {
            id: `cluster-${index}`,
            tabs: cluster.map(c => c.tab),
            embeddings: cluster.map(c => c.embedding)
        };
    });
}

const CATEGORIES = [
    'Finance & Banking', 'Real Estate', 'Investing', 
    'Entertainment & Media', 'Shopping', 'Productivity', 
    'Social Media', 'News & Blogs', 'Software Development', 
    'Research & Education', 'Travel & Lifestyle', 'Health & Fitness',
    'Food & Dining', 'Sports'
];

let categoryEmbeddings = null;

/**
 * Calculates a smart category name for a cluster of tabs using zero-shot embedding similarity.
 */
export async function getSmartGroupName(clusterItemEmbeddings) {
    if (!categoryEmbeddings) {
        categoryEmbeddings = [];
        for (const cat of CATEGORIES) {
            categoryEmbeddings.push({
                name: cat,
                embedding: await embedText("Category: " + cat)
            });
        }
    }
    
    // Average the embeddings of all tabs in the cluster
    const dim = clusterItemEmbeddings[0].length;
    const avgEmbedding = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        let sum = 0;
        for (const emb of clusterItemEmbeddings) {
            sum += emb[i];
        }
        avgEmbedding[i] = sum / clusterItemEmbeddings.length;
    }
    
    let bestScore = -1;
    let bestCat = null;
    for (const cat of categoryEmbeddings) {
        const score = cosineSimilarity(avgEmbedding, cat.embedding);
        if (score > bestScore) {
            bestScore = score;
            bestCat = cat.name;
        }
    }
    
    // If the semantic similarity is decent, return the AI category
    if (bestScore > 0.28) {
        return bestCat;
    }
    return null; // Fallback
}
