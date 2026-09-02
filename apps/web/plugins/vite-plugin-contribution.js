import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContribution, contributionPaths } from '../tools/compile-contribution.js';

export default function contributionPlugin() {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const paths = contributionPaths(webRoot);

  return {
    name: 'contribution-xml',
    async buildStart() {
      await compileContribution(paths.contributionDir, paths);
    },
    configureServer(server) {
      server.watcher.add(paths.contributionDir);
      const reload = async (file) => {
        if (!file || !file.startsWith(paths.contributionDir)) return;
        try {
          await compileContribution(paths.contributionDir, paths);
          server.ws.send({ type: 'full-reload' });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          server.config.logger.error(`[contribution] ${message}`);
        }
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
    },
  };
}
