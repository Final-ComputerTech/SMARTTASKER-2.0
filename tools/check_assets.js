const fs = require('fs');
const path = require('path');
const root = path.resolve('./frontend');
function walk(dir) {
  const list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...walk(p));
    else if (e.isFile() && p.endsWith('.html')) list.push(p);
  });
  return list;
}
const files = walk(root);
const re = /(?:src|href)=["']([^"']+)["']/g;
let missing = [];
files.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s)) !== null) {
    let url = m[1];
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('mailto:')) continue;
    let p = url.split('?')[0].split('#')[0];
    // resolve relative to the HTML file
    let candidate = path.resolve(path.dirname(f), p);
    if (!fs.existsSync(candidate)) {
      // try from frontend root
      let candidate2 = path.resolve(root, p.replace(/^\//, ''));
      if (fs.existsSync(candidate2)) continue;
      missing.push({ file: f, ref: p, candidate, candidate2, exists1: fs.existsSync(candidate), exists2: fs.existsSync(candidate2) });
    }
  }
});
if (missing.length === 0) console.log('No missing local asset references found');
else console.log(JSON.stringify(missing, null, 2));
