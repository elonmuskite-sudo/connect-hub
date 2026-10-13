const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'public', 'logo.svg');
const svg = fs.readFileSync(svgPath);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function writePng(filePath, width, height) {
  await sharp(svg).resize(width, height).png().toFile(filePath);
}

async function generateAndroidIcons() {
  const baseDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
  const mappings = [
    ['mipmap-mdpi', 48],
    ['mipmap-hdpi', 72],
    ['mipmap-xhdpi', 96],
    ['mipmap-xxhdpi', 144],
    ['mipmap-xxxhdpi', 192],
  ];

  for (const [dirName, size] of mappings) {
    const dir = path.join(baseDir, dirName);
    ensureDir(dir);
    await writePng(path.join(dir, 'ic_launcher.png'), size, size);
    await writePng(path.join(dir, 'ic_launcher_round.png'), size, size);
  }
}

async function generateIosIcons() {
  const appIconDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  ensureDir(appIconDir);

  const entries = [
    { file: 'AppIcon-20@2x.png', size: 40 },
    { file: 'AppIcon-20@3x.png', size: 60 },
    { file: 'AppIcon-29@2x.png', size: 58 },
    { file: 'AppIcon-29@3x.png', size: 87 },
    { file: 'AppIcon-40@2x.png', size: 80 },
    { file: 'AppIcon-40@3x.png', size: 120 },
    { file: 'AppIcon-60@2x.png', size: 120 },
    { file: 'AppIcon-60@3x.png', size: 180 },
    { file: 'AppIcon-76.png', size: 76 },
    { file: 'AppIcon-76@2x.png', size: 152 },
    { file: 'AppIcon-83.5@2x.png', size: 167 },
    { file: 'AppIcon-1024.png', size: 1024 },
  ];

  for (const entry of entries) {
    await writePng(path.join(appIconDir, entry.file), entry.size, entry.size);
  }

  const contents = {
    images: [
      { size: '20x20', idiom: 'iphone', filename: 'AppIcon-20@2x.png', scale: '2x' },
      { size: '20x20', idiom: 'iphone', filename: 'AppIcon-20@3x.png', scale: '3x' },
      { size: '29x29', idiom: 'iphone', filename: 'AppIcon-29@2x.png', scale: '2x' },
      { size: '29x29', idiom: 'iphone', filename: 'AppIcon-29@3x.png', scale: '3x' },
      { size: '40x40', idiom: 'iphone', filename: 'AppIcon-40@2x.png', scale: '2x' },
      { size: '40x40', idiom: 'iphone', filename: 'AppIcon-40@3x.png', scale: '3x' },
      { size: '60x60', idiom: 'iphone', filename: 'AppIcon-60@2x.png', scale: '2x' },
      { size: '60x60', idiom: 'iphone', filename: 'AppIcon-60@3x.png', scale: '3x' },
      { size: '76x76', idiom: 'ipad', filename: 'AppIcon-76.png', scale: '1x' },
      { size: '76x76', idiom: 'ipad', filename: 'AppIcon-76@2x.png', scale: '2x' },
      { size: '83.5x83.5', idiom: 'ipad', filename: 'AppIcon-83.5@2x.png', scale: '2x' },
      { size: '1024x1024', idiom: 'ios-marketing', filename: 'AppIcon-1024.png', scale: '1x' },
    ],
    info: { version: 1, author: 'xcode' },
  };

  fs.writeFileSync(path.join(appIconDir, 'Contents.json'), JSON.stringify(contents, null, 2));
}

(async () => {
  await generateAndroidIcons();
  await generateIosIcons();
  console.log('Generated native app icon assets.');
})();
