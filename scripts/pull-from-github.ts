import { getUncachableGitHubClient } from '../server/github';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_NAME = '3-bucket-retirement-planner';

const SKIP_PATHS = [
  'node_modules', '.git', 'dist', 'server/public',
  '.cache', '.config', '.local', '.upm', '.replit',
  'replit.nix', 'scripts/pull-from-github.ts',
];

function shouldSkip(filePath: string): boolean {
  return SKIP_PATHS.some(p => filePath.startsWith(p) || filePath === p);
}

async function main() {
  console.log('Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();

  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  const { data: ref } = await octokit.git.getRef({
    owner: user.login,
    repo: REPO_NAME,
    ref: 'heads/main',
  });
  const commitSha = ref.object.sha;
  console.log(`Latest commit: ${commitSha.slice(0, 7)}`);

  const { data: commit } = await octokit.git.getCommit({
    owner: user.login,
    repo: REPO_NAME,
    commit_sha: commitSha,
  });

  const { data: tree } = await octokit.git.getTree({
    owner: user.login,
    repo: REPO_NAME,
    tree_sha: commit.tree.sha,
    recursive: 'true',
  });

  const files = tree.tree.filter(f => f.type === 'blob' && f.path && !shouldSkip(f.path));
  console.log(`Downloading ${files.length} files...`);

  const projectDir = path.resolve(__dirname, '..');
  let updated = 0;

  for (const file of files) {
    if (!file.path || !file.sha) continue;
    try {
      const { data: blob } = await octokit.git.getBlob({
        owner: user.login,
        repo: REPO_NAME,
        file_sha: file.sha,
      });

      const content = Buffer.from(blob.content, 'base64').toString('utf8');
      const localPath = path.join(projectDir, file.path);
      const dir = path.dirname(localPath);

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const existing = fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8') : null;
      if (existing !== content) {
        fs.writeFileSync(localPath, content, 'utf8');
        console.log(`  updated: ${file.path}`);
        updated++;
      }
    } catch (e: any) {
      console.warn(`  skipped (binary?): ${file.path}`);
    }
    process.stdout.write('.');
  }

  console.log(`\n\nDone! ${updated} files updated from github.com/${user.login}/${REPO_NAME}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
