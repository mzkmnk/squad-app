/**
 * @fileoverview preload スクリプトを esbuild でバンドルする。
 *
 * sandbox 環境の preload は ESM import が使えないため、
 * esbuild で依存モジュールをインライン化した単一 CJS ファイルとして出力する。
 * これにより preload から electron/ 配下の共有モジュール（IpcChannels 等）を
 * import できるようになる。
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
  sourcemap: true,
});
