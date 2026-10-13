
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runNpmInstall() {
  console.log('Running npm install --force --legacy-peer-deps...');
  try {
    const { stdout, stderr } = await execAsync('npm install --force --legacy-peer-deps');
    if (stderr) {
      console.error('stderr:', stderr);
    }
    console.log('stdout:', stdout);
  } catch (error) {
    console.error('Error:', error);
  }
}

runNpmInstall();
