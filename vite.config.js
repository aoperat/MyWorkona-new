import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function copyRecursiveSync(src, dest) {
  const exists = existsSync(src);
  const stats = exists && statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(resolve(src, childItemName), resolve(dest, childItemName));
    });
  } else {
    copyFileSync(src, dest);
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fix-service-worker-window',
      renderChunk(code, chunk) {
        // background.js와 관련된 chunk에서 window 참조 처리
        if (chunk.name === 'background' || 
            chunk.facadeModuleId?.includes('background') ||
            chunk.moduleIds?.some(id => id.includes('backgroundHelpers') || id.includes('tabs'))) {
          // window를 self로 대체 (Service Worker 환경)
          return code.replace(/\bwindow\b/g, 'self');
        }
        return null;
      },
    },
    {
      name: 'copy-manifest',
      closeBundle() {
        // manifest.json 복사
        const distDir = resolve(__dirname, 'dist');
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }
        
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));
        
        // icons 디렉토리 복사
        const iconsSrc = resolve(__dirname, 'public/icons');
        const iconsDest = resolve(distDir, 'icons');
        if (existsSync(iconsSrc)) {
          copyRecursiveSync(iconsSrc, iconsDest);
        }

        // newtab HTML 파일을 올바른 위치로 복사
        const newtabHtmlSrc = resolve(distDir, 'src/newtab/index.html');
        const newtabHtmlDest = resolve(distDir, 'newtab/index.html');
        if (existsSync(newtabHtmlSrc)) {
          if (!existsSync(resolve(distDir, 'newtab'))) {
            mkdirSync(resolve(distDir, 'newtab'), { recursive: true });
          }
          copyFileSync(newtabHtmlSrc, newtabHtmlDest);
          
          // HTML 파일의 절대 경로를 상대 경로로 수정
          let htmlContent = readFileSync(newtabHtmlDest, 'utf-8');
          // /chunks/ -> ../chunks/
          // /assets/ -> ../assets/
          htmlContent = htmlContent.replace(/href="\/chunks\//g, 'href="../chunks/');
          htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="../assets/');
          htmlContent = htmlContent.replace(/src="\/newtab\//g, 'src="./');
          writeFileSync(newtabHtmlDest, htmlContent, 'utf-8');
        }
        
        // background.js를 IIFE 형식으로 변환
        const backgroundPath = resolve(distDir, 'background.js');
        if (existsSync(backgroundPath)) {
          let backgroundCode = readFileSync(backgroundPath, 'utf-8');
          
          // import 문에서 chunk 파일 경로 추출 (minified 코드 대응)
          // import{...}from"./chunks/..." 형태 매칭 (공백 없음)
          const importRegex = /import[^'"`]+from\s*['"`]([^'"`]+)['"`]/g;
          let match;
          const chunksToMerge = [];
          
          while ((match = importRegex.exec(backgroundCode)) !== null) {
            const chunkPath = match[1];
            const chunkPathFull = resolve(distDir, chunkPath);
            if (existsSync(chunkPathFull)) {
              chunksToMerge.push({ path: chunkPathFull, importMatch: match[0] });
            }
          }
          
          // chunk 파일들을 병합 (별도 IIFE로 감싸서 스코프 분리)
          // import 매핑 정보 저장: import{p as i,h as c} -> {i: 'p', c: 'h'}
          const importMappings = {};
          
          for (const { path: chunkPathFull, importMatch } of chunksToMerge) {
            // background.js에서만 사용하는 chunk인지 확인
            // background.js는 "./chunks/" 경로를 사용하므로 이를 확인
            const chunkPath = chunkPathFull.replace(distDir + '\\', '').replace(distDir + '/', '');
            const isBackgroundChunk = importMatch.includes('./chunks/') || importMatch.includes('chunks/');
            
            // background.js에서 사용하는 chunk만 처리
            if (!isBackgroundChunk) {
              continue;
            }
            
            // import 문에서 매핑 정보 추출: import{p as i,h as c}from"..."
            const importMappingMatch = importMatch.match(/import\s*{([^}]+)}\s*from/);
            if (importMappingMatch) {
              const mappings = importMappingMatch[1].split(',').map(e => {
                const parts = e.trim().split(/\s+as\s+/);
                return { original: parts[0].trim(), alias: parts[1]?.trim() || parts[0].trim() };
              });
              
              mappings.forEach(m => {
                importMappings[m.alias] = m.original;
              });
            }
            
            let chunkCode = readFileSync(chunkPathFull, 'utf-8');
            
            // export 문에서 실제 함수명 추출
            const exportMatch = chunkCode.match(/export\s*{([^}]+)}/);
            let exportedFunctions = {};
            
            if (exportMatch) {
              // export {p as a, w as b} 형태에서 실제 함수명 추출
              const exports = exportMatch[1].split(',').map(e => {
                const parts = e.trim().split(/\s+as\s+/);
                return { original: parts[0].trim(), alias: parts[1]?.trim() || parts[0].trim() };
              });
              
              exports.forEach(e => {
                exportedFunctions[e.alias] = e.original;
              });
            }
            
            // import 문과 export 문 제거 (export 문은 나중에 처리)
            chunkCode = chunkCode
              .replace(/import[^'"`]+from\s*['"`][^'"`]+['"`];?/g, '')
              .replace(/export\s+(async\s+)?function\s+/g, '$1function ')
              .replace(/export\s+(const|let|var)\s+/g, '$1 ')
              .replace(/export\s+default\s+/g, '');
            
            // export 문에서 실제 함수명 추출 (제거 전에)
            const exportStatement = chunkCode.match(/export\s*{([^}]+)}/);
            if (exportStatement) {
              chunkCode = chunkCode.replace(/export\s*{([^}]+)}/, '');
            }
            
            // chunk 코드를 별도 IIFE로 감싸서 스코프 분리
            // import 매핑에 따라 export된 함수들을 background.js에서 사용하는 이름으로 할당
            // IIFE에서 함수들을 반환하여 외부에서 사용할 수 있도록 함
            const returnStatements = Object.entries(importMappings).map(([alias, original]) => {
              // original은 chunk의 export에서 찾아야 함
              // 예: import{p as i} -> original='p', alias='i'
              // export{p as a} -> exportedFunctions['a'] = 'p'
              // 따라서: return {i: p, ...}; 형태로 반환
              return `${alias}: ${original}`;
            }).join(', ');
            
            // IIFE로 감싸되, export된 함수들을 반환하여 외부에서 사용
            if (returnStatements) {
              chunkCode = `(function() {
${chunkCode}
return {${returnStatements}};
})();`;
              
              // 반환된 객체에서 함수들을 추출
              const assignments = Object.keys(importMappings).map(alias => {
                return `const ${alias} = chunkExports.${alias};`;
              }).join('\n');
              
              chunkCode = `const chunkExports = ${chunkCode}
${assignments}`;
            } else {
              chunkCode = `(function() {
${chunkCode}
})();`;
            }
            
            // chunk 코드를 background 코드 앞에 배치 (IIFE 밖에)
            // background 코드의 IIFE를 제거하고, chunk 코드와 함께 하나의 IIFE로 감싸기
            backgroundCode = backgroundCode.replace(/^\(function\(\)\s*\{/, '').replace(/\}\)\(\);?\s*$/, '');
            
            // chunk 코드를 먼저 배치하고, background 코드를 나중에 배치
            // 이렇게 하면 chunk 코드의 IIFE가 먼저 실행되고, 그 결과가 background 코드에서 사용됨
            backgroundCode = chunkCode + '\n' + backgroundCode;
            
            // chunk 파일 삭제하지 않음 (newtab.js 등 다른 곳에서도 사용할 수 있음)
            // background.js만 인라인으로 병합하고, chunk 파일은 그대로 유지
          }
          
          // import 문 제거 (minified 코드 대응, 공백 없음)
          backgroundCode = backgroundCode.replace(/import[^'"`]+from\s*['"`][^'"`]+['"`];?/g, '');
          
          // chunk 코드는 이미 IIFE로 감싸져 있고, background 코드만 IIFE로 감싸기
          // chunk 코드를 분리하여 IIFE 밖에 두고, background 코드만 IIFE로 감싸기
          const chunkCodeMatch = backgroundCode.match(/^(const chunkExports[^]*?const c = chunkExports\.c;)/);
          const backgroundCodeOnly = backgroundCode.replace(/^const chunkExports[^]*?const c = chunkExports\.c;\n/, '');
          
          if (chunkCodeMatch) {
            const chunkCodeStr = chunkCodeMatch[1];
            backgroundCode = chunkCodeStr + '\n(function() {\n' + backgroundCodeOnly + '\n})();';
          } else {
            // chunk 코드가 없으면 background 코드만 IIFE로 감싸기
            backgroundCode = `(function() {
${backgroundCode}
})();`;
          }
          
          writeFileSync(backgroundPath, backgroundCode, 'utf-8');
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/newtab/index.html'),
        background: resolve(__dirname, 'src/background/background.js'),
        content: resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'newtab') {
            return 'newtab/[name].js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.html') {
            // newtab HTML 파일 처리
            if (assetInfo.names?.includes('newtab')) {
              return 'newtab/index.html';
            }
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: (id) => {
          // background.js와 관련된 모듈은 모두 background.js에 인라인
          if (id.includes('background') || id.includes('backgroundHelpers') || id.includes('tabs')) {
            // background.js에 인라인으로 포함
            return null;
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
