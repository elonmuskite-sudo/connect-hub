
const { exec } = require('child_process');

console.log('Running npm install...');
exec('npm install --force --legacy-peer-deps', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
  }
  console.log(`Stdout: ${stdout}`);
});
