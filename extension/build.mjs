import { build } from 'esbuild';
import fs from 'fs';

async function runBuild() {
    await build({
        entryPoints: ['src/background.js'],
        bundle: true,
        format: 'esm',
        target: 'esnext',
        define: { global: 'globalThis' },
        outdir: 'dist',
    });

    // Patch protobufjs eval issue (Manifest V3 forbids eval)
    const filePath = 'dist/background.js';
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace: eval("quire".replace(/^/, "re"))
    // With: (function(){return null;})
    code = code.replace(/eval\("quire"\.replace\(\/\^\/, "re"\)\)/g, '(function(){return null;})');
    
    // Replace: new Function("return this")() from Webpack/Polyfills
    // With: globalThis
    code = code.replace(/new Function\("return this"\)\(\)/g, 'globalThis');
    
    fs.writeFileSync(filePath, code);

    // Bundle the single-threaded ONNX runtime binaries so nothing is fetched from a CDN
    for (const wasm of ['ort-wasm.wasm', 'ort-wasm-simd.wasm']) {
        fs.copyFileSync(`node_modules/@xenova/transformers/dist/${wasm}`, `dist/${wasm}`);
    }
    console.log('Build completed and patched for MV3!');
}

runBuild().catch(console.error);
